// Shared contract between the login form and the login server action.
// Contains no AWS-specific code and never carries the password or email.
import type { SignInFailureReason } from "./cognito";
import type { LoginFieldErrors } from "./login-validation";

export interface LoginFormState {
  fieldErrors?: LoginFieldErrors;
  formError?: string;
}

export type LoginAction = (
  prevState: LoginFormState,
  formData: FormData
) => Promise<LoginFormState>;

export const INITIAL_LOGIN_FORM_STATE: LoginFormState = {};

export const LOGIN_ERROR_MESSAGES: Record<SignInFailureReason, string> = {
  invalid_credentials: "Incorrect email or password.",
  account_action_required:
    "This account cannot sign in yet. Please contact support or complete the required account action.",
  service_unavailable: "We couldn't complete sign in right now. Please try again.",
};

// "/" is the current dashboard URL: app/(dashboard)/page.tsx, where the route
// group adds no URL segment. The login acceptance criterion names /dashboard,
// which does not exist yet; update this constant if the dashboard moves.
export const POST_LOGIN_REDIRECT = "/";
