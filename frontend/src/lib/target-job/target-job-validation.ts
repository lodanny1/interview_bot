// Validation for the Add Target Job Description form (Issue #09). Shared by
// the client form and the server action so both enforce the same rules. The
// backend has the same rules in backend/src/target-jobs/target-job-validation.js;
// keep the two in sync.

export const TARGET_JOB_LIMITS = {
  jobTitle: 120,
  company: 120,
  descriptionMinChars: 50,
  descriptionMinWords: 15,
  descriptionMaxChars: 10000,
} as const;

export interface TargetJobInput {
  jobTitle: string;
  // Optional; empty string when not given.
  company: string;
  description: string;
}

export type TargetJobFieldErrors = Partial<Record<keyof TargetJobInput, string>>;

export type TargetJobValidationResult =
  | { ok: true; data: TargetJobInput }
  | { ok: false; fieldErrors: TargetJobFieldErrors };

export const TARGET_JOB_VALIDATION_MESSAGES = {
  jobTitleRequired: "Job title is required.",
  jobTitleTooLong: `Job title must be ${TARGET_JOB_LIMITS.jobTitle} characters or fewer.`,
  companyTooLong: `Company must be ${TARGET_JOB_LIMITS.company} characters or fewer.`,
  descriptionRequired: "Paste the job description.",
  descriptionIsLink: "That looks like a link. Paste the job description text instead.",
  descriptionTooShort:
    "That's too short to be a full job description. Paste the whole posting, including responsibilities and qualifications.",
  descriptionTooLong: `The job description must be ${TARGET_JOB_LIMITS.descriptionMaxChars.toLocaleString("en-US")} characters or fewer. Remove extra sections like company benefits.`,
  descriptionUnreadable:
    "We couldn't read that as a job description. Paste the text from the job posting.",
} as const;

const MSG = TARGET_JOB_VALIDATION_MESSAGES;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Windows line endings to \n, and no more than one blank line in a row.
export function normalizeDescription(value: unknown): string {
  return asTrimmedString(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function isOnlyLink(text: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(text);
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Mostly symbols or numbers (e.g. pasted binary or garbled text).
function looksUnreadable(text: string): boolean {
  const visible = text.replace(/\s/g, "");
  const letters = (visible.match(/\p{L}/gu) ?? []).length;
  return visible.length > 0 && letters / visible.length < 0.5;
}

export function validateTargetJob(input: {
  jobTitle?: unknown;
  company?: unknown;
  description?: unknown;
}): TargetJobValidationResult {
  const jobTitle = asTrimmedString(input.jobTitle);
  const company = asTrimmedString(input.company);
  const description = normalizeDescription(input.description);

  const fieldErrors: TargetJobFieldErrors = {};

  if (!jobTitle) {
    fieldErrors.jobTitle = MSG.jobTitleRequired;
  } else if (jobTitle.length > TARGET_JOB_LIMITS.jobTitle) {
    fieldErrors.jobTitle = MSG.jobTitleTooLong;
  }

  if (company.length > TARGET_JOB_LIMITS.company) {
    fieldErrors.company = MSG.companyTooLong;
  }

  if (!description) {
    fieldErrors.description = MSG.descriptionRequired;
  } else if (isOnlyLink(description)) {
    fieldErrors.description = MSG.descriptionIsLink;
  } else if (description.length > TARGET_JOB_LIMITS.descriptionMaxChars) {
    fieldErrors.description = MSG.descriptionTooLong;
  } else if (looksUnreadable(description)) {
    fieldErrors.description = MSG.descriptionUnreadable;
  } else if (
    description.length < TARGET_JOB_LIMITS.descriptionMinChars ||
    countWords(description) < TARGET_JOB_LIMITS.descriptionMinWords
  ) {
    fieldErrors.description = MSG.descriptionTooShort;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, data: { jobTitle, company, description } };
}
