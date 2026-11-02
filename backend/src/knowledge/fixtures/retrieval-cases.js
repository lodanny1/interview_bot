// Role & Company Knowledge Retrieval (Issue #16). Loads the retrieval cases
// and checks a buildInterviewContext() result against them. Shared by
// retrieval-cases.test.js and scripts/knowledge-report.js.
const fs = require("node:fs");
const path = require("node:path");

const FACETS = ["company", "role", "framework", "industry"];

// Descriptions are written once and referenced as "@name".
function loadRetrievalCases() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "retrieval-cases.json"), "utf8"));
  const resolve = (value) =>
    typeof value === "string" && value.startsWith("@") ? data.descriptions[value.slice(1)] : value;

  return data.cases.map((testCase) => ({
    ...testCase,
    setup: testCase.setup && {
      ...testCase.setup,
      jobDescription: resolve(testCase.setup.jobDescription),
    },
    targetJob: testCase.targetJob && {
      ...testCase.targetJob,
      description: resolve(testCase.targetJob.description),
    },
  }));
}

// Checks every case must pass, whatever it expects.
function checkInvariants(knowledgeBase, { knowledge }) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const included = new Set(knowledge.sections.map((section) => section.id));

  if (knowledge.context.length > knowledge.budget.limitChars) {
    fail(`context is ${knowledge.context.length} chars, over the ${knowledge.budget.limitChars} budget`);
  }

  if (knowledge.budget.usedChars !== knowledge.context.length) {
    fail("budget.usedChars doesn't match the context length");
  }

  const tagged = [...knowledge.context.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);

  if (tagged.length !== included.size || tagged.some((id) => !included.has(id))) {
    fail("sections listed in the result don't match the sections in the context");
  }

  if (knowledge.context && !knowledge.context.includes(`version="${knowledgeBase.version}"`)) {
    fail("context doesn't carry the knowledge base version");
  }

  for (const section of knowledge.sections) {
    const original = knowledgeBase.sections.get(section.id);

    if (!original || !knowledge.context.includes(`${original.body}\n</section>`)) {
      fail(`${section.id} is not included whole`);
    }

    const eligible =
      original &&
      (original.levels === "all" ||
        (knowledge.roleLevel !== null && original.levels.includes(knowledge.roleLevel)));

    if (!eligible) fail(`${section.id} is not eligible for role level ${knowledge.roleLevel}`);

    // Kinds and coverage facets have the same names.
    const facet = knowledge.coverage[section.kind];

    if (facet.status !== "matched" || facet.documentId !== section.documentId) {
      fail(`${section.id} is in the context but ${section.kind} coverage is ${facet.status} (${facet.documentId})`);
    }
  }

  // Sources must be exactly the URLs of the included sections.
  const expectedSources = new Set();

  for (const section of knowledge.sections) {
    for (const url of knowledgeBase.sections.get(section.id).sources) {
      expectedSources.add(`${section.documentId} ${url}`);
    }
  }

  const actualSources = new Set(knowledge.sources.map((source) => `${source.documentId} ${source.url}`));

  if (
    expectedSources.size !== actualSources.size ||
    [...expectedSources].some((key) => !actualSources.has(key))
  ) {
    fail("sources don't match the URLs of the included sections");
  }

  for (const source of knowledge.sources) {
    if (source.reviewed !== knowledgeBase.documents.get(source.documentId).reviewed) {
      fail(`source ${source.url} has the wrong reviewed date`);
    }

    if (source.sectionIds.some((id) => !included.has(id))) {
      fail(`source ${source.url} points at a section that isn't included`);
    }
  }

  for (const document of knowledge.documents) {
    if (document.sectionIds.length === 0) fail(`${document.id} is listed with no sections`);
  }

  if (knowledgeBase.status === "ok") {
    if (knowledge.coverage.framework.status !== "matched") {
      fail("a healthy knowledge base must always return framework content");
    }

    if (!knowledge.sections.some((section) => section.kind === "framework")) {
      fail("no framework section in the context");
    }
  }

  return failures;
}

// Checks one case's own expectations. Returns a list of failure messages.
function checkCase(knowledgeBase, testCase, result) {
  const failures = checkInvariants(knowledgeBase, result);
  const fail = (message) => failures.push(message);
  const expect = testCase.expect || {};
  const { input, knowledge } = result;
  const included = new Set(knowledge.sections.map((section) => section.id));
  const sourceUrls = new Set(knowledge.sources.map((source) => source.url));

  if (expect.status && knowledge.status !== expect.status) {
    fail(`status is ${knowledge.status}, expected ${expect.status}`);
  }

  for (const note of expect.notes || []) {
    if (!input.notes.includes(note)) fail(`missing input note ${note}`);
  }

  for (const [key, value] of Object.entries(expect.input || {})) {
    const actual = key === "jobDescriptionSource" ? input.provenance.jobDescription : input[key];

    if (actual !== value) fail(`input.${key} is ${JSON.stringify(actual)}, expected ${JSON.stringify(value)}`);
  }

  for (const [field, expectations] of [
    ["status", expect.coverage],
    ["documentId", expect.documentIds],
    ["matchedBy", expect.matchedBy],
    ["reason", expect.reasons],
  ]) {
    for (const [facet, value] of Object.entries(expectations || {})) {
      const actual = knowledge.coverage[facet][field];

      if (actual !== value) {
        fail(`coverage.${facet}.${field} is ${JSON.stringify(actual)}, expected ${JSON.stringify(value)}`);
      }
    }
  }

  for (const id of expect.includeSections || []) {
    if (!included.has(id)) fail(`expected section ${id} in the context`);
  }

  for (const id of expect.excludeSections || []) {
    if (included.has(id) || knowledge.context.includes(`id="${id}"`)) fail(`section ${id} must not be in the context`);
  }

  for (const id of expect.excludeDocuments || []) {
    if (knowledge.sections.some((section) => section.documentId === id)) fail(`document ${id} must not be in the context`);
  }

  for (const kind of expect.excludeKinds || []) {
    if (knowledge.sections.some((section) => section.kind === kind)) fail(`no ${kind} content expected`);
  }

  for (const url of expect.includeSources || []) {
    if (!sourceUrls.has(url)) fail(`expected source ${url}`);
  }

  for (const url of expect.excludeSources || []) {
    if (sourceUrls.has(url)) fail(`source ${url} must not be listed`);
  }

  return failures;
}

module.exports = {
  FACETS,
  checkCase,
  checkInvariants,
  loadRetrievalCases,
};
