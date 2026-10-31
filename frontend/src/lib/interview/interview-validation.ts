// Validation for the Start Interview Session form (Issue #51).
// Runs in the server action too, because a client-side check can be bypassed.
import type { InterviewMode, PracticeGoal, StartInterviewInput } from "@/types/interview";
import {
  EXPERIENCE_LEVELS,
  FOCUS_AREAS,
  INDUSTRIES,
  INTERVIEW_MODES,
  PRACTICE_GOALS,
  ROLE_LEVELS,
  optionValues,
} from "./interview-options";

export const TITLE_MAX_LENGTH = 100;
export const JOB_DESCRIPTION_MAX_LENGTH = 5000;

export type InterviewFieldErrors = Partial<Record<keyof StartInterviewInput, string>>;

// Raw values as they come out of FormData (string, File or null).
export interface RawStartInterview {
  goal: unknown;
  title: unknown;
  industry: unknown;
  roleLevel: unknown;
  experienceLevel: unknown;
  focusArea: unknown;
  mode: unknown;
  jobDescription: unknown;
}

export type StartInterviewValidation =
  | { ok: true; data: StartInterviewInput }
  | { ok: false; fieldErrors: InterviewFieldErrors };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateStartInterview(raw: RawStartInterview): StartInterviewValidation {
  const fieldErrors: InterviewFieldErrors = {};

  const goal = text(raw.goal);
  if (!PRACTICE_GOALS.includes(goal as PracticeGoal)) {
    fieldErrors.goal = "Choose a practice goal.";
  }

  const title = text(raw.title);
  if (!title) {
    fieldErrors.title = "Enter an interview name.";
  } else if (title.length > TITLE_MAX_LENGTH) {
    fieldErrors.title = `Keep the name under ${TITLE_MAX_LENGTH} characters.`;
  }

  const focusArea = text(raw.focusArea);
  if (!focusArea) {
    fieldErrors.focusArea = "Choose a focus area.";
  } else if (!optionValues(FOCUS_AREAS).includes(focusArea)) {
    fieldErrors.focusArea = "Choose one of the listed focus areas.";
  }

  const mode = text(raw.mode);
  if (!INTERVIEW_MODES.includes(mode as InterviewMode)) {
    fieldErrors.mode = "Choose a simulation mode.";
  }

  // Optional selects: empty is fine, but a value must be one we offered.
  const industry = text(raw.industry);
  if (industry && !optionValues(INDUSTRIES).includes(industry)) {
    fieldErrors.industry = "Choose one of the listed industries.";
  }
  const roleLevel = text(raw.roleLevel);
  if (roleLevel && !optionValues(ROLE_LEVELS).includes(roleLevel)) {
    fieldErrors.roleLevel = "Choose one of the listed role levels.";
  }
  const experienceLevel = text(raw.experienceLevel);
  if (experienceLevel && !optionValues(EXPERIENCE_LEVELS).includes(experienceLevel)) {
    fieldErrors.experienceLevel = "Choose one of the listed experience levels.";
  }

  const jobDescription = text(raw.jobDescription);
  if (jobDescription.length > JOB_DESCRIPTION_MAX_LENGTH) {
    fieldErrors.jobDescription = `Keep the job description under ${JOB_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const data: StartInterviewInput = {
    goal: goal as PracticeGoal,
    title,
    focusArea,
    mode: mode as InterviewMode,
  };
  if (industry) data.industry = industry;
  if (roleLevel) data.roleLevel = roleLevel;
  if (experienceLevel) data.experienceLevel = experienceLevel;
  if (jobDescription) data.jobDescription = jobDescription;

  return { ok: true, data };
}
