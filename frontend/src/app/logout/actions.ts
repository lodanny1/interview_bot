"use server";

import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/auth/session-cookie";
import {
  LOGOUT_ERROR_MESSAGE,
  POST_LOGOUT_REDIRECT,
  type LogoutFormState,
} from "@/lib/auth/logout-form-state";

// useActionState passes the previous state, but logout does not need it.
export async function logoutAction(): Promise<LogoutFormState> {
  try {
    await deleteSession();
  } catch {
    // Stay on the page and keep the session so the user can retry.
    return { formError: LOGOUT_ERROR_MESSAGE };
  }

  // redirect() throws to navigate, so it must stay outside the try/catch.
  redirect(POST_LOGOUT_REDIRECT);
}
