// Validation for the Complete User Setup form (Issue #05). Shared by the client
// form and the server action so both enforce the same rules. The backend has
// the same rules in backend/src/users/user-setup.js; keep the two in sync.
//
// The "Target job" section (job title = target role, company = target
// company, job description) is saved as a target job when a description is
// given, so its description follows the Target Jobs page's rules.

import {
  TARGET_JOB_LIMITS,
  validateTargetJob,
} from "@/lib/target-job/target-job-validation";

export const FOCUS_AREAS = [
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "SYSTEM_DESIGN", label: "System design" },
  { value: "PRODUCT", label: "Product / case" },
  { value: "LEADERSHIP", label: "Leadership" },
] as const;

export type FocusArea = (typeof FOCUS_AREAS)[number]["value"];

export const SETUP_LIMITS = {
  targetRole: 100,
  targetCompany: 100,
  // Long text boxes share one limit across the app.
  bio: 10000,
  jobDescription: TARGET_JOB_LIMITS.descriptionMaxChars,
} as const;

export interface SetupInput {
  targetRole: string;
  focusAreas: FocusArea[];
  // Optional fields.
  targetCompany: string;
  bio: string;
  // Saved as a target job when given.
  jobDescription: string;
}

export type SetupFieldErrors = Partial<Record<keyof SetupInput, string>>;

export type SetupValidationResult =
  | { ok: true; data: SetupInput }
  | { ok: false; fieldErrors: SetupFieldErrors };

export const SETUP_VALIDATION_MESSAGES = {
  targetRoleRequired: "Target role is required.",
  targetRoleTooLong: `Target role must be ${SETUP_LIMITS.targetRole} characters or fewer.`,
  focusAreasRequired: "Choose at least one focus area.",
  focusAreasInvalid: "One of the focus areas isn't valid.",
  targetCompanyTooLong: `Company must be ${SETUP_LIMITS.targetCompany} characters or fewer.`,
  bioTooLong: `Keep this to ${SETUP_LIMITS.bio.toLocaleString("en-US")} characters or fewer.`,
} as const;

const FOCUS_VALUES: readonly string[] = FOCUS_AREAS.map((a) => a.value);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Accepts an array (client) or the repeated values FormData.getAll returns.
function asStringList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(asString).filter(Boolean))];
}

export function validateSetup(input: {
  targetRole?: unknown;
  focusAreas?: unknown;
  targetCompany?: unknown;
  bio?: unknown;
  jobDescription?: unknown;
}): SetupValidationResult {
  const targetRole = asString(input.targetRole);
  const focusAreas = asStringList(input.focusAreas);
  const targetCompany = asString(input.targetCompany);
  const bio = asString(input.bio);
  const jobDescription = asString(input.jobDescription);

  const fieldErrors: SetupFieldErrors = {};

  if (!targetRole) {
    fieldErrors.targetRole = SETUP_VALIDATION_MESSAGES.targetRoleRequired;
  } else if (targetRole.length > SETUP_LIMITS.targetRole) {
    fieldErrors.targetRole = SETUP_VALIDATION_MESSAGES.targetRoleTooLong;
  }

  if (focusAreas.length === 0) {
    fieldErrors.focusAreas = SETUP_VALIDATION_MESSAGES.focusAreasRequired;
  } else if (!focusAreas.every((area) => FOCUS_VALUES.includes(area))) {
    fieldErrors.focusAreas = SETUP_VALIDATION_MESSAGES.focusAreasInvalid;
  }

  if (targetCompany.length > SETUP_LIMITS.targetCompany) {
    fieldErrors.targetCompany = SETUP_VALIDATION_MESSAGES.targetCompanyTooLong;
  }

  if (bio.length > SETUP_LIMITS.bio) {
    fieldErrors.bio = SETUP_VALIDATION_MESSAGES.bioTooLong;
  }

  // Optional, but when given it must be a usable job description.
  if (jobDescription) {
    const job = validateTargetJob({ jobTitle: targetRole, company: targetCompany, description: jobDescription });
    if (!job.ok && job.fieldErrors.description) {
      fieldErrors.jobDescription = job.fieldErrors.description;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      targetRole,
      focusAreas: focusAreas as FocusArea[],
      targetCompany,
      bio,
      jobDescription,
    },
  };
}

// The backend stores focus areas as "BEHAVIORAL,TECHNICAL". Unknown values are
// dropped so an old or hand-edited row can't break the form.
export function parseFocusAreas(value: string | null | undefined): FocusArea[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is FocusArea => FOCUS_VALUES.includes(part));
}
