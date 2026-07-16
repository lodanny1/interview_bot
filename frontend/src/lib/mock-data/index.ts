import {
  InterviewSession,
  DashboardStats,
  UpcomingInterview,
  SkillPerformance,
  CalendarEvent,
  PrepChecklist,
  FeedbackReport,
} from "@/types/interview";

export const mockStats: DashboardStats = {
  totalSessions: 16,
  interviewsThisMonth: 3,
  hoursPracticed: 45,
  currentStreak: 5,
};

export const mockUpcoming: UpcomingInterview = {
  role: "Senior Product Designer",
  company: "Amazon",
  type: "Virtual",
  daysUntil: 3,
};

export const mockSessions: InterviewSession[] = [
  { id: "1", title: "IT Manager", industry: "Tech", role: "Manager", mode: "text", duration: 20, date: "2 hours ago", score: 81 },
  { id: "2", title: "SQL Developer", industry: "Tech", role: "Developer", mode: "avatar", duration: 20, date: "1 day ago", score: 52 },
  { id: "3", title: "Data Architect", industry: "Tech", role: "IT", mode: "voice", duration: 20, date: "2 days ago", score: 92 },
  { id: "4", title: "Product Manager", industry: "Tech", role: "Senior", mode: "text", duration: 14, date: "April 24", score: 88 },
  { id: "5", title: "Product Manager", industry: "Tech", role: "Senior", mode: "text", duration: 14, date: "April 24", score: 88 },
  { id: "6", title: "Product Manager", industry: "Tech", role: "Senior", mode: "avatar", duration: 14, date: "April 24", score: 88 },
  { id: "7", title: "Product Manager", industry: "Tech", role: "Senior", mode: "voice", duration: 14, date: "April 24", score: 88 },
  { id: "8", title: "Product Manager", industry: "Tech", role: "Senior", mode: "text", duration: 14, date: "April 24", score: 88 },
  { id: "9", title: "Product Manager", industry: "Tech", role: "Senior", mode: "text", duration: 14, date: "April 24", score: 88 },
];

export const mockSkills: SkillPerformance[] = [
  { name: "Response clarity", score: 53 },
  { name: "Pacing", score: 70 },
  { name: "Filler reduction", score: 25 },
  { name: "Delivery", score: 58 },
  { name: "Conciseness", score: 62 },
  { name: "Relevance", score: 58 },
];

export const mockCalendarEvents: CalendarEvent[] = [
  { date: "2026-05-06", title: "Cafe", time: "9:00 AM" },
];

export const mockChecklist: PrepChecklist[] = [
  { company: "Amazon", role: "Senior Product Manager" },
  { company: "Amazon", role: "Senior Product Manager" },
  { company: "Amazon", role: "Senior Product Manager" },
];

export const mockReports: FeedbackReport[] = [
  { id: "1", title: "Product Manager", role: "Product Manager" },
  { id: "2", title: "Full Stack Developer", role: "Full Stack Developer" },
  { id: "3", title: "Backend Developer", role: "Backend Developer" },
  { id: "4", title: "Frontend Developer", role: "Frontend Developer" },
];

export const mockUser = {
  name: "John Apple",
  plan: "Free plan",
};
