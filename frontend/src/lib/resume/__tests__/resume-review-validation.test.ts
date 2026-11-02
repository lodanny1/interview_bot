import { describe, expect, it } from "vitest";

import {
  RESUME_REVIEW_LIMITS as LIMITS,
  RESUME_REVIEW_VALIDATION_MESSAGES as MSG,
  hasResumeContent,
  normalizeResumeData,
  validateResumeReview,
  type ResumeData,
} from "@/lib/resume/resume-review-validation";

import {
  fromFormValues,
  toFormValues,
  toResumeReview,
} from "@/lib/resume/resume-review-state";

import { MOCK_PARSED_RESUME } from "@/lib/resume/resume-api";

// The structure the backend's resume parser prompt asks the AI to return.
const PARSER_TEMPLATE = {
  name: null,
  email: null,
  phone: null,
  location: null,
  summary: null,
  skills: [],
  education: [
    { institution: null, degree: null, field: null, startDate: null, endDate: null },
  ],
  experience: [
    { company: null, role: null, startDate: null, endDate: null, description: [] },
  ],
  projects: [{ name: null, description: [], technologies: [] }],
  certifications: [],
};

const VALID: ResumeData = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "(555) 123-4567",
  location: null,
  summary: null,
  skills: ["Python", "AWS"],
  certifications: [],
  education: [],
  experience: [
    {
      company: "Acme",
      role: "Software Intern",
      startDate: "June 2023",
      endDate: "Present",
      description: ["Built REST APIs"],
    },
  ],
  projects: [],
};

describe("normalizeResumeData", () => {
  it("finds no content in the parser's all-null template", () => {
    const data = normalizeResumeData(PARSER_TEMPLATE);

    expect(data?.education).toEqual([]);
    expect(data?.experience).toEqual([]);
    expect(data?.projects).toEqual([]);
    expect(hasResumeContent(data)).toBe(false);
  });

  it("cleans up typical AI output", () => {
    const data = normalizeResumeData({
      name: "  Jordan Lee ",
      phone: 5551234567,
      skills: ["Python", " ", null, "AWS"],
      experience: [{ company: "Acme", role: "Intern", description: "Built APIs" }],
    });

    expect(data?.name).toBe("Jordan Lee");
    expect(data?.phone).toBe("5551234567");
    expect(data?.skills).toEqual(["Python", "AWS"]);
    expect(data?.experience[0].description).toEqual(["Built APIs"]);
    expect(hasResumeContent(data)).toBe(true);
  });

  it("rejects values that aren't a JSON object", () => {
    for (const value of [null, undefined, "text", 42, [VALID]]) {
      expect(normalizeResumeData(value)).toBeNull();
    }
  });

  it("accepts the mock extraction", () => {
    expect(hasResumeContent(normalizeResumeData(MOCK_PARSED_RESUME))).toBe(true);
  });
});

describe("validateResumeReview", () => {
  it("accepts valid information", () => {
    expect(validateResumeReview(VALID)).toEqual({ ok: true, data: VALID });
  });

  it("requires a name and some resume content", () => {
    const result = validateResumeReview({ ...VALID, name: " ", skills: [], experience: [] });

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: MSG.required("Name"),
        content: MSG.noContent,
      },
    });
  });

  it("rejects an invalid email or phone number", () => {
    const result = validateResumeReview({ ...VALID, email: "jordan@", phone: "12345" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.fieldErrors.email).toBe(MSG.email);
    expect(result.fieldErrors.phone).toBe(MSG.phone);
  });

  it("keys entry errors by the entry's position in the submitted list", () => {
    const result = validateResumeReview({
      ...VALID,
      education: [{ institution: "" }, { institution: "", degree: "B.S." }],
      experience: [{ company: "Acme", role: "" }],
    });

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        "education.1.institution": MSG.required("Institution"),
        "experience.0.role": MSG.required("Role"),
      },
    });
  });

  it("enforces length and count limits", () => {
    const result = validateResumeReview({
      ...VALID,
      summary: "x".repeat(LIMITS.summary + 1),
      skills: Array.from({ length: LIMITS.skills + 1 }, (_, i) => `Skill ${i}`),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.fieldErrors.summary).toBe(MSG.tooLong("Summary", LIMITS.summary));
    expect(result.fieldErrors.skills).toBe(MSG.tooMany("skills", LIMITS.skills));
  });
});

describe("toResumeReview", () => {
  const base = { resumeId: "resume-1", fileName: "My Resume.pdf" };

  it("maps each extraction state", () => {
    expect(toResumeReview({ ...base, parseStatus: "PENDING" }).status).toBe("not_extracted");
    expect(toResumeReview({ ...base, parseStatus: "PROCESSING" }).status).toBe("processing");
    expect(toResumeReview({ ...base, parseStatus: "FAILED" }).status).toBe("failed");
    expect(toResumeReview({ ...base, parseStatus: "unexpected" }).status).toBe("failed");
  });

  it("only treats usable completed output as ready", () => {
    expect(
      toResumeReview({ ...base, parseStatus: "COMPLETED", parsedJson: {} })
    ).toEqual({ ...base, status: "failed", data: null, reviewedAt: null });

    const ready = toResumeReview({
      ...base,
      parseStatus: "COMPLETED",
      parsedJson: MOCK_PARSED_RESUME,
    });

    expect(ready.status).toBe("ready");
    expect(ready.data?.name).toBe("Jordan Lee");
  });

  it("shows the confirmed information once reviewed", () => {
    const review = toResumeReview({
      ...base,
      parseStatus: "COMPLETED",
      parsedJson: MOCK_PARSED_RESUME,
      reviewedJson: VALID,
      reviewedAt: "2026-11-02T10:00:00.000Z",
    });

    expect(review).toEqual({
      ...base,
      status: "reviewed",
      data: VALID,
      reviewedAt: "2026-11-02T10:00:00.000Z",
    });
  });
});

describe("review form values", () => {
  it("round-trips resume data through the form", () => {
    const data = normalizeResumeData(MOCK_PARSED_RESUME)!;
    const values = toFormValues(data);

    expect(values.skills).toBe(data.skills.join("\n"));
    expect(values.experience[0].description).toBe(data.experience[0].description.join("\n"));

    expect(validateResumeReview(fromFormValues(values))).toEqual({ ok: true, data });
  });

  it("gives each entry its own key", () => {
    const values = toFormValues(normalizeResumeData(MOCK_PARSED_RESUME)!);
    const again = toFormValues(normalizeResumeData(MOCK_PARSED_RESUME)!);

    expect(values.experience[0].key).not.toBe(again.experience[0].key);
  });
});
