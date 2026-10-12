// Validation for the Create Account form (Issue #01). Shared by the client
// form and the server action so both enforce the same rules.

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  // Optional. Kept for the profile once the database (#41) exists.
  targetRole: string;
  agreeTerms: boolean;
}

export type SignUpFieldErrors = Partial<Record<keyof SignUpInput, string>>;

export type SignUpValidationResult =
  | { ok: true; data: SignUpInput }
  | { ok: false; fieldErrors: SignUpFieldErrors };

export const SIGNUP_VALIDATION_MESSAGES = {
  nameRequired: "Name is required.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email address, like name@example.com.",
  passwordRequired: "Password is required.",
  passwordWeak: "Password does not meet all of the requirements below.",
  termsRequired: "Please agree to the Terms of Service and Privacy Policy.",
  codeRequired: "Enter the 6-digit code from your email.",
  codeInvalid: "The code must be 6 digits.",
} as const;

// Matches Cognito's default password policy, so the form catches weak
// passwords before Cognito rejects them.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "lower", label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "number", label: "A number", test: (p: string) => /[0-9]/.test(p) },
  {
    id: "symbol",
    label: "A symbol (like ! @ # $)",
    test: (p: string) => /[^A-Za-z0-9\s]/.test(p),
  },
] as const;

// Simple shape check: something@something.something, no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function meetsPasswordRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Accepts true, or the "on"/"true" a checkbox sends in FormData.
function asChecked(value: unknown): boolean {
  return value === true || value === "on" || value === "true";
}

// How many password rules are met, for the strength bar.
export function passwordStrength(password: string): {
  met: number;
  total: number;
  label: "" | "Weak" | "Fair" | "Good" | "Strong";
} {
  const total = PASSWORD_RULES.length;
  const met = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  if (!password) return { met: 0, total, label: "" };
  if (met === total) return { met, total, label: "Strong" };
  if (met >= 4) return { met, total, label: "Good" };
  if (met >= 3) return { met, total, label: "Fair" };
  return { met, total, label: "Weak" };
}

export function validateSignUp(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  targetRole?: unknown;
  agreeTerms?: unknown;
}): SignUpValidationResult {
  const name = asString(input.name).trim();
  const email = asString(input.email).trim().toLowerCase();
  // Passwords are passed through unchanged; whitespace-only counts as missing.
  const password = asString(input.password);
  const targetRole = asString(input.targetRole).trim();
  const agreeTerms = asChecked(input.agreeTerms);

  const fieldErrors: SignUpFieldErrors = {};

  if (!name) {
    fieldErrors.name = SIGNUP_VALIDATION_MESSAGES.nameRequired;
  }

  if (!email) {
    fieldErrors.email = SIGNUP_VALIDATION_MESSAGES.emailRequired;
  } else if (!isValidEmail(email)) {
    fieldErrors.email = SIGNUP_VALIDATION_MESSAGES.emailInvalid;
  }

  if (!password.trim()) {
    fieldErrors.password = SIGNUP_VALIDATION_MESSAGES.passwordRequired;
  } else if (!meetsPasswordRules(password)) {
    fieldErrors.password = SIGNUP_VALIDATION_MESSAGES.passwordWeak;
  }

  if (!agreeTerms) {
    fieldErrors.agreeTerms = SIGNUP_VALIDATION_MESSAGES.termsRequired;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, data: { name, email, password, targetRole, agreeTerms } };
}

// Verification codes from Cognito emails are 6 digits.
export function validateConfirmationCode(
  code: unknown
): { ok: true; code: string } | { ok: false; error: string } {
  const value = asString(code).replace(/\s/g, "");
  if (!value) {
    return { ok: false, error: SIGNUP_VALIDATION_MESSAGES.codeRequired };
  }
  if (!/^\d{6}$/.test(value)) {
    return { ok: false, error: SIGNUP_VALIDATION_MESSAGES.codeInvalid };
  }
  return { ok: true, code: value };
}
