// Generate Feedback Report (Issue #30) and Per Question Feedback (Issue #31).
// Shared contract for the post-interview
// feedback report. Backend routes: GET/POST /interviews/:id/feedback
// (backend/src/feedback/feedback-report-routes.js). The app proxies them at
// /api/interview/feedback. Safe to import from client and server code.

export const FEEDBACK_API_URL = "/api/interview/feedback";

export type FeedbackStatus =
  | "not_completed"
  | "not_generated"
  | "generating"
  | "ready"
  | "unavailable"
  | "failed";

export interface FeedbackCategory {
  key: string;
  label: string;
  score: number;
  comment: string;
}

export interface FeedbackPoint {
  point: string;
  questionNumbers: number[];
}

export interface FeedbackImprovement extends FeedbackPoint {
  suggestion: string;
}

// Why a question has no feedback (Issue #31).
//   too_short     the answer was too short to judge fairly
//   not_reviewed  the AI didn't return feedback for it
export type QuestionFeedbackReason = "too_short" | "not_reviewed";

// Feedback on one answered question (Issue #31). question and answer are the
// user's own transcript text.
export interface QuestionFeedback {
  number: number;
  question: string;
  answer: string;
  feedbackAvailable: boolean;
  reason: QuestionFeedbackReason | null;
  // null when feedbackAvailable is false; no score is made up.
  score: number | null;
  feedback: string;
  strength: string;
  improvement: string;
}

export interface FeedbackReport {
  overallScore: number;
  summary: string;
  categories: FeedbackCategory[];
  strengths: FeedbackPoint[];
  improvements: FeedbackImprovement[];
  // Empty for reports made before per-question feedback existed.
  questions: QuestionFeedback[];
  questionsAnswered: number;
}

export interface InterviewFeedback {
  sessionId: string;
  status: FeedbackStatus;
  reason: string | null;
  // Only set when status is "ready".
  report: FeedbackReport | null;
  generatedAt: string | null;
}

// Why a report isn't shown. Keys match backend reason codes.
export const FEEDBACK_MESSAGES = {
  no_answers:
    "You didn't answer any questions in this interview, so there's nothing to analyze yet.",
  not_enough_detail:
    "Your answers were too short to analyze fairly. Give fuller answers next time and you'll get a full report.",
  insufficient_evidence:
    "There wasn't enough in your answers to give fair feedback, so no score was made up for this interview.",
  unavailable: "There isn't enough interview material to create a feedback report.",
  failed: "We couldn't generate your feedback report right now.",
  notCompleted: "Your feedback report will be generated after you finish this interview.",
  loadError: "We couldn't load your feedback report.",
} as const;

export const QUESTION_FEEDBACK_MESSAGES: Record<QuestionFeedbackReason, string> = {
  too_short: "This answer was too short to give fair feedback, so it wasn't scored.",
  not_reviewed: "Feedback isn't available for this question.",
};

export function unavailableMessage(reason: string | null): string {
  if (reason === "no_answers" || reason === "not_enough_detail" || reason === "insufficient_evidence") {
    return FEEDBACK_MESSAGES[reason];
  }
  return FEEDBACK_MESSAGES.unavailable;
}

const STATUSES: FeedbackStatus[] = [
  "not_completed",
  "not_generated",
  "generating",
  "ready",
  "unavailable",
  "failed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function questionNumbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0)
    : [];
}

function parsePoint(raw: unknown): FeedbackPoint | null {
  if (!isRecord(raw) || typeof raw.point !== "string" || !raw.point.trim()) return null;
  return { point: raw.point, questionNumbers: questionNumbers(raw.questionNumbers) };
}

function parseImprovement(raw: unknown): FeedbackImprovement | null {
  const point = parsePoint(raw);
  if (!point || !isRecord(raw)) return null;
  return { ...point, suggestion: typeof raw.suggestion === "string" ? raw.suggestion : "" };
}

function parseCategory(raw: unknown): FeedbackCategory | null {
  if (!isRecord(raw) || typeof raw.key !== "string" || !isScore(raw.score)) return null;
  return {
    key: raw.key,
    label: typeof raw.label === "string" && raw.label ? raw.label : raw.key,
    score: raw.score,
    comment: typeof raw.comment === "string" ? raw.comment : "",
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseQuestionFeedback(raw: unknown): QuestionFeedback | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.number !== "number" || !Number.isInteger(raw.number) || raw.number < 1) {
    return null;
  }

  const base = {
    number: raw.number,
    question: text(raw.question),
    answer: text(raw.answer),
  };

  const feedback = text(raw.feedback).trim();

  // Only show a score when the backend says the feedback is real and it's valid.
  if (raw.feedbackAvailable === true && isScore(raw.score) && feedback) {
    return {
      ...base,
      feedbackAvailable: true,
      reason: null,
      score: raw.score,
      feedback,
      strength: text(raw.strength),
      improvement: text(raw.improvement),
    };
  }

  return {
    ...base,
    feedbackAvailable: false,
    reason: raw.reason === "too_short" ? "too_short" : "not_reviewed",
    score: null,
    feedback: "",
    strength: "",
    improvement: "",
  };
}

function compact<T>(items: unknown, parse: (raw: unknown) => T | null): T[] {
  return Array.isArray(items) ? items.map(parse).filter((item): item is T => item !== null) : [];
}

export function parseFeedbackReport(raw: unknown): FeedbackReport | null {
  if (!isRecord(raw) || !isScore(raw.overallScore) || typeof raw.summary !== "string") {
    return null;
  }

  return {
    overallScore: raw.overallScore,
    summary: raw.summary,
    categories: compact(raw.categories, parseCategory),
    strengths: compact(raw.strengths, parsePoint),
    improvements: compact(raw.improvements, parseImprovement),
    questions: compact(raw.questions, parseQuestionFeedback).sort((a, b) => a.number - b.number),
    questionsAnswered:
      typeof raw.questionsAnswered === "number" && raw.questionsAnswered >= 0
        ? raw.questionsAnswered
        : 0,
  };
}

// Accepts { feedback: {...} } or the feedback object itself. Returns null for
// anything malformed, including a "ready" status without a valid report, so a
// bad response is shown as an error rather than an empty or invented report.
export function parseFeedbackResponse(raw: unknown): InterviewFeedback | null {
  if (!isRecord(raw)) return null;
  const body = isRecord(raw.feedback) ? raw.feedback : raw;

  if (typeof body.sessionId !== "string" || !body.sessionId) return null;
  if (!STATUSES.includes(body.status as FeedbackStatus)) return null;

  const status = body.status as FeedbackStatus;
  const report = status === "ready" ? parseFeedbackReport(body.report) : null;

  if (status === "ready" && !report) return null;

  return {
    sessionId: body.sessionId,
    status,
    reason: typeof body.reason === "string" ? body.reason : null,
    report,
    generatedAt: typeof body.generatedAt === "string" ? body.generatedAt : null,
  };
}
