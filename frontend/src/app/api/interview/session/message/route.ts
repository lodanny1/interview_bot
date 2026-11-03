import { NextResponse } from "next/server";

import { sendInterviewMessage } from "@/lib/interview/interview-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        sessionId?: unknown;
        content?: unknown;
      }
    | null;

  const sessionId =
    typeof body?.sessionId === "string"
      ? body.sessionId.trim()
      : "";

  const content =
    typeof body?.content === "string"
      ? body.content.trim()
      : "";

  if (!sessionId) {
    return NextResponse.json(
      { error: "Interview session id is required" },
      { status: 400 }
    );
  }

  if (!content) {
    return NextResponse.json(
      { error: "Response content is required" },
      { status: 400 }
    );
  }

  const result = await sendInterviewMessage(
    idToken,
    sessionId,
    content
  );

  if (result.ok) {
    return NextResponse.json(
      {
        messages: result.messages,
        completed: result.completed,
        completionReason:
          result.completionReason,
      },
      { status: 201 }
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

  if (result.reason === "inactive") {
    return NextResponse.json(
      { error: "Interview session is not active" },
      { status: 409 }
    );
  }

  if (result.reason === "invalid") {
    return NextResponse.json(
      { error: "Response content is invalid" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error:
        "We couldn't submit your response right now.",
    },
    { status: 503 }
  );
}
