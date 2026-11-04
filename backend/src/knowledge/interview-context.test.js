const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { buildInterviewContext, resolveInterviewInput } = require("./interview-context");

const TARGET_JOB = {
  user_id: "user-1",
  job_title: "Data Analyst",
  company: "Capital One",
  description: "Saved posting: write SQL, build Tableau dashboards and analyze experiments.",
};

test("buildInterviewContext doesn't load database or auth modules", () => {
  const loaded = Object.keys(require.cache).map((file) => file.split(path.sep).join("/"));

  assert.ok(loaded.every((file) => !file.includes("/src/db/") && !file.includes("/src/auth/")));
});

test("general practice ignores the saved target job", () => {
  const input = resolveInterviewInput({
    setup: { goal: "general", focusArea: "behavioral" },
    targetJob: TARGET_JOB,
  });

  assert.equal(input.goal, "general");
  assert.equal(input.jobTitle, null);
  assert.equal(input.company, null);
  assert.equal(input.jobDescription, null);
  assert.deepEqual(input.notes, ["target_job_ignored"]);
});

test("general practice uses a pasted setup description", () => {
  const input = resolveInterviewInput({
    setup: { goal: "general", focusArea: "technical", jobDescription: "  Pasted posting text.  " },
    targetJob: TARGET_JOB,
  });

  assert.equal(input.jobDescription, "Pasted posting text.");
  assert.equal(input.provenance.jobDescription, "setup");
});

test("specific practice uses the saved title, company and description", () => {
  const input = resolveInterviewInput({
    setup: { goal: "specific", focusArea: "technical", roleLevel: "entry", industry: "finance" },
    targetJob: TARGET_JOB,
  });

  assert.deepEqual(input, {
    requestedGoal: "specific",
    goal: "specific",
    jobTitle: "Data Analyst",
    company: "Capital One",
    industry: "finance",
    roleLevel: "entry",
    focusArea: "technical",
    jobDescription: TARGET_JOB.description,
    provenance: {
      jobTitle: "target_job",
      company: "target_job",
      jobDescription: "target_job",
      industry: "setup",
      roleLevel: "setup",
      focusArea: "setup",
    },
    notes: [],
  });
});

test("a nonempty setup description replaces the saved one", () => {
  const input = resolveInterviewInput({
    setup: { goal: "specific", focusArea: "technical", jobDescription: "A different posting." },
    targetJob: TARGET_JOB,
  });

  assert.equal(input.jobDescription, "A different posting.");
  assert.equal(input.provenance.jobDescription, "setup");
  assert.deepEqual(input.notes, ["setup_description_replaces_saved"]);

  // A blank setup description doesn't count.
  const blank = resolveInterviewInput({
    setup: { goal: "specific", focusArea: "technical", jobDescription: "   " },
    targetJob: TARGET_JOB,
  });

  assert.equal(blank.provenance.jobDescription, "target_job");
});

test("specific practice without a usable target job falls back to general practice", () => {
  for (const targetJob of [null, undefined, { job_title: "   ", company: "Amazon" }]) {
    const input = resolveInterviewInput({
      setup: { goal: "specific", focusArea: "behavioral" },
      targetJob,
    });

    assert.equal(input.requestedGoal, "specific");
    assert.equal(input.goal, "general");
    assert.equal(input.jobTitle, null);
    assert.equal(input.company, null);
    assert.deepEqual(input.notes, ["target_job_missing"]);
  }
});

test("a target job without a company gives no company", () => {
  const input = resolveInterviewInput({
    setup: { goal: "specific", focusArea: "behavioral" },
    targetJob: { ...TARGET_JOB, company: null },
  });

  assert.equal(input.company, null);
  assert.equal(input.provenance.company, null);
});

test("missing and invalid setup values get defaults and notes", () => {
  const empty = resolveInterviewInput();

  assert.equal(empty.goal, "general");
  assert.equal(empty.focusArea, "mixed");
  assert.equal(empty.provenance.focusArea, "default");
  assert.equal(empty.roleLevel, null);
  assert.deepEqual(empty.notes, ["missing_goal"]);

  const invalid = resolveInterviewInput({
    setup: {
      goal: "SPECIFIC",
      focusArea: "SYSTEM_DESIGN",
      roleLevel: "staff",
      industry: "retail",
      experienceLevel: "10+",
    },
  });

  assert.equal(invalid.goal, "general");
  assert.equal(invalid.focusArea, "mixed");
  assert.equal(invalid.roleLevel, null);
  assert.equal(invalid.industry, null);
  assert.deepEqual(invalid.notes, [
    "invalid_goal",
    "invalid_industry",
    "invalid_role_level",
    "invalid_focus_area",
  ]);
});

test("experience level is not used to guess the role level", () => {
  const input = resolveInterviewInput({
    setup: { goal: "general", focusArea: "behavioral", experienceLevel: "0-1" },
  });

  assert.equal(input.roleLevel, null);
});

test("buildInterviewContext returns the effective input and the retrieval for it", () => {
  const { input, knowledge } = buildInterviewContext({
    setup: { goal: "specific", focusArea: "technical", roleLevel: "mid" },
    targetJob: TARGET_JOB,
  });

  assert.equal(input.company, "Capital One");
  assert.equal(knowledge.coverage.company.input, "Capital One");
  assert.equal(knowledge.coverage.company.documentId, "company.capital-one");
  assert.equal(knowledge.coverage.role.documentId, "role.data-analytics");
  assert.deepEqual(knowledge.filters, {
    roleLevel: "mid",
    role: "data-analytics",
    companyName: "capital one",
  });
  assert.match(knowledge.context, /^<knowledge_base version="kb-[0-9a-f]{12}">/);
  assert.deepEqual(Object.keys(knowledge).sort(), [
    "budget",
    "context",
    "coverage",
    "documents",
    "filters",
    "knowledgeStatus",
    "retrieverVersion",
    "sections",
    "sources",
    "status",
    "version",
  ]);
});

test("non-string setup values are dropped and noted as invalid", () => {
  const input = resolveInterviewInput({
    setup: { goal: 5, focusArea: ["technical"], roleLevel: {}, industry: true, jobDescription: { text: "x" } },
  });

  assert.equal(input.goal, "general");
  assert.equal(input.jobDescription, null);
  assert.deepEqual(input.notes, [
    "invalid_goal",
    "invalid_job_description",
    "invalid_industry",
    "invalid_role_level",
    "invalid_focus_area",
  ]);
});

test("oversized text is cut to the limit and noted", () => {
  const input = resolveInterviewInput({
    setup: { goal: "specific", focusArea: "technical", jobDescription: `  ${"word ".repeat(2500)}` },
    targetJob: { job_title: "T".repeat(150), company: "C".repeat(130), description: "Saved posting." },
  });

  assert.equal(input.jobTitle.length, 120);
  assert.equal(input.company.length, 120);
  assert.ok(input.jobDescription.length <= 10000);
  assert.deepEqual(input.notes, [
    "job_title_truncated",
    "company_truncated",
    "job_description_truncated",
    "setup_description_replaces_saved",
  ]);
});

test("notes about an ignored target job are not reported", () => {
  const input = resolveInterviewInput({
    setup: { goal: "general", focusArea: "technical" },
    targetJob: { job_title: "T".repeat(150), company: "Acme", description: "Saved posting." },
  });

  assert.deepEqual(input.notes, ["target_job_ignored"]);
});

test("a defaulted focus area is reported as a default, not a user choice", () => {
  const { knowledge } = buildInterviewContext({ setup: { goal: "general" } });

  assert.equal(knowledge.coverage.framework.documentId, "framework.mixed");
  assert.equal(knowledge.coverage.framework.matchedBy, "default");
  assert.equal(knowledge.coverage.framework.input, null);
});
