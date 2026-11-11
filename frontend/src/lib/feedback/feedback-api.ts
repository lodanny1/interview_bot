// Server-side calls to the backend for Generate Feedback Report (Issue #30).
//   GET  /interviews/:id/feedback  -> saved report state
//   POST /interviews/:id/feedback  -> generate (or retry) the report
import "server-only";

import { parseFeedbackResponse, type InterviewFeedback } from "./feedback-state";

export type FeedbackResult =
  | { ok: true; status: 200 | 202; feedback: InterviewFeedback }
  | { ok: false; reason: "unauthenticated" | "not-found" | "not-completed" | "unavailable" };

function backendUrl(): string | null {
  return process.env.BACKEND_URL || null;
}

async function callFeedback(
  idToken: string,
  sessionId: string,
  method: "GET" | "POST"
): Promise<FeedbackResult> {
  const base = backendUrl();
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await fetch(`${base}/interviews/${encodeURIComponent(sessionId)}/feedback`, {
      method,
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthenticated" };
    }
    if (response.status === 404) return { ok: false, reason: "not-found" };
    if (response.status === 409) return { ok: false, reason: "not-completed" };

    if (response.status !== 200 && response.status !== 202) {
      console.error(`Feedback report ${method} failed with status ${response.status}`);
      return { ok: false, reason: "unavailable" };
    }

    const feedback = parseFeedbackResponse(await response.json().catch(() => null));
    if (!feedback) {
      console.error(`Feedback report ${method} returned an unexpected response body.`);
      return { ok: false, reason: "unavailable" };
    }

    return { ok: true, status: response.status, feedback };
  } catch (error) {
    console.error(`Feedback report ${method} failed:`, error);
    return { ok: false, reason: "unavailable" };
  }
}

export function loadFeedbackReport(idToken: string, sessionId: string) {
  return callFeedback(idToken, sessionId, "GET");
}

export function generateFeedbackReport(idToken: string, sessionId: string) {
  return callFeedback(idToken, sessionId, "POST");
}
