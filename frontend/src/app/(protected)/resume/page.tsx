// Upload Resume page (Issue #06).
// Users may save multiple resumes for different interview targets.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { isMockMode, loadResumes } from "@/lib/resume/resume-api";
import { RESUME_ERROR_MESSAGES } from "@/lib/resume/resume-state";

export const metadata: Metadata = {
  title: "Resume - Phyyve",
};

export default async function ResumePage() {
  // Reading the session cookie makes this page render per request.
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!idToken && !isMockMode()) {
    redirect("/login");
  }

  const loaded = await loadResumes(idToken ?? "mock-token");

  if (!loaded.ok && loaded.reason === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-3xl p-10">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-primary">
          Resumes
        </h1>

        <p className="text-lg text-tertiary">
          Save resumes for different roles so Interview Bot can personalize
          each practice interview to the experience you want to highlight.
        </p>
      </header>

      <ResumeUpload
        initialResumes={loaded.ok ? loaded.resumes : []}
        loadError={
          loaded.ok
            ? undefined
            : RESUME_ERROR_MESSAGES.loadUnavailable
        }
      />
    </div>
  );
}
