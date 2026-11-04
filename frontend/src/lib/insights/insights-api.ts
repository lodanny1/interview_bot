// Server-side call to the backend for interview insights (Issue #16).
//   GET /me/interview-insights -> notes, coverage and sources for the saved target job
// With USE_MOCK_DATA=true (local frontend development), insights follow the
// mock target job instead of the backend.
import "server-only";

import { getMockTargetJob, isMockMode } from "@/lib/target-job/target-job-api";
import { mockInsightsFor } from "./insights-mock";
import { parseInsightsResponse, type InsightsSuccess } from "./insights-state";

export type LoadInsightsResult =
  | { ok: true; response: InsightsSuccess }
  | { ok: false; reason: "unauthenticated" | "unavailable" };

export async function loadInterviewInsights(idToken: string): Promise<LoadInsightsResult> {
  if (isMockMode()) {
    return { ok: true, response: mockInsightsFor(getMockTargetJob()) };
  }

  const base = process.env.BACKEND_URL;
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return { ok: false, reason: "unavailable" };
  }

  let response: Response;
  try {
    response = await fetch(`${base}/me/interview-insights`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
  } catch (error) {
    // Network failure or the backend is down.
    console.error("GET /me/interview-insights failed:", error);
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "unauthenticated" };
  }

  if (!response.ok) {
    // 503 means the saved target job couldn't be read; the job itself is fine.
    console.error(`Loading interview insights failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const parsed = parseInsightsResponse(await response.json().catch(() => null));
  if (!parsed) {
    console.error("Loading interview insights returned an unexpected response body.");
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, response: parsed };
}
