// Shared types and messages for Upload Resume (Issue #06).
import type { ResumeErrorCode } from "./resume-validation";

export interface Resume {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

// JSON returned by the app's /api/resume routes.
export type ResumeApiResponse =
  | { resumes: Resume[] }
  | { resume: Resume }
  | { success: true }
  | { error: string; code: ResumeErrorCode | "unauthenticated" | "unavailable" };

export const RESUME_ERROR_MESSAGES = {
  unauthenticated: "Your session has expired. Please sign in again, then upload your resume.",
  uploadUnavailable:
    "We couldn't upload your resume right now. Your file is still selected, so please try again.",
  removeUnavailable: "We couldn't remove your resume right now. Please try again.",
  loadUnavailable:
    "We couldn't load your saved resumes. You can still upload one below, or refresh the page to try again.",
} as const;

export const RESUME_NOTICES = {
  uploaded: "Resume uploaded. Interview Bot can use it to personalize your practice interviews.",
  removed: "Resume removed.",
} as const;

export const RESUME_PATH = "/resume";
export const RESUME_API_URL = "/api/resume";
export const RESUME_FILE_URL = "/api/resume/file";
