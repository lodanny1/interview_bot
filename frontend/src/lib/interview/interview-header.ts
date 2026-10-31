// Builds the session header's subtitle line from what the user chose on the setup form.
// Focus Area is always there (required). Industry, Role Level and Experience Level are
// added only if the user filled them in, in the same order as the form.
import type { ActiveInterviewSession } from "@/types/interview";
import {
  EXPERIENCE_LEVELS,
  FOCUS_AREAS,
  INDUSTRIES,
  ROLE_LEVELS,
  optionLabel,
} from "./interview-options";

export const INTERVIEWER_LABEL = "AI Interviewer";
export const SUBTITLE_SEPARATOR = " • ";

type HeaderFields = Pick<
  ActiveInterviewSession,
  "focusArea" | "industry" | "roleLevel" | "experienceLevel"
>;

export function sessionSubtitleParts(session: HeaderFields): string[] {
  const parts: string[] = [];
  if (session.focusArea) parts.push(optionLabel(FOCUS_AREAS, session.focusArea));
  if (session.industry) parts.push(optionLabel(INDUSTRIES, session.industry));
  if (session.roleLevel) parts.push(optionLabel(ROLE_LEVELS, session.roleLevel));
  if (session.experienceLevel) {
    parts.push(optionLabel(EXPERIENCE_LEVELS, session.experienceLevel));
  }
  parts.push(INTERVIEWER_LABEL);
  return parts;
}

export function sessionSubtitle(session: HeaderFields): string {
  return sessionSubtitleParts(session).join(SUBTITLE_SEPARATOR);
}
