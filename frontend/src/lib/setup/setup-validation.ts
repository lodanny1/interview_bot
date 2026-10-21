// Validation for the Complete User Setup form (Issue #05). Shared by the client
// form and the server action so both enforce the same rules. The backend has
// the same rules in backend/src/users/user-setup.js; keep the two in sync.

export const EXPERIENCE_LEVELS = [
  { value: "INTERN", label: "Intern / Student" },
  { value: "ENTRY", label: "Entry level (0–2 years)" },
  { value: "MID", label: "Mid level (3–5 years)" },
  { value: "SENIOR", label: "Senior (6+ years)" },
  { value: "LEAD", label: "Lead / Manager" },
] as const;

export const FOCUS_AREAS = [
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "SYSTEM_DESIGN", label: "System design" },
  { value: "PRODUCT", label: "Product / case" },
  { value: "LEADERSHIP", label: "Leadership" },
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["value"];
export type FocusArea = (typeof FOCUS_AREAS)[number]["value"];

export const SETUP_LIMITS = {
  targetRole: 100,
  targetCompany: 100,
  bio: 500,
} as const;

export interface SetupInput {
  targetRole: string;
  experienceLevel: ExperienceLevel;
  focusAreas: FocusArea[];
  // Optional fields.
  targetCompany: string;
  bio: string;
}

export type SetupFieldErrors = Partial<Record<keyof SetupInput, string>>;

export type SetupValidationResult =
  | { ok: true; data: SetupInput }
  | { ok: false; fieldErrors: SetupFieldErrors };

export const SETUP_VALIDATION_MESSAGES = {
  targetRoleRequired: "Target role is required.",
  targetRoleTooLong: `Target role must be ${SETUP_LIMITS.targetRole} characters or fewer.`,
  experienceLevelRequired: "Choose your experience level.",
  focusAreasRequired: "Choose at least one focus area.",
  focusAreasInvalid: "One of the focus areas isn't valid.",
  targetCompanyTooLong: `Company must be ${SETUP_LIMITS.targetCompany} characters or fewer.`,
  bioTooLong: `Keep this to ${SETUP_LIMITS.bio} characters or fewer.`,
} as const;

const EXPERIENCE_VALUES: readonly string[] = EXPERIENCE_LEVELS.map((l) => l.value);
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
  experienceLevel?: unknown;
  focusAreas?: unknown;
  targetCompany?: unknown;
  bio?: unknown;
}): SetupValidationResult {
  const targetRole = asString(input.targetRole);
  const experienceLevel = asString(input.experienceLevel);
  const focusAreas = asStringList(input.focusAreas);
  const targetCompany = asString(input.targetCompany);
  const bio = asString(input.bio);

  const fieldErrors: SetupFieldErrors = {};

  if (!targetRole) {
    fieldErrors.targetRole = SETUP_VALIDATION_MESSAGES.targetRoleRequired;
  } else if (targetRole.length > SETUP_LIMITS.targetRole) {
    fieldErrors.targetRole = SETUP_VALIDATION_MESSAGES.targetRoleTooLong;
  }

  if (!EXPERIENCE_VALUES.includes(experienceLevel)) {
    fieldErrors.experienceLevel = SETUP_VALIDATION_MESSAGES.experienceLevelRequired;
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

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      targetRole,
      experienceLevel: experienceLevel as ExperienceLevel,
      focusAreas: focusAreas as FocusArea[],
      targetCompany,
      bio,
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

export function parseExperienceLevel(
  value: string | null | undefined
): ExperienceLevel | "" {
  return value && EXPERIENCE_VALUES.includes(value) ? (value as ExperienceLevel) : "";
}
