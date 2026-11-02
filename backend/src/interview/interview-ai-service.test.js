const assert = require("node:assert/strict");
const test = require("node:test");

const aiService = require("../ai/ai-service");
const resumeContextService = require("./resume-context-service");

const originalConverse = aiService.converse;
const originalGetResumeContext =
  resumeContextService.getResumeContext;

test.afterEach(() => {
  aiService.converse = originalConverse;
  resumeContextService.getResumeContext =
    originalGetResumeContext;

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

test("generateResumePersonalizedQuestion uses the selected resume context", async () => {
  let capturedAiInput;
  let capturedResumeInput;

  resumeContextService.getResumeContext =
    async (input) => {
      capturedResumeInput = input;

      return {
        resumeId: "resume-123",
        context: {
          summary:
            "AWS certified software engineer",
          skills: [
            "AWS",
            "Python",
            "Docker",
          ],
          education: [],
          experience: [
            {
              company: "Amazon Web Services",
              role:
                "Cloud Support Engineer Intern",
              description: [
                "Deployed an accessibility assistant on ECS Fargate",
              ],
            },
          ],
          projects: [],
          certifications: [
            "AWS Certified Solutions Architect - Associate",
          ],
        },
      };
    };

  aiService.converse = async (input) => {
    capturedAiInput = input;

    return {
      text:
        "You mention deploying an accessibility assistant on ECS Fargate. What design tradeoffs did you make?",
      stopReason: "end_turn",
      usage: null,
    };
  };

  delete require.cache[
    require.resolve("./interview-ai-service")
  ];

  const {
    generateResumePersonalizedQuestion,
  } = require("./interview-ai-service");

  const result =
    await generateResumePersonalizedQuestion({
      userId: "user-123",
      resumeId: "resume-123",
      role: "Solutions Architect",
      company: "Example Corp",
      interviewType: "technical",
    });

  assert.deepEqual(
    capturedResumeInput,
    {
      userId: "user-123",
      resumeId: "resume-123",
    }
  );

  assert.match(
    capturedAiInput.systemPrompt,
    /Solutions Architect/
  );

  assert.match(
    capturedAiInput.systemPrompt,
    /AWS/
  );

  assert.match(
    capturedAiInput.systemPrompt,
    /ECS Fargate/
  );

  assert.doesNotMatch(
    capturedAiInput.systemPrompt,
    /email/
  );

  assert.match(
    capturedAiInput.messages[0].content,
    /specifically grounded in the candidate's resume/
  );

  assert.match(
    result.text,
    /ECS Fargate/
  );
});

test("generateResumePersonalizedQuestion validates required ids", async () => {
  const {
    generateResumePersonalizedQuestion,
  } = require("./interview-ai-service");

  await assert.rejects(
    () =>
      generateResumePersonalizedQuestion({
        resumeId: "resume-123",
      }),
    /userId is required/
  );

  await assert.rejects(
    () =>
      generateResumePersonalizedQuestion({
        userId: "user-123",
      }),
    /resumeId is required/
  );
});

test("generateResumePersonalizedQuestion propagates resume context errors", async () => {
  resumeContextService.getResumeContext =
    async () => {
      const error = new Error(
        "Resume has not been successfully parsed."
      );

      error.code = "RESUME_NOT_PARSED";

      throw error;
    };

  delete require.cache[
    require.resolve("./interview-ai-service")
  ];

  const {
    generateResumePersonalizedQuestion,
  } = require("./interview-ai-service");

  await assert.rejects(
    () =>
      generateResumePersonalizedQuestion({
        userId: "user-123",
        resumeId: "resume-123",
      }),
    (error) => {
      assert.equal(
        error.code,
        "RESUME_NOT_PARSED"
      );

      return true;
    }
  );
});

