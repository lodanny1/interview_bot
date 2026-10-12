// Shared contract between the password reset form and its server action.
// Never carries the password back to the browser.
import type { ResetFieldErrors } from "./password-reset-validation";

// "request" = enter email, "confirm" = enter the emailed code + new password.
export type ResetStep = "request" | "confirm";

export interface ResetFormState {
  step: ResetStep;
  // The email the code was sent to (shown on the confirm step).
  email?: string;
  fieldErrors?: ResetFieldErrors;
  formError?: string;
  notice?: string;
}

export type ResetAction = (
  prevState: ResetFormState,
  formData: FormData
) => Promise<ResetFormState>;

export const INITIAL_RESET_FORM_STATE: ResetFormState = { step: "request" };

export const RESET_ERROR_MESSAGES = {
  invalid_code: "That code is invalid or has already been used. Request a new one.",
  expired_code: 'That code has expired. Select "Resend code" to get a new one.',
  invalid_password: "Password does not meet all of the requirements below.",
  too_many_attempts: "Too many attempts. Please wait a few minutes and try again.",
  request_unavailable: "We couldn't send a reset code right now. Please try again.",
  confirm_unavailable: "We couldn't reset your password right now. Please try again.",
} as const;

export const RESET_NOTICES = {
  // Same wording whether or not the account exists.
  codeSent: "If an account exists for this email, we sent a 6-digit code to it.",
  codeResent: "If an account exists for this email, we sent a new code.",
} as const;

// The login page shows a "Password updated" notice for this query value.
export const POST_RESET_REDIRECT = "/login?reset=success";
