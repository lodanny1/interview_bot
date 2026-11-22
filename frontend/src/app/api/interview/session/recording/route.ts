import { NextResponse } from "next/server";

import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const sessionId = requestUrl.searchParams.get("sessionId")?.trim();
  const questionMessageId =
    requestUrl.searchParams.get("questionMessageId")?.trim();

  if (!sessionId || !questionMessageId) {
    return NextResponse.json(
      { error: "Interview and question IDs are required" },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.startsWith("audio/webm") && !contentType.startsWith("audio/mp4")) {
    return NextResponse.json(
      { error: "Unsupported audio format" },
      { status: 415 },
    );
  }

  const audio = await request.arrayBuffer();

  if (audio.byteLength === 0) {
    return NextResponse.json(
      { error: "Audio recording is required" },
      { status: 400 },
    );
  }

  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json(
      { error: "Interview service is unavailable" },
      { status: 503 },
    );
  }

  try {
    const backendResponse = await fetch(
      `${backendUrl}/interviews/${encodeURIComponent(sessionId)}/recordings?questionMessageId=${encodeURIComponent(questionMessageId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": contentType,
        },
        body: audio,
        cache: "no-store",
      },
    );

    const result = await backendResponse.json().catch(() => ({
      error: "Unable to upload recording",
    }));

    return NextResponse.json(result, { status: backendResponse.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the interview service" },
      { status: 503 },
    );
  }
}