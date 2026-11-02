import { NextResponse } from "next/server";

import { completeInterviewSession } from "@/lib/interview/interview-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = await request
    .json()
    .catch(() => null);

  const sessionId =
    typeof body?.sessionId === "string"
      ? body.sessionId.trim()
      : "";

  const reason =
    body?.reason === "ABANDONED"
      ? "ABANDONED"
      : body?.reason === "TIME_LIMIT"
        ? "TIME_LIMIT"
        : "USER_ENDED";

  if (!sessionId) {
    return NextResponse.json(
      {
        error:
          "Interview session id is required",
      },
      { status: 400 }
    );
  }

  const result =
    await completeInterviewSession(
      idToken,
      sessionId,
      reason
    );

  if (result.ok) {
    return NextResponse.json(result);
  }

  if (result.reason === "unauthenticated") {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (result.reason === "not-found") {
    return NextResponse.json(
      {
        error:
          "Interview session not found",
      },
      { status: 404 }
    );
  }

  if (result.reason === "inactive") {
    return NextResponse.json(
      {
        error:
          "Interview session is not active",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      error:
        "We couldn't complete the interview right now.",
    },
    { status: 503 }
  );
}
