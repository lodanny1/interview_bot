// Mock sessions for USE_MOCK_DATA=true (local development without the Express backend).
// Sessions live in memory on globalThis so they survive Next.js hot reloads,
// but not a dev-server restart. After a restart, any "mock-..." id falls back to a default session.
import type { ActiveInterviewSession, InterviewMessage, StartInterviewInput } from "@/types/interview";

const OPENING_QUESTIONS: Record<string, string> = {
  behavioral:
    "Hi, welcome to this interview. Let's start with a warm-up question. Can you tell me a little about yourself and your background?",
  technical:
    "Hi, welcome to this interview. To start, walk me through a technical project you're proud of and the decisions you made along the way.",
  "system-design":
    "Hi, welcome to this interview. Let's design a system together. How would you design a URL shortening service?",
  leadership:
    "Hi, welcome to this interview. Tell me about a time you led a team through a difficult change. What did you do?",
  mixed:
    "Hi, welcome to this interview. Let's start with a warm-up question. Can you tell me a little about yourself and your background?",
};

type Store = Map<string, ActiveInterviewSession>;

function store(): Store {
  const g = globalThis as unknown as { __mockInterviewSessions?: Store };
  if (!g.__mockInterviewSessions) g.__mockInterviewSessions = new Map();
  return g.__mockInterviewSessions;
}

function firstQuestion(focusArea: string): InterviewMessage {
  return {
    id: "1",
    role: "interviewer",
    content: OPENING_QUESTIONS[focusArea] ?? OPENING_QUESTIONS.mixed,
    timestamp: new Date(),
  };
}

export function createMockSession(input: StartInterviewInput): ActiveInterviewSession {
  const session: ActiveInterviewSession = {
    id: `mock-${Date.now().toString(36)}`,
    title: input.title,
    mode: input.mode,
    focusArea: input.focusArea,
    industry: input.industry,
    roleLevel: input.roleLevel,
    experienceLevel: input.experienceLevel,
    totalQuestions: 5,
    estimatedMinutesRemaining: 15,
    messages: [firstQuestion(input.focusArea)],
  };
  store().set(session.id, session);
  return session;
}

export function getMockSession(id: string): ActiveInterviewSession | null {
  const saved = store().get(id);
  if (saved) return saved;
  if (id.startsWith("mock-")) {
    return {
      id,
      title: "Interview",
      mode: "text",
      focusArea: "mixed",
      totalQuestions: 5,
      estimatedMinutesRemaining: 15,
      messages: [firstQuestion("mixed")],
    };
  }
  return null;
}
