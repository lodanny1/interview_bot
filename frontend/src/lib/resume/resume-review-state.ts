// Shared types and messages for Review Resume Information (Issue #08).
import {
  RESUME_SECTIONS,
  hasResumeContent,
  normalizeResumeData,
  type ResumeData,
  type ResumeReviewFieldErrors,
  type ResumeSectionName,
} from "./resume-review-validation";

// not_extracted: the resume hasn't been extracted yet.
// processing:    extraction is running (or stopped before finishing).
// failed:        extraction failed or produced nothing usable.
// ready:         extracted information is ready to review.
// reviewed:      the user has confirmed the information.
export type ResumeReviewStatus =
  | "not_extracted"
  | "processing"
  | "failed"
  | "ready"
  | "reviewed";

export const RESUME_REVIEW_STATUSES: readonly ResumeReviewStatus[] = [
  "not_extracted",
  "processing",
  "failed",
  "ready",
  "reviewed",
];

export interface ResumeReview {
  resumeId: string;
  fileName: string;
  status: ResumeReviewStatus;
  // The confirmed information once reviewed, otherwise the extracted
  // information. Null unless the status is ready or reviewed.
  data: ResumeData | null;
  reviewedAt: string | null;
}

export type ResumeReviewErrorCode =
  | "unauthenticated"
  | "missing_resume_id"
  | "not_found"
  | "not_extracted"
  | "invalid"
  | "unavailable";

// JSON returned by /api/resume/review.
export type ResumeReviewApiResponse =
  | { review: ResumeReview }
  | {
      error: string;
      code: ResumeReviewErrorCode;
      fieldErrors?: ResumeReviewFieldErrors;
    };

export const RESUME_REVIEW_MESSAGES = {
  unauthenticated:
    "Your session has expired. Please sign in again, then review your resume.",
  notFound: "We couldn't find that resume. It may have been removed.",
  loadUnavailable:
    "We couldn't load this resume's information right now. Refresh the page to try again.",
  extractFailed:
    "We couldn't get usable information from this resume. Try again, or upload a text-based PDF or Word (.docx) version of it.",
  notExtracted:
    "This resume's information isn't ready to confirm. Refresh the page and try again.",
  saveUnavailable:
    "We couldn't save your review right now. Your changes are still here, so please try again.",
  invalid:
    "Some information is missing or invalid. Fix the highlighted fields, then try again.",
} as const;

export const RESUME_REVIEW_NOTICES = {
  confirmed: "Resume information confirmed.",
} as const;

export const RESUME_REVIEW_API_URL = "/api/resume/review";
export const RESUME_EXTRACT_API_URL = "/api/resume/extract";

export function resumeReviewPath(resumeId: string): string {
  return `/resume/${encodeURIComponent(resumeId)}/review`;
}

// Builds the review from a resume's stored extraction and review fields. The
// backend does the same in resume-review-routes.js; this copy is for mock mode
// and for a fresh extraction in the browser.
export function toResumeReview({
  resumeId,
  fileName,
  parseStatus,
  parsedJson,
  reviewedJson,
  reviewedAt,
}: {
  resumeId: string;
  fileName: string;
  parseStatus: unknown;
  parsedJson?: unknown;
  reviewedJson?: unknown;
  reviewedAt?: string | null;
}): ResumeReview {
  const review = { resumeId, fileName, data: null, reviewedAt: null };

  switch (parseStatus) {
    case "PENDING":
      return { ...review, status: "not_extracted" };
    case "PROCESSING":
      return { ...review, status: "processing" };
    case "COMPLETED":
      break;
    default:
      return { ...review, status: "failed" };
  }

  if (reviewedAt && reviewedJson) {
    return {
      ...review,
      status: "reviewed",
      data: normalizeResumeData(reviewedJson),
      reviewedAt,
    };
  }

  const data = normalizeResumeData(parsedJson);

  return hasResumeContent(data)
    ? { ...review, status: "ready", data }
    : { ...review, status: "failed" };
}

// Review form values. List fields are edited as text, one item per line.
export type ResumeFormEntry = { key: string } & Record<string, string>;

export interface ResumeFormValues {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string;
  certifications: string;
  education: ResumeFormEntry[];
  experience: ResumeFormEntry[];
  projects: ResumeFormEntry[];
}

const SECTION_NAMES = Object.keys(RESUME_SECTIONS) as ResumeSectionName[];

// React keys for entries, so removing one keeps the others' inputs intact.
let nextEntryKey = 0;

function toFormEntries(
  section: ResumeSectionName,
  entries: object[]
): ResumeFormEntry[] {
  const rules = RESUME_SECTIONS[section];

  return entries.map((entry) => {
    const values = entry as Record<string, string | null | string[]>;
    const formEntry: ResumeFormEntry = { key: `entry-${nextEntryKey++}` };

    for (const field of Object.keys(rules.text)) {
      formEntry[field] = (values[field] as string | null) ?? "";
    }

    for (const field of Object.keys(rules.lists)) {
      formEntry[field] = ((values[field] as string[]) ?? []).join("\n");
    }

    return formEntry;
  });
}

export function toFormValues(data: ResumeData): ResumeFormValues {
  return {
    name: data.name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    location: data.location ?? "",
    summary: data.summary ?? "",
    skills: data.skills.join("\n"),
    certifications: data.certifications.join("\n"),
    education: toFormEntries("education", data.education),
    experience: toFormEntries("experience", data.experience),
    projects: toFormEntries("projects", data.projects),
  };
}

// The request body for the form's values; validateResumeReview cleans it up.
export function fromFormValues(values: ResumeFormValues): Record<string, unknown> {
  const lines = (text: string) => text.split("\n");

  const body: Record<string, unknown> = {
    name: values.name,
    email: values.email,
    phone: values.phone,
    location: values.location,
    summary: values.summary,
    skills: lines(values.skills),
    certifications: lines(values.certifications),
  };

  for (const section of SECTION_NAMES) {
    const rules = RESUME_SECTIONS[section];

    body[section] = values[section].map((entry) => {
      const result: Record<string, string | string[]> = {};

      for (const field of Object.keys(rules.text)) {
        result[field] = entry[field] ?? "";
      }

      for (const field of Object.keys(rules.lists)) {
        result[field] = lines(entry[field] ?? "");
      }

      return result;
    });
  }

  return body;
}
