import { describe, expect, it } from "vitest";
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  validateStartInterview,
} from "@/lib/interview/interview-validation";

const fieldErrorsFor = (jobDescription: string) => {
  const result = validateStartInterview({
    goal: "general",
    title: "Practice",
    industry: "",
    roleLevel: "",
    experienceLevel: "",
    focusArea: "",
    mode: "text",
    jobDescription,
    resumeId: "",
    targetJobId: "",
  });
  return result.ok ? {} : result.fieldErrors;
};

describe("interview setup job description limit", () => {
  it("matches the app-wide 10,000-character limit", () => {
    expect(JOB_DESCRIPTION_MAX_LENGTH).toBe(10000);
    expect(fieldErrorsFor("x".repeat(10000)).jobDescription).toBeUndefined();
    expect(fieldErrorsFor("x".repeat(10001)).jobDescription).toBe(
      "Keep the job description under 10,000 characters."
    );
  });
});
