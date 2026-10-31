const assert = require("node:assert/strict");
const test = require("node:test");

const aiService = require("../ai/ai-service");

const originalConverse = aiService.converse;

test.afterEach(() => {
  aiService.converse = originalConverse;
  delete require.cache[
    require.resolve("./interview-ai-service")
  ];
});

test("buildSystemPrompt includes interview context", () => {
  const {
    buildSystemPrompt,
  } = require("./interview-ai-service");

  const prompt = buildSystemPrompt({
    role: "Solutions Architect",
    company: "Example Corp",
    interviewType: "behavioral",
    resumeContext: "AWS internship experience",
  });

  assert.match(prompt, /Solutions Architect/);
  assert.match(prompt, /Example Corp/);
  assert.match(prompt, /behavioral/);
  assert.match(prompt, /AWS internship experience/);
});

test("buildSystemPrompt does not invent missing context", () => {
  const {
    buildSystemPrompt,
  } = require("./interview-ai-service");

  const prompt = buildSystemPrompt({});

  assert.match(prompt, /Not provided/);
  assert.doesNotMatch(prompt, /Resume context:/);
});

test("generateOpeningQuestion calls the AI service", async () => {
  let captured;

  aiService.converse = async (input) => {
    captured = input;

    return {
      text: "Tell me about yourself.",
      stopReason: "end_turn",
      usage: null,
    };
  };

  delete require.cache[
    require.resolve("./interview-ai-service")
  ];

  const {
    generateOpeningQuestion,
  } = require("./interview-ai-service");

  const result = await generateOpeningQuestion({
    role: "Cloud Engineer",
    company: "Example Corp",
    interviewType: "general",
  });

  assert.equal(
    result.text,
    "Tell me about yourself."
  );

  assert.match(
    captured.systemPrompt,
    /Cloud Engineer/
  );

  assert.equal(
    captured.messages.length,
    1
  );
});

test("generateFollowUpQuestion includes conversation history", async () => {
  let captured;

  aiService.converse = async (input) => {
    captured = input;

    return {
      text: "What was the hardest part of that?",
      stopReason: "end_turn",
      usage: null,
    };
  };

  delete require.cache[
    require.resolve("./interview-ai-service")
  ];

  const {
    generateFollowUpQuestion,
  } = require("./interview-ai-service");

  const conversation = [
    {
      role: "assistant",
      content:
        "Tell me about a difficult technical issue.",
    },
    {
      role: "user",
      content:
        "I debugged a deployment issue during my internship.",
    },
  ];

  const result = await generateFollowUpQuestion({
    role: "Cloud Engineer",
    company: "Example Corp",
    conversation,
  });

  assert.equal(
    result.text,
    "What was the hardest part of that?"
  );

  assert.equal(
    captured.messages.length,
    3
  );

  assert.deepEqual(
    captured.messages.slice(0, 2),
    conversation
  );
});

test("generateFollowUpQuestion rejects empty conversation history", async () => {
  const {
    generateFollowUpQuestion,
  } = require("./interview-ai-service");

  await assert.rejects(
    () =>
      generateFollowUpQuestion({
        role: "Cloud Engineer",
        conversation: [],
      }),
    /Conversation history is required/
  );
});