import { NextResponse } from "next/server";

import { extractResume } from "@/lib/resume/resume-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

export async function POST(request: Request) {
  const token = await resumeSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        error: "Authentication required",
        code: "unauthenticated",
      },
      {
        status: 401,
      }
    );
  }

  const url = new URL(request.url);
  const resumeId = url.searchParams.get("id");

  if (!resumeId) {
    return NextResponse.json(
      {
        error: "Resume id is required",
        code: "missing_resume_id",
      },
      {
        status: 400,
      }
    );
  }

  const result = await extractResume(
    token,
    resumeId
  );

  if (result.ok) {
    return NextResponse.json(
      {
        resume: result.resume,
      },
      {
        status: 200,
      }
    );
  }

  switch (result.reason) {
    case "unauthenticated":
      return NextResponse.json(
        {
          error: "Authentication required",
          code: "unauthenticated",
        },
        {
          status: 401,
        }
      );

    case "not_found":
      return NextResponse.json(
        {
          error: "Resume not found",
          code: "not_found",
        },
        {
          status: 404,
        }
      );

    case "extraction_failed":
      return NextResponse.json(
        {
          error: "Unable to extract resume",
          code: "extraction_failed",
        },
        {
          status: 500,
        }
      );

    default:
      return NextResponse.json(
        {
          error: "Resume extraction service unavailable",
          code: "unavailable",
        },
        {
          status: 503,
        }
      );
  }
}
