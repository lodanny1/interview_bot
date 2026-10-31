const { converse } = require("../ai/ai-service");

function buildSystemPrompt({
  role,
  company,
  interviewType,
  resumeContext,
}) {
  const parts = [
    "You are conducting a realistic job interview.",
    `Target role: ${role || "Not provided"}.`,
    `Target company: ${company || "Not provided"}.`,
    `Interview type: ${interviewType || "general"}.`,
    "Ask one interview question at a time.",
    "Do not answer the question for the candidate.",
    "Keep questions concise and realistic.",
  ];

  if (resumeContext) {
    parts.push(
      "Use the candidate's resume context when it is relevant, but do not invent facts that are not present."
    );

    parts.push(`Resume context:\n${resumeContext}`);
  }

  return parts.join("\n");
}

async function generateOpeningQuestion({
  role,
  company,
  interviewType,
  resumeContext,
}) {
  const systemPrompt = buildSystemPrompt({
    role,
    company,
    interviewType,
    resumeContext,
  });

  const response = await converse({
    systemPrompt,
    messages: [
      {
        role: "user",
        content:
          "Begin the interview by asking the candidate one appropriate opening question.",
      },
    ],
    maxTokens: 250,
  });

  return response;
}

async function generateFollowUpQuestion({
  role,
  company,
  interviewType,
  resumeContext,
  conversation,
}) {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    throw new Error(
      "Conversation history is required for a follow-up question."
    );
  }

  const systemPrompt = buildSystemPrompt({
    role,
    company,
    interviewType,
    resumeContext,
  });

  const response = await converse({
    systemPrompt,
    messages: [
      ...conversation,
      {
        role: "user",
        content:
          "Based on the interview so far, ask one relevant follow-up question. Do not provide feedback yet.",
      },
    ],
    maxTokens: 250,
  });

  return response;
}

module.exports = {
  buildSystemPrompt,
  generateOpeningQuestion,
  generateFollowUpQuestion,
};