const { converse } = require("../ai/ai-service");
const {
  getResumeContext,
} = require("./resume-context-service");

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
          "Begin with one short, professional greeting or welcome sentence, then ask the candidate exactly one appropriate opening question.",
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

async function generateResumePersonalizedQuestion({
  userId,
  resumeId,
  role,
  company,
  interviewType,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  const {
    context,
  } = await getResumeContext({
    userId,
    resumeId,
    extractIfNeeded: true,
  });

  const resumeContext = JSON.stringify(
    context,
    null,
    2
  );

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
          "Begin with one short, professional greeting or welcome sentence, then ask one interview question that is specifically grounded in the candidate's resume. " +
          "Prefer a concrete experience, project, skill, certification, or accomplishment from the resume. " +
          "Do not invent details. Ask only one question and do not provide feedback or an answer.",
      },
    ],
    maxTokens: 250,
  });

  return response;
}


async function generateClosingStatement({
  role,
  company,
  interviewType,
  conversation,
}) {
  if (
    !Array.isArray(conversation) ||
    conversation.length === 0
  ) {
    throw new Error(
      "conversation is required"
    );
  }

  const systemPrompt = buildSystemPrompt({
    role,
    company,
    interviewType,
    resumeContext: null,
  });

  const response = await converse({
    systemPrompt:
      systemPrompt +
      "\n\nThe interview time limit has now been reached. " +
      "Do not ask another interview question. " +
      "Give a brief, natural closing as the interviewer. " +
      "If the candidate was in the middle of discussing something, " +
      "you may acknowledge that you are short on time. " +
      "Thank the candidate for their time and clearly indicate the interview is ending.",
    messages: [
      ...conversation,
      {
        role: "user",
        content:
          "The interview has reached its time limit. End the interview naturally now.",
      },
    ],
    maxTokens: 160,
  });

  return response;
}

module.exports = {
  buildSystemPrompt,
  generateOpeningQuestion,
  generateFollowUpQuestion,
  generateResumePersonalizedQuestion,
  generateClosingStatement,
};
