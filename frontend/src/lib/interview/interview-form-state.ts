// Shared form-state types and messages for the interview setup form.
// Kept out of the "use server" actions file because that file may only export async functions.
import type { InterviewFieldErrors } from "./interview-validation";

export const INTERVIEW_SETUP_PATH = "/interview/setup";
export const INTERVIEW_SESSION_PATH = "/interview/session";

export interface InterviewSetupFormState {
  formError?: string;
  fieldErrors?: InterviewFieldErrors;
  // True when the user's session expired; the form shows a "Sign in again" link.
  signInAgain?: boolean;
}

export const INITIAL_INTERVIEW_SETUP_STATE: InterviewSetupFormState = {};

export const INTERVIEW_ERROR_MESSAGES = {
  unauthenticated: "Your session has expired. Please sign in again to start an interview.",
  invalid: "Some interview details were rejected. Please check the highlighted fields.",
  startUnavailable: "We couldn't start your interview right now. Please try again in a moment.",
  sessionMissing: "We couldn't find an interview to open. Start a new one from the setup page.",
  sessionNotFound: "This interview session doesn't exist or is no longer available.",
  sessionUnavailable: "We couldn't load your interview right now. Please try again in a moment.",
} as const;
