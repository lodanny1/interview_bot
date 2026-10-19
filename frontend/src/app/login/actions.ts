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
  const validation = validateLogin({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
    };
  }

  const result = await signIn(
    validation.data.email,
    validation.data.password
  );

  if (!result.ok) {
    return {
      formError: LOGIN_ERROR_MESSAGES[result.reason],
    };
  }

  let user;

  try {
    user = await syncAuthenticatedUser(result.tokens.idToken);

    await createSession(result.tokens);
  } catch (error) {
    console.error("Login integration failed:", error);

    return {
      formError: LOGIN_ERROR_MESSAGES.service_unavailable,
    };
  }

  // Admins go directly to the admin dashboard.
  if (user.role === "ADMIN") {
    redirect("/admin/users");
  }

  // Normal users go to the regular dashboard.
  redirect(POST_LOGIN_REDIRECT);
}