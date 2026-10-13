// Required-field validation for the login form. Shared by the client form and
// the server action so both enforce the same rules.

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export type LoginValidationResult =
  | { ok: true; data: LoginInput }
  | { ok: false; fieldErrors: LoginFieldErrors };

export const LOGIN_VALIDATION_MESSAGES = {
  emailRequired: "Email is required.",
  passwordRequired: "Password is required.",
} as const;

export function validateLogin(input: {
  email?: unknown;
  password?: unknown;
}): LoginValidationResult {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  // The password is passed through unchanged; whitespace-only counts as missing.
  const password = typeof input.password === "string" ? input.password : "";

  const fieldErrors: LoginFieldErrors = {};

  if (!email) {
    fieldErrors.email = LOGIN_VALIDATION_MESSAGES.emailRequired;
  }

  if (!password.trim()) {
    fieldErrors.password = LOGIN_VALIDATION_MESSAGES.passwordRequired;
  }

  if (fieldErrors.email || fieldErrors.password) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, data: { email, password } };
}
