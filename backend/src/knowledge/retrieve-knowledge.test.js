const assert = require("node:assert/strict");
const test = require("node:test");

const { buildKnowledgeBase, loadKnowledgeBase } = require("./knowledge-base");
const {
  CONTEXT_CHAR_BUDGET,
  FACET_CAPS,
  formatKnowledgeContext,
  retrieveInterviewKnowledge,
} = require("./retrieve-knowledge");
const { checkInvariants } = require("./fixtures/retrieval-cases");
const {
  body,
  companyFile,
  frameworkFiles,
  industryFile,
  roleFile,
} = require("./fixtures/test-documents");

const TODAY = "2026-11-01";

function build(files) {
  return buildKnowledgeBase(files, { today: TODAY });
}

function retrieve(knowledgeBase, input) {
  return retrieveInterviewKnowledge(input, { knowledgeBase });
}

function sectionIds(result) {
  return result.sections.map((section) => section.id);
}

/* ------------------------------ Unavailable ------------------------------ */

test("an empty knowledge base is unavailable and distinguishes given from missing inputs", () => {
  const result = retrieve(build([]), {
    jobTitle: "Software Engineer",
    company: "Amazon",
    focusArea: "behavioral",
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.context, "");
  assert.equal(result.version, null);
  assert.equal(result.knowledgeStatus, "unavailable");
  assert.deepEqual(result.sections, []);
  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.documents, []);
  assert.equal(result.coverage.company.status, "unavailable");
  assert.equal(result.coverage.company.reason, "knowledge_unavailable");
  assert.equal(result.coverage.role.status, "unavailable");
  assert.equal(result.coverage.framework.status, "unavailable");
  assert.equal(result.coverage.industry.status, "not_given");
});

test("retrieval never throws; an unexpected error returns an unavailable result", (t) => {
  t.mock.method(console, "error", () => {});

  const broken = { status: "ok", version: "kb-broken", documents: null };
  const result = retrieve(broken, { company: "Amazon" });

  assert.equal(result.status, "unavailable");
  assert.equal(result.context, "");
  assert.equal(result.coverage.company.status, "unavailable");
  assert.equal(result.coverage.company.reason, "retrieval_error");
  assert.equal(console.error.mock.calls.length, 1);
});

/* -------------------------------- Degraded -------------------------------- */

test("a skipped company file makes an unmatched company unavailable, not 'not found'", () => {
  const knowledgeBase = build([
    ...frameworkFiles(),
    companyFile({ slug: "amazon", title: "Amazon", reviewed: "2026-13-01" }),
    companyFile({ slug: "capital-one", title: "Capital One" }),
  ]);

  assert.equal(knowledgeBase.status, "degraded");

  const missing = retrieve(knowledgeBase, { company: "Amazon", focusArea: "behavioral" });

  assert.equal(missing.status, "partial");
  assert.equal(missing.knowledgeStatus, "degraded");
  assert.equal(missing.coverage.company.status, "unavailable");
  assert.equal(missing.coverage.company.reason, "knowledge_degraded");
  assert.equal(missing.coverage.framework.status, "matched");
  assert.deepEqual(sectionIds(missing), ["framework.behavioral#overview"]);

  // Files that did load still match normally.
  const matched = retrieve(knowledgeBase, { company: "Capital One" });

  assert.equal(matched.coverage.company.status, "matched");
  assert.deepEqual(checkInvariants(knowledgeBase, { knowledge: matched }), []);
});

test("an alias collision leaves the colliding name unmatched and reported as unavailable", () => {
  const knowledgeBase = build([
    ...frameworkFiles(),
    companyFile({ slug: "acme", title: "Acme" }),
    companyFile({ slug: "acme-labs", title: "Acme Labs", aliases: ["ACME, Inc."] }),
  ]);

  const result = retrieve(knowledgeBase, { company: "Acme Inc" });

  assert.equal(result.coverage.company.status, "unavailable");
  assert.ok(result.sections.every((section) => section.kind !== "company"));
  assert.equal(retrieve(knowledgeBase, { company: "Acme Labs" }).coverage.company.documentId, "company.acme-labs");
});

test("a broken role file makes an unmatched title unavailable", () => {
  const broken = roleFile({ slug: "nursing", aliases: ["Registered Nurse"] });
  const knowledgeBase = build([
    ...frameworkFiles(),
    { ...broken, text: broken.text.replace("levels: mid", "levels: middle") },
  ]);

  const result = retrieve(knowledgeBase, { jobTitle: "Registered Nurse" });

  assert.equal(result.coverage.role.status, "unavailable");
  assert.equal(result.coverage.role.reason, "knowledge_degraded");
});

test("a missing focus framework falls back to mixed and reports partial coverage", () => {
  const knowledgeBase = build(frameworkFiles({ omit: ["technical"] }));
  const result = retrieve(knowledgeBase, { focusArea: "technical" });

  assert.equal(result.status, "partial");
  assert.equal(result.coverage.framework.status, "matched");
  assert.equal(result.coverage.framework.documentId, "framework.mixed");
  assert.equal(result.coverage.framework.matchedBy, "fallback");
  assert.deepEqual(sectionIds(result), ["framework.mixed#overview"]);
});

test("no framework at all is unavailable while other facets still work", () => {
  const knowledgeBase = build([companyFile({ slug: "acme", title: "Acme" })]);
  const result = retrieve(knowledgeBase, { company: "Acme" });

  assert.equal(result.coverage.framework.status, "unavailable");
  assert.equal(result.coverage.company.status, "matched");
  assert.equal(result.status, "partial");
});

/* --------------------------------- Budget --------------------------------- */

function bigKnowledgeBase() {
  const big = (prefix) => `${prefix} ${body(1140)}`;
  const companySections = Array.from({ length: 6 }, (_, index) => ({
    slug: index === 0 ? "overview" : `part-${index}`,
    sources: [`https://example.com/bigco/${index}`],
    text: big(`BigCo part ${index}.`),
  }));

  return build([
    ...frameworkFiles({ overviewText: big("Framework overview.") }),
    companyFile({ slug: "bigco", title: "BigCo", sections: companySections }),
    roleFile({
      slug: "widgets",
      aliases: ["Widget Engineer"],
      text: big("Widget role."),
      extraSections: [{ slug: "extra", text: big("Widget extra.") }],
    }),
    industryFile({ slug: "tech", sections: [{ slug: "overview", text: big("Tech industry.") }] }),
  ]);
}

test("company content can't crowd out the framework and the budget is never exceeded", () => {
  const knowledgeBase = bigKnowledgeBase();
  const result = retrieve(knowledgeBase, {
    company: "BigCo",
    jobTitle: "Widget Engineer",
    industry: "tech",
    roleLevel: "mid",
    focusArea: "behavioral",
  });

  assert.ok(result.context.length <= CONTEXT_CHAR_BUDGET);
  assert.equal(result.budget.usedChars, result.context.length);
  assert.ok(sectionIds(result).includes("framework.behavioral#overview"));
  assert.ok(sectionIds(result).includes("company.bigco#overview"));
  assert.ok(sectionIds(result).includes("role.widgets#overview"));
  assert.ok(result.budget.omittedSectionIds.length > 0);

  // Whole sections, matching sources, eligible levels.
  assert.deepEqual(checkInvariants(knowledgeBase, { knowledge: result }), []);

  // Each BigCo section has its own URL, so one source per included section,
  // and none for the sections the budget cut.
  const includedCompany = result.sections.filter((section) => section.kind === "company");
  assert.ok(includedCompany.length > 0 && includedCompany.length < 6);
  assert.equal(result.sources.length, includedCompany.length);
});

test("a matched document cut entirely by the budget is reported as omitted", () => {
  const result = retrieve(bigKnowledgeBase(), {
    company: "BigCo",
    jobTitle: "Widget Engineer",
    industry: "tech",
    roleLevel: "mid",
    focusArea: "behavioral",
  });

  assert.equal(result.coverage.industry.status, "omitted");
  assert.equal(result.coverage.industry.reason, "budget");
  assert.equal(result.status, "partial");
  assert.ok(result.sections.every((section) => section.kind !== "industry"));
  assert.ok(result.budget.omittedSectionIds.includes("industry.tech#overview"));
});

test("the first-pass caps add up to the budget", () => {
  const total = Object.values(FACET_CAPS).reduce((sum, cap) => sum + cap, 0);

  assert.equal(total, CONTEXT_CHAR_BUDGET);
});

/* ------------------------------ Formatting ------------------------------ */

test("formatKnowledgeContext escapes attributes and skips documents without sections", () => {
  const context = formatKnowledgeContext("kb-123", [
    {
      id: "company.att",
      kind: "company",
      title: 'AT&T "Mobility"',
      reviewed: "2026-11-01",
      sections: [{ id: "company.att#overview", title: "A & B", body: "Body text." }],
    },
    { id: "industry.tech", kind: "industry", title: "Tech", reviewed: "2026-11-01", sections: [] },
  ]);

  assert.equal(
    context,
    [
      '<knowledge_base version="kb-123">',
      '<document id="company.att" kind="company" title="AT&amp;T &quot;Mobility&quot;" reviewed="2026-11-01">',
      '<section id="company.att#overview" title="A &amp; B">',
      "Body text.",
      "</section>",
      "</document>",
      "</knowledge_base>",
    ].join("\n")
  );
  assert.equal(formatKnowledgeContext("kb-123", []), "");
});

test("context lists company, role, framework, then industry", () => {
  const knowledgeBase = loadKnowledgeBase({ logger: null });
  const result = retrieve(knowledgeBase, {
    company: "Amazon",
    jobTitle: "Software Engineer",
    industry: "tech",
    focusArea: "behavioral",
  });
  const order = [...result.context.matchAll(/<document id="([a-z]+)\./g)].map((match) => match[1]);

  assert.deepEqual(order, ["company", "role", "framework", "industry"]);
  assert.deepEqual(
    result.documents.map((document) => document.kind),
    ["company", "role", "framework", "industry"]
  );
});

test("retrieval is deterministic", () => {
  const input = {
    company: "Amazon",
    jobTitle: "Software Engineer",
    industry: "tech",
    roleLevel: "senior",
    focusArea: "system-design",
    jobDescription: "Design distributed systems and mentor engineers.",
  };
  const first = retrieve(loadKnowledgeBase({ logger: null }), input);
  const second = retrieve(loadKnowledgeBase({ logger: null }), input);

  assert.deepEqual(second, first);
});

test("non-string inputs are ignored", () => {
  const result = retrieve(loadKnowledgeBase({ logger: null }), {
    company: 42,
    jobTitle: { title: "Engineer" },
    focusArea: ["behavioral"],
  });

  assert.equal(result.coverage.company.status, "not_given");
  assert.equal(result.coverage.role.status, "not_given");
  assert.equal(result.coverage.framework.documentId, "framework.mixed");
  assert.equal(result.coverage.framework.matchedBy, "default");
});
