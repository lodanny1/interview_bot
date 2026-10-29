"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { validateTargetJob } from "@/lib/target-job/target-job-validation";
import {
  isMockMode,
  removeTargetJob,
  saveTargetJob,
} from "@/lib/target-job/target-job-api";
import {
  TARGET_JOB_ERROR_MESSAGES,
  TARGET_JOB_NOTICES,
  TARGET_JOB_PATH,
  type TargetJobFormState,
} from "@/lib/target-job/target-job-form-state";

async function sessionToken(): Promise<string | null> {
  if (isMockMode()) return "mock-token";
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

const signInAgain: TargetJobFormState = {
  formError: TARGET_JOB_ERROR_MESSAGES.unauthenticated,
  signInAgain: true,
};

export async function saveTargetJobAction(
  _prevState: TargetJobFormState,
  formData: FormData
): Promise<TargetJobFormState> {
  // Validate again on the server; the client check can be bypassed.
  const validation = validateTargetJob({
    jobTitle: formData.get("jobTitle"),
    company: formData.get("company"),
    description: formData.get("description"),
  });
  if (!validation.ok) {
    return { fieldErrors: validation.fieldErrors };
  }

  const idToken = await sessionToken();
  if (!idToken) return signInAgain;

  const result = await saveTargetJob(idToken, validation.data);

  if (!result.ok) {
    if (result.reason === "unauthenticated") return signInAgain;
    if (result.reason === "invalid") {
      return { formError: TARGET_JOB_ERROR_MESSAGES.invalid, fieldErrors: result.fieldErrors };
    }
    return { formError: TARGET_JOB_ERROR_MESSAGES.saveUnavailable };
  }

  revalidatePath(TARGET_JOB_PATH);
  return { targetJob: result.targetJob, notice: TARGET_JOB_NOTICES.saved };
}

// Takes no form fields, so it ignores the (prevState, formData) arguments.
export async function removeTargetJobAction(): Promise<TargetJobFormState> {
  const idToken = await sessionToken();
  if (!idToken) return signInAgain;

  const result = await removeTargetJob(idToken);

  if (!result.ok) {
    if (result.reason === "unauthenticated") return signInAgain;
    return { formError: TARGET_JOB_ERROR_MESSAGES.removeUnavailable };
  }

  revalidatePath(TARGET_JOB_PATH);
  return { targetJob: null, notice: TARGET_JOB_NOTICES.removed };
}
