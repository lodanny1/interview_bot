"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { validateSetup } from "@/lib/setup/setup-validation";
import { saveUserSetup } from "@/lib/setup/user-setup-api";
import {
  POST_SETUP_REDIRECT,
  SETUP_ERROR_MESSAGES,
  type SetupFormState,
} from "@/lib/setup/setup-form-state";

export async function completeSetupAction(
  _prevState: SetupFormState,
  formData: FormData
): Promise<SetupFormState> {
  // Validate again on the server; the client check can be bypassed (Scenario 2).
  const validation = validateSetup({
    targetRole: formData.get("targetRole"),
    experienceLevel: formData.get("experienceLevel"),
    focusAreas: formData.getAll("focusAreas"),
    targetCompany: formData.get("targetCompany"),
    bio: formData.get("bio"),
  });
  if (!validation.ok) {
    return { fieldErrors: validation.fieldErrors };
  }

  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!idToken) {
    return { formError: SETUP_ERROR_MESSAGES.unauthenticated, signInAgain: true };
  }

  const result = await saveUserSetup(idToken, validation.data);

  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      return { formError: SETUP_ERROR_MESSAGES.unauthenticated, signInAgain: true };
    }
    if (result.reason === "invalid") {
      return { formError: SETUP_ERROR_MESSAGES.invalid, fieldErrors: result.fieldErrors };
    }
    // Service unavailable: stay on the page so the user can retry (Scenario 4).
    return { formError: SETUP_ERROR_MESSAGES.unavailable };
  }

  // redirect() throws to navigate, so it must stay outside any try/catch.
  redirect(POST_SETUP_REDIRECT);
}
