// Shared contract between the target job form and its server actions (Issue #09).
import type { TargetJobFieldErrors } from "./target-job-validation";

// What the page shows as the saved target job.
export interface TargetJob {
  jobTitle: string;
  company: string | null;
  description: string;
  updatedAt: string;
}

export interface TargetJobFormState {
  // The saved job after a successful save, or null after it's removed.
  targetJob?: TargetJob | null;
  fieldErrors?: TargetJobFieldErrors;
  formError?: string;
  notice?: string;
  // Set when the session expired; the form shows a Sign In link.
  signInAgain?: boolean;
}

export type TargetJobAction = (
  prevState: TargetJobFormState,
  formData: FormData
) => Promise<TargetJobFormState>;

export const TARGET_JOB_ERROR_MESSAGES = {
  invalid: "Some of the job information isn't valid. Please check it and try again.",
  unauthenticated: "Your session has expired. Please sign in again, then paste the job description.",
  saveUnavailable:
    "We couldn't save the job description right now. Your text is still here, so please try again.",
  removeUnavailable: "We couldn't remove the job description right now. Please try again.",
  loadUnavailable:
    "We couldn't load your saved job description. You can still add one below, or refresh the page to try again.",
} as const;

export const TARGET_JOB_NOTICES = {
  saved: "Saved. Interview Bot will use this job description to prepare your practice interviews.",
  removed: "Job description removed.",
} as const;

// app/(protected)/target-job/page.tsx
export const TARGET_JOB_PATH = "/target-job";
