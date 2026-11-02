import { NextResponse } from "next/server";

import { loadInterviewHistory } from "@/lib/interview/interview-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function GET() {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const result =
    await loadInterviewHistory(idToken);

  if (result.ok) {
    return NextResponse.json({
      sessions: result.sessions,
    });
  }

  if (result.reason === "unauthenticated") {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      error:
        "We couldn't load your interview history.",
    },
    { status: 503 }
  );
}
