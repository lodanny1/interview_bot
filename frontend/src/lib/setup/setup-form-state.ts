// Shared contract between the Complete User Setup form and its server action.
import type { ExperienceLevel, FocusArea, SetupFieldErrors } from "./setup-validation";
import { POST_LOGIN_REDIRECT } from "@/lib/auth/login-form-state";

export interface SetupFormState {
  fieldErrors?: SetupFieldErrors;
  formError?: string;
  // Set when the session expired; the form shows a Sign In link.
  signInAgain?: boolean;
}

export type SetupAction = (
  prevState: SetupFormState,
  formData: FormData
) => Promise<SetupFormState>;

export const INITIAL_SETUP_FORM_STATE: SetupFormState = {};

// Values the form starts with: empty for a new user, the saved profile otherwise.
export interface SetupInitialValues {
  targetRole: string;
  experienceLevel: ExperienceLevel | "";
  focusAreas: FocusArea[];
  targetCompany: string;
  bio: string;
}

export const EMPTY_SETUP_VALUES: SetupInitialValues = {
  targetRole: "",
  experienceLevel: "",
  focusAreas: [],
  targetCompany: "",
  bio: "",
};

export const SETUP_ERROR_MESSAGES = {
  invalid: "Some of your information isn't valid. Please check it and try again.",
  unauthenticated: "Your session has expired. Please sign in again to finish setup.",
  unavailable:
    "We couldn't save your setup information right now. Your answers are still here, so please try again.",
} as const;

// Where the user goes after a successful setup (Scenario 1).
export const POST_SETUP_REDIRECT = POST_LOGIN_REDIRECT;

// app/setup/page.tsx. Signup redirects here (POST_SIGNUP_REDIRECT).
export const SETUP_PATH = "/setup";
