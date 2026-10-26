// Add Target Job Description (Issue #09). Validation for the target job form.
// The frontend has the same rules in
// frontend/src/lib/target-job/target-job-validation.ts; keep the two in sync.

const LIMITS = {
  jobTitle: 120,
  company: 120,
  descriptionMinChars: 50,
  descriptionMinWords: 15,
  descriptionMaxChars: 10000,
};

const MESSAGES = {
  jobTitleRequired: "Job title is required.",
  jobTitleTooLong: `Job title must be ${LIMITS.jobTitle} characters or fewer.`,
  companyTooLong: `Company must be ${LIMITS.company} characters or fewer.`,
  descriptionRequired: "Paste the job description.",
  descriptionIsLink:
    "That looks like a link. Paste the job description text instead.",
  descriptionTooShort:
    "That's too short to be a full job description. Paste the whole posting, including responsibilities and qualifications.",
  descriptionTooLong: `The job description must be ${LIMITS.descriptionMaxChars.toLocaleString("en-US")} characters or fewer. Remove extra sections like company benefits.`,
  descriptionUnreadable:
    "We couldn't read that as a job description. Paste the text from the job posting.",
};

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Windows line endings to \n, and no more than one blank line in a row.
function normalizeDescription(value) {
  return asTrimmedString(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function isOnlyLink(text) {
  return /^(https?:\/\/|www\.)\S+$/i.test(text);
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

// Mostly symbols or numbers (e.g. pasted binary or garbled text).
function looksUnreadable(text) {
  const visible = text.replace(/\s/g, "");
  const letters = (visible.match(/\p{L}/gu) || []).length;
  return visible.length > 0 && letters / visible.length < 0.5;
}

// Returns { ok: true, data } or { ok: false, fieldErrors }.
function validateTargetJob(body) {
  const input = body && typeof body === "object" ? body : {};

  const jobTitle = asTrimmedString(input.jobTitle);
  const company = asTrimmedString(input.company);
  const description = normalizeDescription(input.description);

  const fieldErrors = {};

  if (!jobTitle) {
    fieldErrors.jobTitle = MESSAGES.jobTitleRequired;
  } else if (jobTitle.length > LIMITS.jobTitle) {
    fieldErrors.jobTitle = MESSAGES.jobTitleTooLong;
  }

  if (company.length > LIMITS.company) {
    fieldErrors.company = MESSAGES.companyTooLong;
  }

  if (!description) {
    fieldErrors.description = MESSAGES.descriptionRequired;
  } else if (isOnlyLink(description)) {
    fieldErrors.description = MESSAGES.descriptionIsLink;
  } else if (description.length > LIMITS.descriptionMaxChars) {
    fieldErrors.description = MESSAGES.descriptionTooLong;
  } else if (looksUnreadable(description)) {
    fieldErrors.description = MESSAGES.descriptionUnreadable;
  } else if (
    description.length < LIMITS.descriptionMinChars ||
    countWords(description) < LIMITS.descriptionMinWords
  ) {
    fieldErrors.description = MESSAGES.descriptionTooShort;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      jobTitle,
      company: company || null,
      description,
    },
  };
}

module.exports = {
  LIMITS,
  MESSAGES,
  validateTargetJob,
};
