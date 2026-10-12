// Shared contract between the Create Account form and its server action.
// Never carries the password back to the browser.
import type { SignUpFieldErrors } from "./signup-validation";
import { POST_LOGIN_REDIRECT } from "./login-form-state";

// "details" = name/email/password form, "confirm" = enter the emailed code.
export type SignUpStep = "details" | "confirm";

export interface SignUpFormState {
  step: SignUpStep;
  // The email the code was sent to (shown on the confirm step).
  email?: string;
  fieldErrors?: SignUpFieldErrors;
  codeError?: string;
  formError?: string;
  // Non-error message, e.g. "We sent a new code."
  notice?: string;
  // The account exists but automatic sign-in failed; offer a Sign In link.
  signInInstead?: boolean;
}

export type SignUpAction = (
  prevState: SignUpFormState,
  formData: FormData
) => Promise<SignUpFormState>;

export const INITIAL_SIGNUP_FORM_STATE: SignUpFormState = { step: "details" };

export const SIGNUP_ERROR_MESSAGES = {
  email_taken: "An account with this email already exists.",
  invalid_password: "Password does not meet all of the requirements below.",
  invalid_details: "Some of your information isn't valid. Please check it and try again.",
  too_many_attempts: "Too many attempts. Please wait a few minutes and try again.",
  service_unavailable:
    "We couldn't create your account right now. Please try again.",
  invalid_code: "That code isn't correct. Check your email and try again.",
  expired_code: "That code has expired. Select \"Resend code\" to get a new one.",
  confirm_unavailable: "We couldn't verify your code right now. Please try again.",
  resend_unavailable: "We couldn't send a new code right now. Please try again.",
  sign_in_failed:
    "Your account is ready, but we couldn't sign you in automatically. Please sign in.",
} as const;

export const SIGNUP_NOTICES = {
  codeSent: "We sent a 6-digit code to your email.",
  codeResent: "We sent you a new code.",
} as const;

// New accounts land in the same place as a normal sign-in. When Complete User
// Setup (#05) exists, point this at the setup page instead.
export const POST_SIGNUP_REDIRECT = POST_LOGIN_REDIRECT;
