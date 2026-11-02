// Review Resume Information (Issue #08).
//
//   PUT /api/resume/review?id=<id>   -> save the information the user confirmed
//
// The review page loads a resume's review on the server, so there is no GET.

import { NextResponse } from "next/server";

import { saveResumeReview } from "@/lib/resume/resume-review-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";

import {
  RESUME_REVIEW_MESSAGES,
  type ResumeReviewApiResponse,
} from "@/lib/resume/resume-review-state";

import {
  validateResumeReview,
  type ResumeReviewFieldErrors,
} from "@/lib/resume/resume-review-validation";

function json(body: ResumeReviewApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

const invalid = (fieldErrors: ResumeReviewFieldErrors) =>
  json(
    {
      error: RESUME_REVIEW_MESSAGES.invalid,
      code: "invalid",
      fieldErrors,
    },
    400
  );

export async function PUT(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return json(
      {
        error: RESUME_REVIEW_MESSAGES.unauthenticated,
        code: "unauthenticated",
      },
      401
    );
  }

  const resumeId = new URL(request.url).searchParams.get("id");

  if (!resumeId) {
    return json(
      {
        error: "Resume id is required.",
        code: "missing_resume_id",
      },
      400
    );
  }

  const body = await request.json().catch(() => null);
  const validation = validateResumeReview(body);

  if (!validation.ok) {
    return invalid(validation.fieldErrors);
  }

  const result = await saveResumeReview(idToken, resumeId, validation.data);

  if (result.ok) {
    return json({ review: result.review });
  }

  switch (result.reason) {
    case "unauthenticated":
      return json(
        {
          error: RESUME_REVIEW_MESSAGES.unauthenticated,
          code: "unauthenticated",
        },
        401
      );

    case "invalid":
      return invalid(result.fieldErrors);

    case "not_found":
      return json(
        {
          error: RESUME_REVIEW_MESSAGES.notFound,
          code: "not_found",
        },
        404
      );

    case "not_extracted":
      return json(
        {
          error: RESUME_REVIEW_MESSAGES.notExtracted,
          code: "not_extracted",
        },
        409
      );

    default:
      return json(
        {
          error: RESUME_REVIEW_MESSAGES.saveUnavailable,
          code: "unavailable",
        },
        503
      );
  }
}
