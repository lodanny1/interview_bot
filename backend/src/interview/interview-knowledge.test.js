// Role & Company Knowledge Retrieval (Issue #16). The setup + target job ->
// retrieval -> prompt path, with the AI service replaced by a stub.
const assert = require("node:assert/strict");
const test = require("node:test");

const aiService = require("../ai/ai-service");
const { buildKnowledgeBase } = require("../knowledge/knowledge-base");

const originalConverse = aiService.converse;
let prompts = [];
let calls = [];

function load() {
  delete require.cache[require.resolve("./interview-ai-service")];
  delete require.cache[require.resolve("./interview-knowledge")];

  return require("./interview-knowledge");
}

test.beforeEach(() => {
  prompts = [];
  calls = [];
  aiService.converse = async (input) => {
    prompts.push(input.systemPrompt);
    calls.push(input);

    return { text: "Tell me about a time you used data to make a decision.", stopReason: "end_turn", usage: null };
  };
});

test.afterEach(() => {
  aiService.converse = originalConverse;
  delete require.cache[require.resolve("./interview-ai-service")];
  delete require.cache[require.resolve("./interview-knowledge")];
});

const AMAZON_INTERN = {
  setup: { goal: "specific", focusArea: "behavioral", roleLevel: "intern" },
  targetJob: {
    job_title: "Software Development Engineer Intern",
    company: "Amazon",
    description: "Write Java code, debug issues, and work with a mentor on an internship project.",
  },
};

const UNCOVERED_COMPANY = {
  setup: { goal: "specific", focusArea: "technical", roleLevel: "mid" },
  targetJob: {
    job_title: "Data Analyst",
    company: "Riverbend Credit Union",
    description: "Write SQL, build Tableau dashboards and analyze experiments for the lending team.",
  },
};

const GENERAL_BEHAVIORAL = {
  setup: { goal: "general", focusArea: "behavioral" },
  targetJob: AMAZON_INTERN.targetJob,
};

test("prepareInterviewKnowledge turns setup and the saved job into generator input", () => {
  const { prepareInterviewKnowledge } = load();
  const { input, knowledge, promptInput } = prepareInterviewKnowledge(AMAZON_INTERN);

  assert.equal(input.goal, "specific");
  assert.deepEqual(Object.keys(promptInput).sort(), [
    "company",
    "interviewType",
    "knowledgeContext",
    "knowledgeCoverage",
    "role",
  ]);
  assert.equal(promptInput.role, "Software Development Engineer Intern");
  assert.equal(promptInput.company, "Amazon");
  assert.equal(promptInput.interviewType, "behavioral");
  assert.equal(promptInput.knowledgeContext, knowledge.context);
  assert.equal(promptInput.knowledgeCoverage.company.status, "matched");
  // Plain data that can be stored with a session.
  assert.deepEqual(JSON.parse(JSON.stringify(promptInput)), promptInput);
});

test("covered company intern: the opening question prompt carries the company, role and framework notes", async () => {
  const { generateOpeningQuestionWithKnowledge } = load();
  const result = await generateOpeningQuestionWithKnowledge({ ...AMAZON_INTERN, resumeContext: "Built a campus app." });
  const [prompt] = prompts;

  assert.equal(result.text, "Tell me about a time you used data to make a decision.");
  assert.match(prompt, /Target role: Software Development Engineer Intern\./);
  assert.match(prompt, /<document id="company\.amazon"/);
  assert.match(prompt, /Customer Obsession/);
  assert.match(prompt, /<section id="company\.amazon#student-sde"/);
  assert.match(prompt, /<document id="framework\.behavioral"/);
  assert.match(prompt, /Statements about Amazon's hiring process, interviews or values must be supported by the company notes/);
  assert.doesNotMatch(prompt, /company\.amazon#sde-iii|company\.amazon#aws|role\.software-engineering#senior-lead/);
  assert.match(prompt, /Resume context:\nBuilt a campus app\./);

  // The summary names what was used without carrying any of the text.
  assert.equal(result.knowledge.status, "ok");
  assert.ok(result.knowledge.sectionIds.includes("company.amazon#leadership-principles"));
  assert.doesNotMatch(JSON.stringify(result.knowledge), /Customer Obsession|Write Java code/);
});

test("uncovered company: no company notes and an explicit no-company-facts rule", async () => {
  const { generateOpeningQuestionWithKnowledge } = load();
  const result = await generateOpeningQuestionWithKnowledge(UNCOVERED_COMPANY);
  const [prompt] = prompts;

  assert.equal(result.knowledge.coverage.company.status, "not_found");
  assert.doesNotMatch(prompt, /<document id="company\./);
  assert.match(prompt, /You have no verified information about Riverbend Credit Union\./);
  assert.match(prompt, /<document id="role\.data-analytics"/);
  assert.match(prompt, /<document id="framework\.technical"/);
});

test("general behavioral practice: framework notes only and no company rule", async () => {
  const { generateOpeningQuestionWithKnowledge } = load();
  const result = await generateOpeningQuestionWithKnowledge(GENERAL_BEHAVIORAL);
  const [prompt] = prompts;

  assert.deepEqual(result.input.notes, ["target_job_ignored"]);
  assert.match(prompt, /Target role: Not provided\./);
  assert.match(prompt, /Target company: Not provided\./);
  assert.match(prompt, /<document id="framework\.behavioral"/);
  assert.doesNotMatch(prompt, /verified information|company notes|<document id="company\.|<document id="role\./);
});

test("unavailable knowledge base: no notes, but the company restriction still applies", async () => {
  const { generateOpeningQuestionWithKnowledge } = load();
  const result = await generateOpeningQuestionWithKnowledge(AMAZON_INTERN, {
    knowledgeBase: buildKnowledgeBase([]),
  });
  const [prompt] = prompts;

  assert.equal(result.knowledge.status, "unavailable");
  assert.equal(result.promptInput.knowledgeContext, "");
  assert.doesNotMatch(prompt, /<interview_knowledge>/);
  assert.match(prompt, /No interview preparation notes are available/);
  assert.match(prompt, /You have no verified information about Amazon\./);
});

test("specific practice without a saved job falls back to general practice in the prompt", async () => {
  const { generateOpeningQuestionWithKnowledge } = load();
  const result = await generateOpeningQuestionWithKnowledge({
    setup: { goal: "specific", focusArea: "leadership" },
    targetJob: null,
  });

  assert.deepEqual(result.input.notes, ["target_job_missing"]);
  assert.match(prompts[0], /Target company: Not provided\./);
  assert.match(prompts[0], /<document id="framework\.leadership"/);
});

test("follow-up questions reuse the stored prompt input and the conversation", async () => {
  const { generateOpeningQuestionWithKnowledge, generateFollowUpQuestionWithKnowledge } = load();
  const opening = await generateOpeningQuestionWithKnowledge(AMAZON_INTERN);
  const stored = JSON.parse(JSON.stringify(opening.promptInput));
  const conversation = [
    { role: "assistant", content: opening.text },
    { role: "user", content: "I compared two designs using usage data." },
  ];

  await generateFollowUpQuestionWithKnowledge({ promptInput: stored, conversation });

  assert.equal(prompts[1], prompts[0]);
  assert.deepEqual(calls[1].messages.slice(0, 2), conversation);
});

test("a follow-up without the stored prompt input is rejected", async () => {
  const { generateFollowUpQuestionWithKnowledge } = load();

  await assert.rejects(
    () => generateFollowUpQuestionWithKnowledge({ conversation: [{ role: "user", content: "Hi" }] }),
    /promptInput from the opening question is required/
  );
});

test("an AI service failure reaches the caller so the route can recover", async () => {
  aiService.converse = async () => {
    throw new Error("AI service unavailable");
  };

  const { generateOpeningQuestionWithKnowledge } = load();

  await assert.rejects(() => generateOpeningQuestionWithKnowledge(AMAZON_INTERN), /AI service unavailable/);
});
