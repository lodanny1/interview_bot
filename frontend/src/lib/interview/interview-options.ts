// Option lists shared by the setup form (labels) and the validation (allowed values).
// If the backend uses different enum values (e.g. "ENTRY" instead of "entry"),
// change them in ONE place: map them in toRequestBody() in interview-api.ts.
import type { InterviewMode, PracticeGoal } from "@/types/interview";

export interface Option {
  value: string;
  label: string;
}

export const PRACTICE_GOALS: PracticeGoal[] = ["general", "specific"];

export const INTERVIEW_MODES: InterviewMode[] = ["text", "voice", "avatar"];

export const INDUSTRIES: Option[] = [
  { value: "tech", label: "Technology" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "consulting", label: "Consulting" },
];

export const ROLE_LEVELS: Option[] = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

export const EXPERIENCE_LEVELS: Option[] = [
  { value: "0-1", label: "0–1 years" },
  { value: "1-3", label: "1–3 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "5-10", label: "5–10 years" },
  { value: "10+", label: "10+ years" },
];

export const FOCUS_AREAS: Option[] = [
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Technical" },
  { value: "system-design", label: "System Design" },
  { value: "leadership", label: "Leadership" },
  { value: "mixed", label: "Mixed" },
];

export function optionValues(options: Option[]): string[] {
  return options.map((o) => o.value);
}
