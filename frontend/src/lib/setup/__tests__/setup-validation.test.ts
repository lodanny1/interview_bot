import { describe, expect, it } from "vitest";
import {
  SETUP_VALIDATION_MESSAGES as MSG,
  parseExperienceLevel,
  parseFocusAreas,
  validateSetup,
} from "@/lib/setup/setup-validation";

const VALID = {
  targetRole: "  Software Engineer ",
  experienceLevel: "ENTRY",
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
        experienceLevel: "ENTRY",
        focusAreas: ["BEHAVIORAL", "TECHNICAL"],
        targetCompany: "Acme",
        bio: "",
      },
    });
  });

  it("reports every missing required field (Scenario 2)", () => {
    expect(validateSetup({})).toEqual({
      ok: false,
      fieldErrors: {
        targetRole: MSG.targetRoleRequired,
        experienceLevel: MSG.experienceLevelRequired,
        focusAreas: MSG.focusAreasRequired,
      },
    });
  });

  it("treats whitespace-only text as missing", () => {
    const result = validateSetup({ ...VALID, targetRole: "   " });
    expect(result).toEqual({ ok: false, fieldErrors: { targetRole: MSG.targetRoleRequired } });
  });

  it("rejects values that aren't in the option lists", () => {
    const result = validateSetup({
      ...VALID,
      experienceLevel: "WIZARD",
      focusAreas: ["TECHNICAL", "JUGGLING"],
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        experienceLevel: MSG.experienceLevelRequired,
        focusAreas: MSG.focusAreasInvalid,
      },
    });
  });

  it("rejects text over the length limits", () => {
    const result = validateSetup({
      ...VALID,
      targetRole: "x".repeat(101),
      targetCompany: "x".repeat(101),
      bio: "x".repeat(501),
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

  it("only returns a known experience level", () => {
    expect(parseExperienceLevel("MID")).toBe("MID");
    expect(parseExperienceLevel("unknown")).toBe("");
    expect(parseExperienceLevel(null)).toBe("");
  });
});
