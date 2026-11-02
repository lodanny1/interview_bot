// Review Resume Information page (Issue #08).
// Shows one resume's extracted information so the user can correct and
// confirm it.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { ResumeReview } from "@/components/resume/ResumeReview";
import { isMockMode } from "@/lib/resume/resume-api";
import { loadResumeReview } from "@/lib/resume/resume-review-api";
import { RESUME_REVIEW_MESSAGES } from "@/lib/resume/resume-review-state";
import { RESUME_PATH } from "@/lib/resume/resume-state";

export const metadata: Metadata = {
  title: "Review Resume - Phyyve",
};

export default async function ResumeReviewPage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const { resumeId } = await params;

  // Reading the session cookie makes this page render per request.
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!idToken && !isMockMode()) {
    redirect("/login");
  }

  const loaded = await loadResumeReview(idToken ?? "mock-token", resumeId);

  if (!loaded.ok && loaded.reason === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-3xl p-10">
      <Link
        href={RESUME_PATH}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:text-link-hover"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to resumes
      </Link>

      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-primary">
          Review Resume
        </h1>

        <p className="text-lg text-tertiary">
          Check what Interview Bot found in{" "}
          {loaded.ok ? (
            <span className="font-medium text-secondary">{loaded.review.fileName}</span>
          ) : (
            "your resume"
          )}{" "}
          and correct anything that&apos;s wrong, so your practice interviews
          use accurate information.
        </p>
      </header>

      {loaded.ok ? (
        <ResumeReview initialReview={loaded.review} />
      ) : (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-input-error bg-error-bg px-4 py-3 text-sm text-error-text"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {loaded.reason === "not_found"
              ? RESUME_REVIEW_MESSAGES.notFound
              : RESUME_REVIEW_MESSAGES.loadUnavailable}
          </p>
        </div>
      )}
    </div>
  );
}
