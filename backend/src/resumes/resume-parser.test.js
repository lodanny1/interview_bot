const assert = require("node:assert/strict");
const test = require("node:test");

const aiService = require("../ai/ai-service");

const originalConverse = aiService.converse;

test.afterEach(() => {
  aiService.converse = originalConverse;

  delete require.cache[
    require.resolve("./resume-parser")
  ];
});

test("buildResumeParserPrompt includes resume text and anti-hallucination rules", () => {
  const {
    buildResumeParserPrompt,
  } = require("./resume-parser");

  const prompt = buildResumeParserPrompt(
    "AWS Cloud Support Engineer Intern"
  );

  assert.match(
    prompt,
    /AWS Cloud Support Engineer Intern/
  );

  assert.match(
    prompt,
    /Do not invent information/
  );

  assert.match(prompt, /"skills"/);
  assert.match(prompt, /"experience"/);
});

test("buildResumeParserPrompt rejects empty resume text", () => {
  const {
    buildResumeParserPrompt,
  } = require("./resume-parser");

  assert.throws(
    () => buildResumeParserPrompt("   "),
    /resumeText is required/
  );
});

test("parseJsonResponse parses valid JSON", () => {
  const {
    parseJsonResponse,
  } = require("./resume-parser");

  const result = parseJsonResponse(
    '{"name":"Danny","skills":["AWS"]}'
  );

  assert.deepEqual(result, {
    name: "Danny",
    skills: ["AWS"],
  });
});

test("parseJsonResponse rejects invalid JSON", () => {
  const {
    parseJsonResponse,
  } = require("./resume-parser");

  assert.throws(
    () =>
      parseJsonResponse(
        "Here is the JSON: { name: Danny }"
      ),
    /invalid JSON/
  );
});

test("parseResume sends extracted text to the AI service", async () => {
  let captured;

  aiService.converse = async (input) => {
    captured = input;

    return {
      text: JSON.stringify({
        name: "Danny",
        skills: ["AWS", "Python"],
        education: [],
        experience: [],
        projects: [],
        certifications: [],
      }),
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };
  };

  delete require.cache[
    require.resolve("./resume-parser")
  ];

  const {
    parseResume,
  } = require("./resume-parser");

  const result = await parseResume(
    "Danny\nAWS\nPython"
  );

  assert.equal(
    result.parsedJson.name,
    "Danny"
  );

  assert.deepEqual(
    result.parsedJson.skills,
    ["AWS", "Python"]
  );

  assert.match(
    captured.messages[0].content,
    /Danny/
  );

  assert.match(
    captured.systemPrompt,
    /Never infer or invent/
  );
});