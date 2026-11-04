// Server-side backend calls for Review Resume Information (Issue #08).
//
// Backend contract:
//   GET /me/resumes/:resumeId/review
//   PUT /me/resumes/:resumeId/review

import "server-only";

import {
  findMockResume,
  isMockMode,
  type MockResume,
} from "./resume-api";

import {
  RESUME_REVIEW_STATUSES,
  toResumeReview,
  type ResumeReview,
} from "./resume-review-state";

import {
  normalizeResumeData,
  type ResumeData,
  type ResumeReviewFieldErrors,
} from "./resume-review-validation";

type Failure = "unauthenticated" | "not_found" | "unavailable";

export type LoadResumeReviewResult =
  | { ok: true; review: ResumeReview }
  | { ok: false; reason: Failure };

export type SaveResumeReviewResult =
  | { ok: true; review: ResumeReview }
  | { ok: false; reason: Failure | "not_extracted" }
  | { ok: false; reason: "invalid"; fieldErrors: ResumeReviewFieldErrors };

async function request(
  method: "GET" | "PUT",
  idToken: string,
  resumeId: string,
  body?: ResumeData
): Promise<Response | null> {
  const base = process.env.BACKEND_URL;

  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return null;
  }

  const path = `/me/resumes/${encodeURIComponent(resumeId)}/review`;

  try {
    return await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    // Network failure or the backend is down.
    console.error(`${method} ${path} failed:`, error);
    return null;
  }
}

function isAuthFailure(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

// Checks the backend's review JSON. Returns null when it can't be shown.
function toReview(value: unknown): ResumeReview | null {
  const review = value as Partial<ResumeReview> | null;

  if (
    !review ||
    typeof review.resumeId !== "string" ||
    typeof review.fileName !== "string" ||
    !RESUME_REVIEW_STATUSES.includes(review.status as ResumeReview["status"])
  ) {
    return null;
  }

  const data = normalizeResumeData(review.data);
  const hasData = review.status === "ready" || review.status === "reviewed";

  if (hasData && !data) return null;

  return {
    resumeId: review.resumeId,
    fileName: review.fileName,
    status: review.status as ResumeReview["status"],
    data: hasData ? data : null,
    reviewedAt:
      review.status === "reviewed" && typeof review.reviewedAt === "string"
        ? review.reviewedAt
        : null,
  };
}

async function readReview(response: Response): Promise<ResumeReview | null> {
  const body = (await response.json().catch(() => null)) as {
    review?: unknown;
  } | null;

  return toReview(body?.review);
}

function mockReview(item: MockResume): ResumeReview {
  return toResumeReview({
    resumeId: item.resume.id,
    fileName: item.resume.fileName,
    parseStatus: item.extraction?.parseStatus ?? "PENDING",
    parsedJson: item.extraction?.parsedJson,
    reviewedJson: item.review?.reviewedJson,
    reviewedAt: item.review?.reviewedAt,
  });
}

export async function loadResumeReview(
  idToken: string,
  resumeId: string
): Promise<LoadResumeReviewResult> {
  if (isMockMode()) {
    const item = findMockResume(resumeId);

    return item
      ? { ok: true, review: mockReview(item) }
      : { ok: false, reason: "not_found" };
  }

  const response = await request("GET", idToken, resumeId);

  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (response.status === 404) return { ok: false, reason: "not_found" };

  if (!response.ok) {
    console.error(`Loading resume review failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const review = await readReview(response);

  return review ? { ok: true, review } : { ok: false, reason: "unavailable" };
}

// `data` must already have passed validateResumeReview.
export async function saveResumeReview(
  idToken: string,
  resumeId: string,
  data: ResumeData
): Promise<SaveResumeReviewResult> {
  if (isMockMode()) {
    const item = findMockResume(resumeId);

    if (!item) return { ok: false, reason: "not_found" };

    if (item.extraction?.parseStatus !== "COMPLETED") {
      return { ok: false, reason: "not_extracted" };
    }

    item.review = {
      reviewedJson: data,
      reviewedAt: new Date().toISOString(),
    };

    return { ok: true, review: mockReview(item) };
  }

  const response = await request("PUT", idToken, resumeId, data);

  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (response.status === 409) return { ok: false, reason: "not_extracted" };

  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as {
      fieldErrors?: unknown;
    } | null;

    const fieldErrors =
      body && body.fieldErrors && typeof body.fieldErrors === "object"
        ? (body.fieldErrors as ResumeReviewFieldErrors)
        : {};

    return { ok: false, reason: "invalid", fieldErrors };
  }

  if (!response.ok) {
    console.error(`Saving resume review failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const review = await readReview(response);

  return review ? { ok: true, review } : { ok: false, reason: "unavailable" };
}
