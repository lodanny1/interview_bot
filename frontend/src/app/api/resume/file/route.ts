// Upload Resume (Issue #06).
//
// GET /api/resume/file?id=<resumeId>
// Add ?download=1 to download instead of opening inline.

import { NextResponse } from "next/server";

import { fetchResumeFile } from "@/lib/resume/resume-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function GET(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const resumeId = url.searchParams.get("id");
  const download = url.searchParams.get("download") === "1";

  if (!resumeId) {
    return NextResponse.json(
      { error: "Resume id is required" },
      { status: 400 }
    );
  }

  const result = await fetchResumeFile(
    idToken,
    resumeId,
    download
  );

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "unauthenticated"
          ? 401
          : 503;

    const error =
      result.reason === "not_found"
        ? "Resume not found"
        : result.reason === "unauthenticated"
          ? "Not authenticated"
          : "We couldn't open your resume right now. Please try again.";

    return NextResponse.json(
      { error },
      { status }
    );
  }

  const headers = new Headers(result.headers);

  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(
    result.body as BodyInit,
    {
      status: 200,
      headers,
    }
  );
}
