export type InterviewMode = "text" | "voice" | "avatar";

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
