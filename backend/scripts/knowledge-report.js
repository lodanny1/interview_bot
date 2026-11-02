// Role & Company Knowledge Retrieval (Issue #16). Relevance report: runs every
// retrieval case and prints what was selected, why, and whether it matches
// the expectations, so a person can judge relevance.
//
//   npm run knowledge:report                  all cases
//   npm run knowledge:report -- --case <id>   one case
//   npm run knowledge:report -- --context     also print the formatted context
//
// Exits 1 if the knowledge base has errors or any case fails. Lives outside
// src/, so it isn't shipped in the Docker image.
const { loadKnowledgeBase } = require("../src/knowledge/knowledge-base");
const { buildInterviewContext } = require("../src/knowledge/interview-context");
const {
  CONTEXT_CHAR_BUDGET,
  RETRIEVER_VERSION,
  ROLE_THRESHOLDS,
} = require("../src/knowledge/retrieve-knowledge");
const {
  FACETS,
  checkCase,
  loadRetrievalCases,
} = require("../src/knowledge/fixtures/retrieval-cases");

const args = process.argv.slice(2);
const showContext = args.includes("--context");
const caseIndex = args.indexOf("--case");
const onlyCase = caseIndex >= 0 ? args[caseIndex + 1] : null;

function describeInput(setup, targetJob) {
  const parts = Object.entries(setup || {})
    .filter(([key]) => key !== "jobDescription" && key !== "title" && key !== "mode")
    .map(([key, value]) => `${key}=${value}`);

  if (setup && setup.jobDescription) parts.push(`setupJD=${setup.jobDescription.length} chars`);

  const job = targetJob
    ? `"${targetJob.job_title}" @ ${targetJob.company ? `"${targetJob.company}"` : "(no company)"}, savedJD=${(targetJob.description || "").length} chars`
    : "none";

  return { setup: parts.join(" ") || "(empty)", job };
}

function formatCoverage(entry) {
  const detail = [entry.documentId, entry.matchedBy, entry.reason].filter(Boolean).join(", ");

  return `${entry.status}${detail ? ` (${detail})` : ""}`;
}

const knowledgeBase = loadKnowledgeBase({ logger: null });

console.log("Knowledge base");
console.log(`  status ${knowledgeBase.status}, version ${knowledgeBase.version}, retriever ${RETRIEVER_VERSION}`);
console.log(`  ${knowledgeBase.documents.size} documents, ${knowledgeBase.sections.size} sections, budget ${CONTEXT_CHAR_BUDGET} chars`);
console.log(`  role thresholds ${JSON.stringify(ROLE_THRESHOLDS)}`);

for (const error of knowledgeBase.errors) {
  console.log(`  ERROR ${error.file}${error.line ? `:${error.line}` : ""} ${error.code}: ${error.detail}`);
}

const cases = loadRetrievalCases().filter((testCase) => !onlyCase || testCase.id === onlyCase);
let failed = 0;

for (const testCase of cases) {
  const result = buildInterviewContext(
    { setup: testCase.setup, targetJob: testCase.targetJob },
    { knowledgeBase, debug: true }
  );
  const failures = checkCase(knowledgeBase, testCase, result);
  const { input, knowledge } = result;
  const described = describeInput(testCase.setup, testCase.targetJob);

  if (failures.length > 0) failed += 1;

  console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"}  ${testCase.id}`);
  console.log(`  ${testCase.about}`);
  console.log(`  setup: ${described.setup}`);
  console.log(`  target job: ${described.job}`);
  console.log(
    `  effective: goal=${input.goal} title=${JSON.stringify(input.jobTitle)} company=${JSON.stringify(input.company)} ` +
      `level=${input.roleLevel} focus=${input.focusArea} JD from ${input.provenance.jobDescription}` +
      (input.notes.length ? `  notes: ${input.notes.join(", ")}` : "")
  );
  console.log(`  status: ${knowledge.status}`);

  for (const facet of FACETS) {
    const expected = testCase.expect.coverage && testCase.expect.coverage[facet];

    console.log(
      `    ${facet.padEnd(9)} ${formatCoverage(knowledge.coverage[facet])}` +
        (expected ? `   [expected ${expected}]` : "")
    );
  }

  const { role } = knowledge.debug;

  if (role.aliasMatches.length > 0) {
    console.log(`  role alias matches: ${role.aliasMatches.map((m) => `"${m.alias}"->${m.documentId}`).join(", ")}`);
  }

  if (role.scores.length > 0) {
    console.log(
      `  role keyword scores: ${role.scores
        .map((s) => `${s.id}=${s.score} [${s.matchedTerms.join(" ")}]`)
        .join("  ")}`
    );
  }

  console.log(`  sections (${knowledge.budget.usedChars}/${knowledge.budget.limitChars} chars):`);

  for (const candidate of knowledge.debug.candidates) {
    console.log(
      `    ${candidate.selected ? "+" : "-"} ${candidate.id.padEnd(48)} rank ${candidate.rank}  bm25 ${candidate.score.toFixed(3)}` +
        (candidate.selected ? "" : "  (omitted: budget)")
    );
  }

  if (knowledge.debug.filteredByLevel.length > 0) {
    console.log(`    filtered by level: ${knowledge.debug.filteredByLevel.join(", ")}`);
  }

  for (const source of knowledge.sources) {
    console.log(`  source: ${source.url} (reviewed ${source.reviewed})`);
  }

  const expected = [
    ...(testCase.expect.includeSections || []).map((id) => `+${id}`),
    ...(testCase.expect.excludeSections || []).map((id) => `-${id}`),
    ...(testCase.expect.excludeDocuments || []).map((id) => `-${id} (all)`),
    ...(testCase.expect.excludeKinds || []).map((kind) => `-${kind} (all)`),
  ];

  if (expected.length > 0) console.log(`  expected: ${expected.join("  ")}`);

  for (const failure of failures) console.log(`  !! ${failure}`);

  if (showContext) console.log(`\n${knowledge.context}\n`);
}

console.log(`\n${cases.length - failed}/${cases.length} cases passed`);

if (knowledgeBase.errors.length > 0 || failed > 0 || cases.length === 0) {
  process.exitCode = 1;
}
