import { describe, expect, it } from "vitest";
import {
  SETUP_VALIDATION_MESSAGES as MSG,
  parseFocusAreas,
  validateSetup,
} from "@/lib/setup/setup-validation";

const VALID = {
  targetRole: "  Software Engineer ",
  focusAreas: ["BEHAVIORAL", "TECHNICAL", "BEHAVIORAL"],
  targetCompany: " Acme ",
  bio: "",
};

describe("validateSetup", () => {
  it("accepts valid input, trims text and removes duplicate focus areas", () => {
    expect(validateSetup(VALID)).toEqual({
      ok: true,
      data: {
        targetRole: "Software Engineer",
        focusAreas: ["BEHAVIORAL", "TECHNICAL"],
        targetCompany: "Acme",
        bio: "",
        jobDescription: "",
      },
    });
  });

  it("reports every missing required field (Scenario 2)", () => {
    expect(validateSetup({})).toEqual({
      ok: false,
      fieldErrors: {
        targetRole: MSG.targetRoleRequired,
        focusAreas: MSG.focusAreasRequired,
      },
    });
  });

  it("treats whitespace-only text as missing", () => {
    const result = validateSetup({ ...VALID, targetRole: "   " });
    expect(result).toEqual({ ok: false, fieldErrors: { targetRole: MSG.targetRoleRequired } });
  });

  it("rejects focus areas that aren't in the option list", () => {
    const result = validateSetup({ ...VALID, focusAreas: ["TECHNICAL", "JUGGLING"] });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { focusAreas: MSG.focusAreasInvalid },
    });
  });

  it("rejects text over the length limits", () => {
    const result = validateSetup({
      ...VALID,
      targetRole: "x".repeat(101),
      targetCompany: "x".repeat(101),
      bio: "x".repeat(10001),
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        targetRole: MSG.targetRoleTooLong,
        targetCompany: MSG.targetCompanyTooLong,
        bio: MSG.bioTooLong,
      },
    });
  });

  it("allows the extra context box up to 10,000 characters", () => {
    expect(validateSetup({ ...VALID, bio: "x".repeat(10000) }).ok).toBe(true);
    expect(MSG.bioTooLong).toContain("10,000");
  });

  it("ignores non-string input instead of throwing", () => {
    const result = validateSetup({ targetRole: 42, focusAreas: "TECHNICAL" });
    expect(result.ok).toBe(false);
  });
});

describe("saved profile parsing", () => {
  it("splits saved focus areas and drops unknown ones", () => {
    expect(parseFocusAreas("BEHAVIORAL, TECHNICAL,OLD_VALUE")).toEqual([
      "BEHAVIORAL",
      "TECHNICAL",
    ]);
    expect(parseFocusAreas(null)).toEqual([]);
  });
});

describe("setup target job description", () => {
  const DESCRIPTION =
    "We are hiring a junior software engineer to build and maintain web features. " +
    "You will work with React and Node.js, write tests, and review code with the team.";
  const BASE = { targetRole: "Software Engineer", focusAreas: ["TECHNICAL"], targetCompany: "", bio: "" };

  it("is optional", () => {
    const result = validateSetup({ ...BASE, jobDescription: "   " });
    expect(result.ok && result.data.jobDescription).toBe("");
  });

  it("accepts a full job description", () => {
    const result = validateSetup({ ...BASE, jobDescription: `  ${DESCRIPTION} ` });
    expect(result.ok && result.data.jobDescription).toBe(DESCRIPTION);
  });

  it("uses the Target Jobs page's rules when given", () => {
    for (const [jobDescription, message] of [
      ["https://jobs.example.com/1", /link/],
      ["Too short to be a real posting.", /too short/],
      ["x".repeat(10001), /10,000 characters/],
    ] as const) {
      const result = validateSetup({ ...BASE, jobDescription });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.jobDescription).toMatch(message);
    }
  });
});
