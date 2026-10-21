// Complete User Setup (Issue #05). Validation and the "setup complete" rule
// for the setup form. The frontend has the same rules in
// frontend/src/lib/setup/setup-validation.ts; keep the two in sync.

const EXPERIENCE_LEVELS = ["INTERN", "ENTRY", "MID", "SENIOR", "LEAD"];

const FOCUS_AREAS = [
  "BEHAVIORAL",
  "TECHNICAL",
  "SYSTEM_DESIGN",
  "PRODUCT",
  "LEADERSHIP",
];

const LIMITS = {
  targetRole: 100,
  targetCompany: 100,
  bio: 500,
};

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Returns { ok: true, data } or { ok: false, fieldErrors }.
// focusAreas is stored as a comma-separated string, e.g. "BEHAVIORAL,TECHNICAL".
function validateUserSetup(body) {
  const input = body && typeof body === "object" ? body : {};

  const targetRole = asTrimmedString(input.targetRole);
  const experienceLevel = asTrimmedString(input.experienceLevel);
  const targetCompany = asTrimmedString(input.targetCompany);
  const bio = asTrimmedString(input.bio);
  const focusAreas = Array.isArray(input.focusAreas)
    ? [...new Set(input.focusAreas.map(asTrimmedString).filter(Boolean))]
    : [];

  const fieldErrors = {};

  if (!targetRole) {
    fieldErrors.targetRole = "Target role is required.";
  } else if (targetRole.length > LIMITS.targetRole) {
    fieldErrors.targetRole = `Target role must be ${LIMITS.targetRole} characters or fewer.`;
  }

  if (!EXPERIENCE_LEVELS.includes(experienceLevel)) {
    fieldErrors.experienceLevel = "Choose your experience level.";
  }

  if (focusAreas.length === 0) {
    fieldErrors.focusAreas = "Choose at least one focus area.";
  } else if (!focusAreas.every((area) => FOCUS_AREAS.includes(area))) {
    fieldErrors.focusAreas = "One of the focus areas isn't valid.";
  }

  if (targetCompany.length > LIMITS.targetCompany) {
    fieldErrors.targetCompany = `Company must be ${LIMITS.targetCompany} characters or fewer.`;
  }

  if (bio.length > LIMITS.bio) {
    fieldErrors.bio = `Keep this to ${LIMITS.bio} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      targetRole,
      experienceLevel,
      focusAreas: focusAreas.join(","),
      targetCompany: targetCompany || null,
      bio: bio || null,
    },
  };
}

// A user has completed setup once every required field is saved.
// Signup can save a target role on its own, so that alone doesn't count.
function isSetupComplete(profile) {
  return Boolean(
    profile &&
      profile.target_role &&
      profile.experience_level &&
      profile.focus_areas
  );
}

module.exports = {
  EXPERIENCE_LEVELS,
  FOCUS_AREAS,
  validateUserSetup,
  isSetupComplete,
};
