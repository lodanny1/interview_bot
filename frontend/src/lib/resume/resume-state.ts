// Shared types and messages for Upload Resume (Issue #06).
import type { ResumeErrorCode } from "./resume-validation";

// The saved resume's details. The file itself is at RESUME_FILE_URL.
export interface Resume {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

// JSON returned by the app's /api/resume routes.
export type ResumeApiResponse =
  | { resume: Resume | null }
  | { error: string; code: ResumeErrorCode | "unauthenticated" | "unavailable" };

export const RESUME_ERROR_MESSAGES = {
  unauthenticated: "Your session has expired. Please sign in again, then upload your resume.",
  uploadUnavailable:
    "We couldn't upload your resume right now. Your file is still selected, so please try again.",
  removeUnavailable: "We couldn't remove your resume right now. Please try again.",
  loadUnavailable:
    "We couldn't load your saved resume. You can still upload one below, or refresh the page to try again.",
} as const;

export const RESUME_NOTICES = {
  uploaded: "Resume uploaded. Interview Bot will use it to personalize your practice interviews.",
  removed: "Resume removed.",
} as const;

// app/(protected)/resume/page.tsx
export const RESUME_PATH = "/resume";
// app/api/resume/route.ts and app/api/resume/file/route.ts
export const RESUME_API_URL = "/api/resume";
export const RESUME_FILE_URL = "/api/resume/file";
