"use server";

import { syncAuthenticatedUser } from "@/lib/auth/sync-user";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/cognito";
import { createSession } from "@/lib/auth/session-cookie";
import { validateLogin } from "@/lib/auth/login-validation";
import {
  LOGIN_ERROR_MESSAGES,
  POST_LOGIN_REDIRECT,
  type LoginFormState,
} from "@/lib/auth/login-form-state";

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // Validate again on the server; the client check can be bypassed.
  const validation = validateLogin({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!validation.ok) {
    return { fieldErrors: validation.fieldErrors };
  }

  const result = await signIn(validation.data.email, validation.data.password);
  if (!result.ok) {
    return { formError: LOGIN_ERROR_MESSAGES[result.reason] };
  }

  try {
  await syncAuthenticatedUser(result.tokens.idToken);
  await createSession(result.tokens);
  } catch (error) {
  console.error("Login integration failed:", error);
  return { formError: LOGIN_ERROR_MESSAGES.service_unavailable };
  }

  // redirect() throws to navigate, so it must stay outside the try/catch.
  redirect(POST_LOGIN_REDIRECT);
}
