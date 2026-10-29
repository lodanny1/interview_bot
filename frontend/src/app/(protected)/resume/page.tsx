// Upload Resume page (Issue #06). The user uploads a PDF or Word resume so
// Interview Bot can personalize interviews using their experience.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { isMockMode, loadResume } from "@/lib/resume/resume-api";
import { RESUME_ERROR_MESSAGES } from "@/lib/resume/resume-state";

export const metadata: Metadata = {
  title: "Resume - Phyyve",
};

export default async function ResumePage() {
  // Read the cookie first so Next.js renders this page per request.
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!idToken && !isMockMode()) {
    redirect("/login");
  }

  const loaded = await loadResume(idToken ?? "mock-token");
  if (!loaded.ok && loaded.reason === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-3xl p-10">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-primary">Resume</h1>
        <p className="text-lg text-tertiary">
          Upload your resume so Interview Bot can ask about your own projects and experience,
          and tailor feedback to your background.
        </p>
      </header>

      <ResumeUpload
        initialResume={loaded.ok ? loaded.resume : null}
        loadError={loaded.ok ? undefined : RESUME_ERROR_MESSAGES.loadUnavailable}
      />
    </div>
  );
}
