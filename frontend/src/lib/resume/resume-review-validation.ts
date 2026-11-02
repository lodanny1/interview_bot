// Validation for Review Resume Information (Issue #08). Shared by the review
// form and the /api/resume/review route. The backend has the same rules in
// backend/src/resumes/resume-review-validation.js; keep the two in sync.

export const RESUME_REVIEW_LIMITS = {
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
} as const;

const LIMITS = RESUME_REVIEW_LIMITS;

const PHONE_DIGITS = { min: 7, max: 15 };

export const RESUME_REVIEW_VALIDATION_MESSAGES = {
  required: (label: string) => `${label} is required.`,
  tooLong: (label: string, max: number) => `${label} must be ${max} characters or fewer.`,
  itemTooLong: (noun: string, max: number) => `Each ${noun} must be ${max} characters or fewer.`,
  tooMany: (noun: string, max: number) => `List no more than ${max} ${noun}.`,
  email: "Enter a valid email address, like name@example.com.",
  phone: "Enter a valid phone number, like (555) 123-4567.",
  noContent:
    "Keep at least one skill, certification, or education, experience or project entry.",
} as const;

const MSG = RESUME_REVIEW_VALIDATION_MESSAGES;

// The structure returned by the resume parser (backend/src/resumes/resume-parser.js).
export interface ResumeEducation {
  institution: string | null;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ResumeExperience {
  company: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string[];
}

export interface ResumeProject {
  name: string | null;
  description: string[];
  technologies: string[];
}

export interface ResumeData {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  certifications: string[];
  education: ResumeEducation[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
}

export type ResumeSectionName = "education" | "experience" | "projects";

// Keys are field names, or "<section>.<index>.<field>" for an entry field.
export type ResumeReviewFieldErrors = Record<string, string>;

export type ResumeReviewValidationResult =
  | { ok: true; data: ResumeData }
  | { ok: false; fieldErrors: ResumeReviewFieldErrors };

export interface TextRule {
  label: string;
  required?: boolean;
  max: number;
}

export interface ListRule {
  // Label shown on the review form.
  label: string;
  noun: string;
  single: string;
  maxItems: number;
  itemMax: number;
}

export interface SectionRules {
  noun: string;
  text: Record<string, TextRule>;
  lists: Record<string, ListRule>;
}

export const RESUME_TEXT_RULES: Record<
  "name" | "email" | "phone" | "location" | "summary",
  TextRule
> = {
  name: { label: "Name", required: true, max: LIMITS.name },
  email: { label: "Email", max: LIMITS.email },
  phone: { label: "Phone", max: LIMITS.phone },
  location: { label: "Location", max: LIMITS.text },
  summary: { label: "Summary", max: LIMITS.summary },
};

const BULLETS: ListRule = {
  label: "Highlights",
  noun: "bullet points",
  single: "bullet point",
  maxItems: LIMITS.bullets,
  itemMax: LIMITS.bullet,
};

export const RESUME_LIST_RULES: Record<"skills" | "certifications", ListRule> = {
  skills: {
    label: "Skills",
    noun: "skills",
    single: "skill",
    maxItems: LIMITS.skills,
    itemMax: LIMITS.text,
  },
  certifications: {
    label: "Certifications",
    noun: "certifications",
    single: "certification",
    maxItems: LIMITS.certifications,
    itemMax: LIMITS.text,
  },
};

export const RESUME_SECTIONS: Record<ResumeSectionName, SectionRules> = {
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
        label: "Technologies",
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
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Entry = Record<string, string | null | string[]>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Trimmed text, or null when empty. The AI sometimes returns numbers (a phone
// number or a year), so those become text too.
function cleanText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") return null;

  return value.trim() || null;
}

// A list of non-empty strings. A single string becomes a one-item list.
function cleanList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map(cleanText).filter((item): item is string => item !== null);
}

function cleanEntry(value: unknown, section: SectionRules): Entry | null {
  if (!isPlainObject(value)) return null;

  const entry: Entry = {};

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
function cleanEntries(value: unknown, section: SectionRules) {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => ({ index, entry: cleanEntry(raw, section) }))
    .filter((item): item is { index: number; entry: Entry } => item.entry !== null);
}

// Returns the cleaned resume data, or null when the value isn't a JSON object.
export function normalizeResumeData(value: unknown): ResumeData | null {
  if (!isPlainObject(value)) return null;

  const data: Record<string, unknown> = {};

  for (const field of Object.keys(RESUME_TEXT_RULES)) {
    data[field] = cleanText(value[field]);
  }

  for (const field of Object.keys(RESUME_LIST_RULES)) {
    data[field] = cleanList(value[field]);
  }

  for (const [name, section] of Object.entries(RESUME_SECTIONS)) {
    data[name] = cleanEntries(value[name], section).map(({ entry }) => entry);
  }

  return data as unknown as ResumeData;
}

// True when the data has something an interview can use.
export function hasResumeContent(data: ResumeData | null): boolean {
  return data !== null && CONTENT_FIELDS.some((field) => data[field].length > 0);
}

function isPhoneNumber(value: string): boolean {
  if (!/^[\d\s()+.-]+$/.test(value)) return false;

  const digits = value.replace(/\D/g, "").length;
  return digits >= PHONE_DIGITS.min && digits <= PHONE_DIGITS.max;
}

function checkText(
  value: string | null,
  rule: TextRule,
  key: string,
  fieldErrors: ResumeReviewFieldErrors
) {
  if (value === null) {
    if (rule.required) fieldErrors[key] = MSG.required(rule.label);
  } else if (value.length > rule.max) {
    fieldErrors[key] = MSG.tooLong(rule.label, rule.max);
  }
}

function checkList(
  items: string[],
  rule: ListRule,
  key: string,
  fieldErrors: ResumeReviewFieldErrors
) {
  if (items.length > rule.maxItems) {
    fieldErrors[key] = MSG.tooMany(rule.noun, rule.maxItems);
  } else if (items.some((item) => item.length > rule.itemMax)) {
    fieldErrors[key] = MSG.itemTooLong(rule.single, rule.itemMax);
  }
}

// Entry errors use the entry's position in the submitted list, e.g.
// "experience.1.role", so the form can show them on the right entry.
export function validateResumeReview(body: unknown): ResumeReviewValidationResult {
  const input = isPlainObject(body) ? body : {};
  const data = normalizeResumeData(input)!;
  const fieldErrors: ResumeReviewFieldErrors = {};

  for (const [field, rule] of Object.entries(RESUME_TEXT_RULES)) {
    checkText(data[field as keyof typeof RESUME_TEXT_RULES], rule, field, fieldErrors);
  }

  if (data.email && !fieldErrors.email && !EMAIL_PATTERN.test(data.email)) {
    fieldErrors.email = MSG.email;
  }

  if (data.phone && !fieldErrors.phone && !isPhoneNumber(data.phone)) {
    fieldErrors.phone = MSG.phone;
  }

  for (const [field, rule] of Object.entries(RESUME_LIST_RULES)) {
    checkList(data[field as keyof typeof RESUME_LIST_RULES], rule, field, fieldErrors);
  }

  for (const [name, section] of Object.entries(RESUME_SECTIONS)) {
    const entries = cleanEntries(input[name], section);

    if (entries.length > LIMITS.entries) {
      fieldErrors[name] = MSG.tooMany(section.noun, LIMITS.entries);
      continue;
    }

    for (const { index, entry } of entries) {
      for (const [field, rule] of Object.entries(section.text)) {
        checkText(entry[field] as string | null, rule, `${name}.${index}.${field}`, fieldErrors);
      }

      for (const [field, rule] of Object.entries(section.lists)) {
        checkList(entry[field] as string[], rule, `${name}.${index}.${field}`, fieldErrors);
      }
    }
  }

  if (!hasResumeContent(data)) {
    fieldErrors.content = MSG.noContent;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, data };
}
