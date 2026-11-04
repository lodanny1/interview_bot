// Role & Company Knowledge Retrieval (Issue #16).
//
//   GET /api/interview-insights -> insights for the signed-in user's saved target job
//
// The user is identified only by the session cookie; responses are private and
// never cached, because they describe one user's saved job.

import { NextResponse } from "next/server";

import { loadInterviewInsights } from "@/lib/insights/insights-api";
import { insightsSessionToken } from "@/lib/insights/insights-session";
import { INSIGHTS_MESSAGES, type InsightsResponse } from "@/lib/insights/insights-state";

function json(body: InsightsResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

const unauthenticated = () =>
  json({ status: "error", code: "unauthenticated", error: INSIGHTS_MESSAGES.unauthenticated }, 401);

export async function GET() {
  const idToken = await insightsSessionToken();

  if (!idToken) {
    return unauthenticated();
  }

  const result = await loadInterviewInsights(idToken);

  if (result.ok) {
    return json(result.response);
  }

  if (result.reason === "unauthenticated") {
    return unauthenticated();
  }

  return json(
    { status: "error", code: "service_unavailable", error: INSIGHTS_MESSAGES.serviceUnavailable },
    503
  );
}
