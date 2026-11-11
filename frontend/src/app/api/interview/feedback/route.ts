// Generate Feedback Report (Issue #30).
//   GET  /api/interview/feedback?id=<sessionId>  -> saved report state
//   POST /api/interview/feedback { sessionId }    -> generate or retry the report
import { NextResponse } from "next/server";

import {
  generateFeedbackReport,
  loadFeedbackReport,
  type FeedbackResult,
} from "@/lib/feedback/feedback-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

function toResponse(result: FeedbackResult) {
  if (result.ok) {
    return NextResponse.json({ feedback: result.feedback }, { status: result.status });
  }

  switch (result.reason) {
    case "unauthenticated":
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    case "not-found":
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    case "not-completed":
      return NextResponse.json(
        { error: "Finish the interview before generating feedback" },
        { status: 409 }
      );
    default:
      return NextResponse.json(
        { error: "We couldn't load your feedback report right now." },
        { status: 503 }
      );
  }
}

export async function GET(request: Request) {
  const idToken = await resumeSessionToken();
  if (!idToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Interview session id is required" }, { status: 400 });
  }

  return toResponse(await loadFeedbackReport(idToken, sessionId));
}

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();
  if (!idToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "Interview session id is required" }, { status: 400 });
  }

  return toResponse(await generateFeedbackReport(idToken, sessionId));
}
