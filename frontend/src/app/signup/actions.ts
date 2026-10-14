"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/cognito";
import {
  confirmSignUp,
  resendConfirmationCode,
  signUp,
} from "@/lib/auth/cognito-signup";
import { createSession } from "@/lib/auth/session-cookie";
import {
  validateConfirmationCode,
  validateSignUp,
} from "@/lib/auth/signup-validation";
import {
  POST_SIGNUP_REDIRECT,
  SIGNUP_ERROR_MESSAGES,
  SIGNUP_NOTICES,
  type SignUpFormState,
  type SignUpStep,
} from "@/lib/auth/signup-form-state";

// One action handles every button on the form. The "intent" field says which:
//   "create"  - submit name/email/password
//   "confirm" - submit the emailed 6-digit code
//   "resend"  - send a new code
export async function signUpAction(
  _prevState: SignUpFormState,
  formData: FormData
): Promise<SignUpFormState> {
  const intent = formData.get("intent");
  if (intent === "confirm") return confirmStep(formData);
  if (intent === "resend") return resendStep(formData);
  return createStep(formData);
}

async function createStep(formData: FormData): Promise<SignUpFormState> {
  // Validate again on the server; the client check can be bypassed.
  const validation = validateSignUp({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    targetRole: formData.get("targetRole"),
    agreeTerms: formData.get("agreeTerms"),
  });
  if (!validation.ok) {
    return { step: "details", fieldErrors: validation.fieldErrors };
  }

  // targetRole is validated but not sent to Cognito: it belongs in the user's
  // profile, which gets saved once the application database (#41) exists.
  const { name, email, password } = validation.data;
  const result = await signUp(name, email, password);

  if (!result.ok) {
    if (result.reason === "email_taken") {
      return {
        step: "details",
        fieldErrors: { email: SIGNUP_ERROR_MESSAGES.email_taken },
      };
    }
    if (result.reason === "invalid_password") {
      return {
        step: "details",
        fieldErrors: { password: SIGNUP_ERROR_MESSAGES.invalid_password },
      };
    }
    return { step: "details", formError: SIGNUP_ERROR_MESSAGES[result.reason] };
  }

  // Most user pools require email verification first.
  if (!result.confirmed) {
    return { step: "confirm", email, notice: SIGNUP_NOTICES.codeSent };
  }

  return signInAndRedirect(email, password, "details");
}

async function confirmStep(formData: FormData): Promise<SignUpFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const code = validateConfirmationCode(formData.get("code"));
  if (!code.ok) {
    return { step: "confirm", email, codeError: code.error };
  }

  const result = await confirmSignUp(email, code.code);
  if (!result.ok) {
    if (result.reason === "invalid_code" || result.reason === "expired_code") {
      return { step: "confirm", email, codeError: SIGNUP_ERROR_MESSAGES[result.reason] };
    }
    if (result.reason === "too_many_attempts") {
      return { step: "confirm", email, formError: SIGNUP_ERROR_MESSAGES.too_many_attempts };
    }
    return { step: "confirm", email, formError: SIGNUP_ERROR_MESSAGES.confirm_unavailable };
  }

  return signInAndRedirect(email, password, "confirm");
}

async function resendStep(formData: FormData): Promise<SignUpFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const result = await resendConfirmationCode(email);
  if (!result.ok) {
    return {
      step: "confirm",
      email,
      formError:
        result.reason === "too_many_attempts"
          ? SIGNUP_ERROR_MESSAGES.too_many_attempts
          : SIGNUP_ERROR_MESSAGES.resend_unavailable,
    };
  }
  return { step: "confirm", email, notice: SIGNUP_NOTICES.codeResent };
}

// The account exists at this point. Sign in with the same password so the
// user lands in the app already logged in (Scenario 1).
async function signInAndRedirect(
  email: string,
  password: string,
  step: SignUpStep
): Promise<SignUpFormState> {
  const result = await signIn(email, password);
  if (!result.ok) {
    return {
      step,
      email,
      formError: SIGNUP_ERROR_MESSAGES.sign_in_failed,
      signInInstead: true,
    };
  }

  try {
    await createSession(result.tokens);
  } catch {
    return {
      step,
      email,
      formError: SIGNUP_ERROR_MESSAGES.sign_in_failed,
      signInInstead: true,
    };
  }

  // redirect() throws to navigate, so it must stay outside the try/catch.
  redirect(POST_SIGNUP_REDIRECT);
}
