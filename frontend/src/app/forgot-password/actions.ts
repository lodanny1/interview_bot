"use server";

import { redirect } from "next/navigation";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/lib/auth/cognito-password-reset";
import {
  validateNewPassword,
  validateResetEmail,
} from "@/lib/auth/password-reset-validation";
import {
  POST_RESET_REDIRECT,
  RESET_ERROR_MESSAGES,
  RESET_NOTICES,
  type ResetFormState,
} from "@/lib/auth/password-reset-form-state";

// One action handles every button on the form. The "intent" field says which:
//   "request" - send a code to the email
//   "confirm" - submit the code and new password
//   "resend"  - send a new code
export async function resetPasswordAction(
  _prevState: ResetFormState,
  formData: FormData
): Promise<ResetFormState> {
  const intent = formData.get("intent");
  if (intent === "confirm") return confirmStep(formData);
  return requestStep(formData, intent === "resend");
}

async function requestStep(
  formData: FormData,
  isResend: boolean
): Promise<ResetFormState> {
  const email = validateResetEmail(formData.get("email"));
  if (!email.ok) {
    return { step: "request", fieldErrors: { email: email.error } };
  }

  const result = await requestPasswordReset(email.email);
  if (!result.ok) {
    return {
      step: isResend ? "confirm" : "request",
      email: email.email,
      formError:
        result.reason === "too_many_attempts"
          ? RESET_ERROR_MESSAGES.too_many_attempts
          : RESET_ERROR_MESSAGES.request_unavailable,
    };
  }

  return {
    step: "confirm",
    email: email.email,
    notice: isResend ? RESET_NOTICES.codeResent : RESET_NOTICES.codeSent,
  };
}

async function confirmStep(formData: FormData): Promise<ResetFormState> {
  const email = validateResetEmail(formData.get("email"));
  if (!email.ok) {
    return { step: "request", fieldErrors: { email: email.error } };
  }

  // Validate again on the server; the client check can be bypassed.
  const validation = validateNewPassword({
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!validation.ok) {
    return { step: "confirm", email: email.email, fieldErrors: validation.fieldErrors };
  }

  const { code, password } = validation.data;
  const result = await confirmPasswordReset(email.email, code, password);
  if (!result.ok) {
    if (result.reason === "invalid_code" || result.reason === "expired_code") {
      return {
        step: "confirm",
        email: email.email,
        fieldErrors: { code: RESET_ERROR_MESSAGES[result.reason] },
      };
    }
    if (result.reason === "invalid_password") {
      return {
        step: "confirm",
        email: email.email,
        fieldErrors: { password: RESET_ERROR_MESSAGES.invalid_password },
      };
    }
    return {
      step: "confirm",
      email: email.email,
      formError:
        result.reason === "too_many_attempts"
          ? RESET_ERROR_MESSAGES.too_many_attempts
          : RESET_ERROR_MESSAGES.confirm_unavailable,
    };
  }

  // redirect() throws to navigate, so it must stay outside any try/catch.
  redirect(POST_RESET_REDIRECT);
}
