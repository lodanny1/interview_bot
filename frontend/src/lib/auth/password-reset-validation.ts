// Validation for the password reset form (Issue #04). Reuses the sign-up
// rules so the password requirements are the same everywhere.
import {
  SIGNUP_VALIDATION_MESSAGES,
  isValidEmail,
  meetsPasswordRules,
  validateConfirmationCode,
} from "./signup-validation";

export interface ResetFieldErrors {
  email?: string;
  code?: string;
  password?: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function validateResetEmail(
  email: unknown
): { ok: true; email: string } | { ok: false; error: string } {
  const value = asString(email).trim().toLowerCase();
  if (!value) {
    return { ok: false, error: SIGNUP_VALIDATION_MESSAGES.emailRequired };
  }
  if (!isValidEmail(value)) {
    return { ok: false, error: SIGNUP_VALIDATION_MESSAGES.emailInvalid };
  }
  return { ok: true, email: value };
}

export function validateNewPassword(input: {
  code?: unknown;
  password?: unknown;
}):
  | { ok: true; data: { code: string; password: string } }
  | { ok: false; fieldErrors: ResetFieldErrors } {
  const fieldErrors: ResetFieldErrors = {};

  const code = validateConfirmationCode(input.code);
  if (!code.ok) {
    fieldErrors.code = code.error;
  }

  // Passwords are passed through unchanged; whitespace-only counts as missing.
  const password = asString(input.password);
  if (!password.trim()) {
    fieldErrors.password = SIGNUP_VALIDATION_MESSAGES.passwordRequired;
  } else if (!meetsPasswordRules(password)) {
    fieldErrors.password = SIGNUP_VALIDATION_MESSAGES.passwordWeak;
  }

  if (!code.ok || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, data: { code: code.code, password } };
}
