// Interview setup page. Loads the user's saved resumes and target job on the
// server and passes them to the form's "Tailor Experience" section.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import InterviewSetupForm from "@/components/interview/InterviewSetupForm";
import { isMockMode, loadResumes } from "@/lib/resume/resume-api";
import { RESUME_ERROR_MESSAGES } from "@/lib/resume/resume-state";
import { loadTargetJob } from "@/lib/target-job/target-job-api";
import { TARGET_JOB_ERROR_MESSAGES } from "@/lib/target-job/target-job-form-state";
import {
  removeTargetJobAction,
  saveTargetJobAction,
} from "@/app/(protected)/target-job/actions";

export const metadata: Metadata = {
  title: "New Practice Interview - Phyyve",
};

export default async function InterviewSetupPage() {
  // Reading the session cookie makes this page render per request.
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!idToken && !isMockMode()) {
    redirect("/login");
  }

  const token = idToken ?? "mock-token";

  // Load both in parallel. One failing shouldn't block the other.
  const [resumes, targetJob] = await Promise.all([
    loadResumes(token),
    loadTargetJob(token),
  ]);

  if (
    (!resumes.ok && resumes.reason === "unauthenticated") ||
    (!targetJob.ok && targetJob.reason === "unauthenticated")
  ) {
    redirect("/login");
  }

  return (
    <InterviewSetupForm
      initialResumes={resumes.ok ? resumes.resumes : []}
      resumeLoadError={
        resumes.ok ? undefined : RESUME_ERROR_MESSAGES.loadUnavailable
      }
      initialTargetJob={targetJob.ok ? targetJob.targetJob : null}
      targetJobLoadError={
        targetJob.ok ? undefined : TARGET_JOB_ERROR_MESSAGES.loadUnavailable
      }
      saveTargetJobAction={saveTargetJobAction}
      removeTargetJobAction={removeTargetJobAction}
    />
  );
}
