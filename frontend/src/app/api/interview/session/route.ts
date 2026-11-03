import { NextResponse } from "next/server";

import { loadInterviewSession } from "@/lib/interview/interview-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function GET(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const sessionId =
    new URL(request.url).searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Interview session id is required" },
      { status: 400 }
    );
  }

  const result = await loadInterviewSession(
    idToken,
    sessionId
  );

  if (result.ok) {
    return NextResponse.json(
      { session: result.session },
      { status: 200 }
    );
  }

  if (result.reason === "unauthenticated") {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (result.reason === "not-found") {
    return NextResponse.json(
      { error: "Interview session not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      error:
        "We couldn't load your interview right now.",
    },
    { status: 503 }
  );
}
