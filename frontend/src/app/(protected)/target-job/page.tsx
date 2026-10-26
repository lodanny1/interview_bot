// Add Target Job Description page (Issue #09). The user pastes a job posting so
// Interview Bot can prepare them for that specific position.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { TargetJobForm } from "@/components/target-job/TargetJobForm";
import { isMockMode, loadTargetJob } from "@/lib/target-job/target-job-api";
import { TARGET_JOB_ERROR_MESSAGES } from "@/lib/target-job/target-job-form-state";
import { removeTargetJobAction, saveTargetJobAction } from "./actions";

export const metadata: Metadata = {
  title: "Target Job - Phyyve",
};

export default async function TargetJobPage() {
  // Read the cookie first so Next.js renders this page per request.
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!idToken && !isMockMode()) {
    redirect("/login");
  }

  const loaded = await loadTargetJob(idToken ?? "mock-token");
  if (!loaded.ok && loaded.reason === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-3xl p-10">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-primary">Target job</h1>
        <p className="text-lg text-tertiary">
          Paste the job posting you&apos;re applying for. Interview Bot will use it to ask the
          questions that role is likely to ask and give feedback against its requirements.
        </p>
      </header>

      <TargetJobForm
        saveAction={saveTargetJobAction}
        removeAction={removeTargetJobAction}
        initialTargetJob={loaded.ok ? loaded.targetJob : null}
        loadError={loaded.ok ? undefined : TARGET_JOB_ERROR_MESSAGES.loadUnavailable}
      />
    </div>
  );
}
