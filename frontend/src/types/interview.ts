export type InterviewMode = "text" | "voice" | "avatar";

export type PracticeGoal = "general" | "specific";

export interface InterviewSession {
  id: string;
  title: string;
  industry: string;
  role: string;
  mode: InterviewMode;
  duration: number; // minutes
  date: string;
  score: number;
}

export interface DashboardStats {
  totalSessions: number;
  interviewsThisMonth: number;
  hoursPracticed: number;
  currentStreak: number;
}

export interface UpcomingInterview {
  role: string;
  company: string;
  type: string;
  daysUntil: number;
}

export interface SkillPerformance {
  name: string;
  score: number;
}

export interface CalendarEvent {
  date: string;
  title: string;
  time: string;
}

export interface PrepChecklist {
  company: string;
  role: string;
}

export interface InterviewMessage {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  timestamp: Date;
}

export interface FeedbackReport {
  id: string;
  title: string;
  role: string;
}

/* ------------------- Start Interview Session (Issue #51) ------------------- */

// What the setup form sends to the backend to start a session.
// Optional fields are omitted (not sent as "") when the user leaves them empty.
export interface StartInterviewInput {
  goal: PracticeGoal;
  title: string;
  focusArea: string;
  mode: InterviewMode;
  industry?: string;
  roleLevel?: string;
  experienceLevel?: string;
  jobDescription?: string;
}

// An in-progress session. Different from InterviewSession above, which is a
// finished-session history record (it has a score and a date).
export interface ActiveInterviewSession {
  id: string;
  title: string;
  mode: InterviewMode;
  // Option values from the setup form. Title and focus area are required there;
  // the others only exist if the user filled them in. The session header shows them.
  focusArea: string;
  industry?: string;
  roleLevel?: string;
  experienceLevel?: string;
  // Footer: "Question N of {totalQuestions}" and "Est. {estimatedMinutesRemaining} mins remaining".
  // Both optional; the footer hides whatever the backend doesn't provide.
  totalQuestions?: number;
  estimatedMinutesRemaining?: number;
  // Everything said so far. Right after start this holds the first question;
  // when a session is reloaded it holds the transcript the backend has stored.
  messages: InterviewMessage[];
}