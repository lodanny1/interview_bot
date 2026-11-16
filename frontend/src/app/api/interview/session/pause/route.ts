import { NextResponse } from "next/server";

import { updateInterviewPause } from "@/lib/interview/interview-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const action = body?.action;

  if (!sessionId || (action !== "pause" && action !== "resume")) {
    return NextResponse.json(
      { error: "A session id and pause action are required" },
      { status: 400 },
    );
  }

  const result = await updateInterviewPause(idToken, sessionId, action);

  if (result.ok) {
    return NextResponse.json({ session: result.session });
  }

  if (result.reason === "unauthenticated") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (result.reason === "not-found") {
    return NextResponse.json(
      { error: "Interview session not found" },
      { status: 404 },
    );
  }
  if (result.reason === "inactive") {
    return NextResponse.json(
      { error: "Interview session is no longer available for that action" },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { error: "We couldn't update the interview pause state." },
    { status: 503 },
  );
}