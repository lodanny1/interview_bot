// Review Resume Information (Issue #08). Cleans up extracted resume data and
// validates the information a user confirms on the review page.
// The frontend has the same rules in
// frontend/src/lib/resume/resume-review-validation.ts; keep the two in sync.

const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  text: 150,
  date: 30,
  summary: 2000,
  bullet: 500,
  skills: 100,
  certifications: 50,
  technologies: 30,
  bullets: 20,
  entries: 30,
};

const PHONE_DIGITS = { min: 7, max: 15 };

const MESSAGES = {
  required: (label) => `${label} is required.`,
  tooLong: (label, max) => `${label} must be ${max} characters or fewer.`,
  itemTooLong: (noun, max) => `Each ${noun} must be ${max} characters or fewer.`,
  tooMany: (noun, max) => `List no more than ${max} ${noun}.`,
  email: "Enter a valid email address, like name@example.com.",
  phone: "Enter a valid phone number, like (555) 123-4567.",
  noContent:
    "Keep at least one skill, certification, or education, experience or project entry.",
};

const TEXT_RULES = {
  name: { label: "Name", required: true, max: LIMITS.name },
  email: { label: "Email", max: LIMITS.email },
  phone: { label: "Phone", max: LIMITS.phone },
  location: { label: "Location", max: LIMITS.text },
  summary: { label: "Summary", max: LIMITS.summary },
};

const BULLETS = {
  noun: "bullet points",
  single: "bullet point",
  maxItems: LIMITS.bullets,
  itemMax: LIMITS.bullet,
};

const LIST_RULES = {
  skills: {
    noun: "skills",
    single: "skill",
    maxItems: LIMITS.skills,
    itemMax: LIMITS.text,
  },
  certifications: {
    noun: "certifications",
    single: "certification",
    maxItems: LIMITS.certifications,
    itemMax: LIMITS.text,
  },
};

// Matches the entry shapes in the resume parser prompt (resume-parser.js).
const SECTIONS = {
  education: {
    noun: "education entries",
    text: {
      institution: { label: "Institution", required: true, max: LIMITS.text },
      degree: { label: "Degree", max: LIMITS.text },
      field: { label: "Field of study", max: LIMITS.text },
      startDate: { label: "Start date", max: LIMITS.date },
      endDate: { label: "End date", max: LIMITS.date },
    },
    lists: {},
  },
  experience: {
    noun: "experience entries",
    text: {
      company: { label: "Company", required: true, max: LIMITS.text },
      role: { label: "Role", required: true, max: LIMITS.text },
      startDate: { label: "Start date", max: LIMITS.date },
      endDate: { label: "End date", max: LIMITS.date },
    },
    lists: {
      description: BULLETS,
    },
  },
  projects: {
    noun: "projects",
    text: {
      name: { label: "Project name", required: true, max: LIMITS.text },
    },
    lists: {
      description: BULLETS,
      technologies: {
        noun: "technologies",
        single: "technology",
        maxItems: LIMITS.technologies,
        itemMax: LIMITS.text,
      },
    },
  },
};

// Sections that count as resume content. Contact details alone don't.
const CONTENT_FIELDS = [
  "skills",
  "certifications",
  "education",
  "experience",
  "projects",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Trimmed text, or null when empty. The AI sometimes returns numbers (a phone
// number or a year), so those become text too.
function cleanText(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") return null;

  return value.trim() || null;
}

// A list of non-empty strings. A single string becomes a one-item list.
function cleanList(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.map(cleanText).filter((item) => item !== null);
}

function cleanEntry(value, section) {
  if (!isPlainObject(value)) return null;

  const entry = {};

  for (const field of Object.keys(section.text)) {
    entry[field] = cleanText(value[field]);
  }

  for (const field of Object.keys(section.lists)) {
    entry[field] = cleanList(value[field]);
  }

  const empty = Object.values(entry).every((item) =>
    Array.isArray(item) ? item.length === 0 : item === null
  );

  return empty ? null : entry;
}

// Non-blank entries with their position in the original list. Blank entries
// are dropped: the parser prompt shows an all-null example entry, and the AI
// can echo it back.
function cleanEntries(value, section) {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => ({ index, entry: cleanEntry(raw, section) }))
    .filter(({ entry }) => entry !== null);
}

// Returns the cleaned resume data, or null when the value isn't a JSON object.
function normalizeResumeData(value) {
  if (!isPlainObject(value)) return null;

  const data = {};

  for (const field of Object.keys(TEXT_RULES)) {
    data[field] = cleanText(value[field]);
  }

  for (const field of Object.keys(LIST_RULES)) {
    data[field] = cleanList(value[field]);
  }

  for (const [name, section] of Object.entries(SECTIONS)) {
    data[name] = cleanEntries(value[name], section).map(({ entry }) => entry);
  }

  return data;
}

// True when the data has something an interview can use.
function hasResumeContent(data) {
  return Boolean(data) && CONTENT_FIELDS.some((field) => data[field].length > 0);
}

function isPhoneNumber(value) {
  if (!/^[\d\s()+.-]+$/.test(value)) return false;

  const digits = value.replace(/\D/g, "").length;
  return digits >= PHONE_DIGITS.min && digits <= PHONE_DIGITS.max;
}

function checkText(value, rule, key, fieldErrors) {
  if (value === null) {
    if (rule.required) fieldErrors[key] = MESSAGES.required(rule.label);
  } else if (value.length > rule.max) {
    fieldErrors[key] = MESSAGES.tooLong(rule.label, rule.max);
  }
}

function checkList(items, rule, key, fieldErrors) {
  if (items.length > rule.maxItems) {
    fieldErrors[key] = MESSAGES.tooMany(rule.noun, rule.maxItems);
  } else if (items.some((item) => item.length > rule.itemMax)) {
    fieldErrors[key] = MESSAGES.itemTooLong(rule.single, rule.itemMax);
  }
}

// Returns { ok: true, data } or { ok: false, fieldErrors }. Entry errors use
// the entry's position in the submitted list, e.g. "experience.1.role".
function validateResumeReview(body) {
  const input = isPlainObject(body) ? body : {};
  const data = normalizeResumeData(input);
  const fieldErrors = {};

  for (const [field, rule] of Object.entries(TEXT_RULES)) {
    checkText(data[field], rule, field, fieldErrors);
  }

  if (data.email && !fieldErrors.email && !EMAIL_PATTERN.test(data.email)) {
    fieldErrors.email = MESSAGES.email;
  }

  if (data.phone && !fieldErrors.phone && !isPhoneNumber(data.phone)) {
    fieldErrors.phone = MESSAGES.phone;
  }

  for (const [field, rule] of Object.entries(LIST_RULES)) {
    checkList(data[field], rule, field, fieldErrors);
  }

  for (const [name, section] of Object.entries(SECTIONS)) {
    const entries = cleanEntries(input[name], section);

    if (entries.length > LIMITS.entries) {
      fieldErrors[name] = MESSAGES.tooMany(section.noun, LIMITS.entries);
      continue;
    }

    for (const { index, entry } of entries) {
      for (const [field, rule] of Object.entries(section.text)) {
        checkText(entry[field], rule, `${name}.${index}.${field}`, fieldErrors);
      }

      for (const [field, rule] of Object.entries(section.lists)) {
        checkList(entry[field], rule, `${name}.${index}.${field}`, fieldErrors);
      }
    }
  }

  if (!hasResumeContent(data)) {
    fieldErrors.content = MESSAGES.noContent;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, data };
}

module.exports = {
  LIMITS,
  MESSAGES,
  normalizeResumeData,
  hasResumeContent,
  validateResumeReview,
};
