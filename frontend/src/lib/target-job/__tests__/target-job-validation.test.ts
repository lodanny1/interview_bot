import { describe, expect, it } from "vitest";
import {
  TARGET_JOB_VALIDATION_MESSAGES as MSG,
  countWords,
  normalizeDescription,
  validateTargetJob,
} from "@/lib/target-job/target-job-validation";

const DESCRIPTION =
  "We are hiring a junior software engineer to build and maintain web features. " +
  "You will work with React and Node.js, write tests, and review code with the team. " +
  "Qualifications: a CS degree or similar experience.";

describe("validateTargetJob", () => {
  it("accepts a full job description and trims the text", () => {
    expect(
      validateTargetJob({
        jobTitle: "  Junior Software Engineer ",
        company: " Acme ",
        description: `  ${DESCRIPTION}  `,
      })
    ).toEqual({
      ok: true,
      data: { jobTitle: "Junior Software Engineer", company: "Acme", description: DESCRIPTION },
    });
  });

  it("allows the company to be left out", () => {
    const result = validateTargetJob({ jobTitle: "Engineer", description: DESCRIPTION });
    expect(result.ok && result.data.company).toBe("");
  });

  it("requires a job title and description (Scenario 2)", () => {
    expect(validateTargetJob({})).toEqual({
      ok: false,
      fieldErrors: { jobTitle: MSG.jobTitleRequired, description: MSG.descriptionRequired },
    });
  });

  it("rejects a pasted link instead of the posting text (Scenario 3)", () => {
    const result = validateTargetJob({
      jobTitle: "Engineer",
      description: "https://careers.example.com/jobs/123",
    });
    expect(result).toEqual({ ok: false, fieldErrors: { description: MSG.descriptionIsLink } });
  });

  it("rejects an incomplete description (Scenario 3)", () => {
    const result = validateTargetJob({
      jobTitle: "Engineer",
      description: "Software engineer, must know React.",
    });
    expect(result).toEqual({ ok: false, fieldErrors: { description: MSG.descriptionTooShort } });
  });

  it("rejects text that can't be read as a job description (Scenario 3)", () => {
    const result = validateTargetJob({
      jobTitle: "Engineer",
      description: "%PDF-1.7 0 0 0 1 2 3 4 5 6 7 8 9 ### $$$ @@@ !!! ".repeat(4),
    });
    expect(result).toEqual({ ok: false, fieldErrors: { description: MSG.descriptionUnreadable } });
  });

  it("rejects text over the length limits", () => {
    expect(
      validateTargetJob({
        jobTitle: "x".repeat(121),
        company: "x".repeat(121),
        description: "word ".repeat(2001),
      })
    ).toEqual({
      ok: false,
      fieldErrors: {
        jobTitle: MSG.jobTitleTooLong,
        company: MSG.companyTooLong,
        description: MSG.descriptionTooLong,
      },
    });
  });

  it("ignores non-string input instead of throwing", () => {
    expect(validateTargetJob({ jobTitle: 42, description: ["x"] }).ok).toBe(false);
  });
});

describe("description helpers", () => {
  it("normalizes Windows line endings and extra blank lines", () => {
    expect(normalizeDescription("  Line one  \r\n\r\n\r\n\r\nLine two\r\n")).toBe(
      "Line one\n\nLine two"
    );
  });

  it("counts words", () => {
    expect(countWords("  one two\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});
