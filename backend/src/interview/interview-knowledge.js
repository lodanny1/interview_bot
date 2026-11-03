// Role & Company Knowledge Retrieval (Issue #16). Connects knowledge retrieval
// to the interview question generators.
//
// interview-routes.js uses prepareInterviewKnowledge and knowledgeSummary:
// POST /interviews builds promptInput from the setup and the saved target job,
// stores it on the session (interview_sessions.prompt_input), and passes it to
// the opening question; later turns reuse the stored promptInput. That keeps
// follow-up questions on the same notes as the opening question even if the
// target job or the knowledge base changes mid-session.
// The generate*WithKnowledge helpers do the same for callers without a route.
const { buildInterviewContext } = require("../knowledge/interview-context");
const interviewAiService = require("./interview-ai-service");

// Setup focus areas as the prompt's "interview type".
const INTERVIEW_TYPES = {
  behavioral: "behavioral",
  technical: "technical",
  "system-design": "system design",
  leadership: "leadership",
  mixed: "mixed",
};

// options are passed to retrieveInterviewKnowledge ({ knowledgeBase, debug }).
function prepareInterviewKnowledge({ setup, targetJob } = {}, options = {}) {
  const { input, knowledge } = buildInterviewContext({ setup, targetJob }, options);

  return {
    input,
    knowledge,
    // Everything the generators need. Plain JSON, safe to store with a session.
    promptInput: {
      role: input.jobTitle,
      company: input.company,
      interviewType: INTERVIEW_TYPES[input.focusArea],
      knowledgeContext: knowledge.context,
      knowledgeCoverage: knowledge.coverage,
    },
  };
}

// Ids, statuses and versions only: safe to log or store as session metadata.
// It names the notes used but can't rebuild their text after the knowledge
// base changes; store promptInput.knowledgeContext for that.
function knowledgeSummary(knowledge) {
  const coverage = {};

  for (const [facet, entry] of Object.entries(knowledge.coverage)) {
    coverage[facet] = { status: entry.status, documentId: entry.documentId };
  }

  return {
    status: knowledge.status,
    version: knowledge.version,
    retrieverVersion: knowledge.retrieverVersion,
    coverage,
    sectionIds: knowledge.sections.map((section) => section.id),
    sourceUrls: knowledge.sources.map((source) => source.url),
  };
}

async function generateOpeningQuestionWithKnowledge({ setup, targetJob, resumeContext } = {}, options = {}) {
  const prepared = prepareInterviewKnowledge({ setup, targetJob }, options);
  const response = await interviewAiService.generateOpeningQuestion({
    ...prepared.promptInput,
    resumeContext,
  });

  return {
    ...response,
    input: prepared.input,
    promptInput: prepared.promptInput,
    knowledge: knowledgeSummary(prepared.knowledge),
  };
}

async function generateFollowUpQuestionWithKnowledge({ promptInput, resumeContext, conversation } = {}) {
  if (!promptInput || typeof promptInput !== "object") {
    throw new Error("promptInput from the opening question is required for a follow-up question.");
  }

  return interviewAiService.generateFollowUpQuestion({
    ...promptInput,
    resumeContext,
    conversation,
  });
}

module.exports = {
  INTERVIEW_TYPES,
  generateFollowUpQuestionWithKnowledge,
  generateOpeningQuestionWithKnowledge,
  knowledgeSummary,
  prepareInterviewKnowledge,
};
