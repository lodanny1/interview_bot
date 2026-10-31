import { describe, expect, it } from "vitest";
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  validateStartInterview,
  type RawStartInterview,
} from "@/lib/interview/interview-validation";

const VALID: RawStartInterview = {
  goal: "general",
  title: "Senior Frontend Engineer - TechCorp",
  industry: "tech",
  roleLevel: "senior",
  experienceLevel: "5-10",
  focusArea: "behavioral",
  mode: "voice",
  jobDescription: "Build UIs.",
};

describe("validateStartInterview", () => {
  it("accepts a complete, valid config", () => {
    expect(validateStartInterview(VALID)).toEqual({
      ok: true,
      data: {
        goal: "general",
        title: "Senior Frontend Engineer - TechCorp",
        industry: "tech",
        roleLevel: "senior",
        experienceLevel: "5-10",
        focusArea: "behavioral",
        mode: "voice",
        jobDescription: "Build UIs.",
      },
    });
  });

  it("only requires goal, title, focus area and mode, and omits empty optional fields", () => {
    const result = validateStartInterview({
      ...VALID,
      industry: "",
      roleLevel: "",
      experienceLevel: "",
      jobDescription: "   ",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        goal: "general",
        title: "Senior Frontend Engineer - TechCorp",
        focusArea: "behavioral",
        mode: "voice",
      },
    });
  });

  it("trims the title", () => {
    const result = validateStartInterview({ ...VALID, title: "  Mock round  " });
    expect(result.ok && result.data.title).toBe("Mock round");
  });

  it("reports missing required fields (Scenario 2)", () => {
    const result = validateStartInterview({
      goal: null,
      title: "   ",
      industry: null,
      roleLevel: null,
      experienceLevel: null,
      focusArea: "",
      mode: null,
      jobDescription: null,
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        goal: "Choose a practice goal.",
        title: "Enter an interview name.",
        focusArea: "Choose a focus area.",
        mode: "Choose a simulation mode.",
      },
    });
  });

  it("rejects values that aren't in the option lists", () => {
    const result = validateStartInterview({
      ...VALID,
      goal: "hacking",
      mode: "hologram",
      focusArea: "astrology",
      industry: "crypto",
      roleLevel: "ceo",
      experienceLevel: "50+",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(
        ["experienceLevel", "focusArea", "goal", "industry", "mode", "roleLevel"].sort()
      );
    }
  });

  it("rejects a non-string value such as a File", () => {
    const result = validateStartInterview({ ...VALID, title: new Blob(["x"]) });
    expect(result.ok).toBe(false);
  });

  it("enforces length limits", () => {
    const result = validateStartInterview({
      ...VALID,
      title: "a".repeat(TITLE_MAX_LENGTH + 1),
      jobDescription: "b".repeat(JOB_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.title).toBeDefined();
      expect(result.fieldErrors.jobDescription).toBeDefined();
    }
  });
});
