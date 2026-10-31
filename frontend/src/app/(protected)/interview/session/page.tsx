import { cookies } from "next/headers";
import Link from "next/link";
import InterviewSession from "@/components/interview/InterviewSession";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { isInterviewMockMode, loadInterviewSession } from "@/lib/interview/interview-api";
import {
  INTERVIEW_ERROR_MESSAGES,
  INTERVIEW_SETUP_PATH,
} from "@/lib/interview/interview-form-state";

// Server component: loads the session by ?id= so it survives a refresh (Scenario 3).
// The interactive UI lives in components/interview/InterviewSession.tsx (client).

function SessionNotice({ message, signIn = false }: { message: string; signIn?: boolean }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div
        role="alert"
        className="w-full rounded-lg border border-input-error bg-error-bg px-4 py-3 text-sm text-error-text"
      >
        {message}
      </div>
      <div className="flex items-center gap-4 text-sm font-medium">
        {signIn && (
          <Link href="/login" className="text-link hover:text-link-hover">
            Sign in again
          </Link>
        )}
        <Link href={INTERVIEW_SETUP_PATH} className="text-link hover:text-link-hover">
          Back to interview setup
        </Link>
      </div>
    </div>
  );
}

export default async function InterviewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  const sessionId = typeof id === "string" ? id.trim() : "";
  if (!sessionId) {
    return <SessionNotice message={INTERVIEW_ERROR_MESSAGES.sessionMissing} />;
  }

  const idToken = isInterviewMockMode()
    ? "mock-token"
    : ((await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null);
  if (!idToken) {
    return <SessionNotice message={INTERVIEW_ERROR_MESSAGES.unauthenticated} signIn />;
  }

  const result = await loadInterviewSession(idToken, sessionId);
  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      return <SessionNotice message={INTERVIEW_ERROR_MESSAGES.unauthenticated} signIn />;
    }
    if (result.reason === "not-found") {
      return <SessionNotice message={INTERVIEW_ERROR_MESSAGES.sessionNotFound} />;
    }
    return <SessionNotice message={INTERVIEW_ERROR_MESSAGES.sessionUnavailable} />;
  }

  // key resets client state if the user navigates to a different session id.
  return <InterviewSession key={result.session.id} session={result.session} />;
}