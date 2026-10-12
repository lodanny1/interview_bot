// Shared contract between the logout button and the logout server action.

export interface LogoutFormState {
  formError?: string;
}

export const INITIAL_LOGOUT_FORM_STATE: LogoutFormState = {};

export const LOGOUT_ERROR_MESSAGE =
  "We couldn't log you out right now. Please try again.";

export const POST_LOGOUT_REDIRECT = "/login";
