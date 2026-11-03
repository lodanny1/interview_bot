"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import {
  isInterviewMockMode,
  startInterviewSession,
} from "@/lib/interview/interview-api";
import { loadTargetJob } from "@/lib/target-job/target-job-api";
import {
  INTERVIEW_ERROR_MESSAGES,
  INTERVIEW_SESSION_PATH,
  type InterviewSetupFormState,
} from "@/lib/interview/interview-form-state";
import { validateStartInterview } from "@/lib/interview/interview-validation";

async function sessionToken(): Promise<string | null> {
  if (isInterviewMockMode()) return "mock-token";
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

const signInAgain: InterviewSetupFormState = {
  formError: INTERVIEW_ERROR_MESSAGES.unauthenticated,
  signInAgain: true,
};

export async function startInterviewAction(
  _prevState: InterviewSetupFormState,
  formData: FormData,
): Promise<InterviewSetupFormState> {
  const idToken = await sessionToken();
  if (!idToken) return signInAgain;

  // The job description now comes from the saved target job, not a form field.
  // If it can't be loaded, start without it instead of blocking the interview.
  const targetJob = await loadTargetJob(idToken);
  if (!targetJob.ok && targetJob.reason === "unauthenticated")
    return signInAgain;
  const jobDescription = targetJob.ok
    ? (targetJob.targetJob?.description ?? "")
    : "";

  // Validate again on the server; the client check can be bypassed.
  const validation = validateStartInterview({
    goal: formData.get("goal"),
    title: formData.get("title"),
    industry: formData.get("industry"),
    roleLevel: formData.get("roleLevel"),
    experienceLevel: formData.get("experienceLevel"),
    focusArea: formData.get("focusArea"),
    mode: formData.get("mode"),
    jobDescription,
    resumeId: formData.get("resumeId"),
  });
  if (!validation.ok) {
    return { fieldErrors: validation.fieldErrors };
  }

  const result = await startInterviewSession(idToken, validation.data);

  if (!result.ok) {
    if (result.reason === "unauthenticated") return signInAgain;
    if (result.reason === "invalid") {
      return {
        formError: INTERVIEW_ERROR_MESSAGES.invalid,
        fieldErrors: result.fieldErrors,
      };
    }
    return { formError: INTERVIEW_ERROR_MESSAGES.startUnavailable };
  }

  // redirect() works by throwing, so it must stay outside any try/catch.
  redirect(
    `${INTERVIEW_SESSION_PATH}?id=${encodeURIComponent(result.session.id)}`,
  );
}
