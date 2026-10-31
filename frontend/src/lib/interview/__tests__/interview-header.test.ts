import { describe, expect, it } from "vitest";
import { sessionSubtitle, sessionSubtitleParts } from "@/lib/interview/interview-header";

describe("session header subtitle", () => {
  it("shows only the required focus area when no optional fields were filled in", () => {
    expect(sessionSubtitle({ focusArea: "technical" })).toBe("Technical • AI Interviewer");
  });

  it("adds each optional selection the user filled in, in form order", () => {
    expect(
      sessionSubtitleParts({
        focusArea: "system-design",
        industry: "tech",
        roleLevel: "senior",
        experienceLevel: "5-10",
      })
    ).toEqual(["System Design", "Technology", "Senior", "5–10 years", "AI Interviewer"]);
  });

  it("skips optional fields that were left empty", () => {
    expect(sessionSubtitle({ focusArea: "behavioral", roleLevel: "entry" })).toBe(
      "Behavioral • Entry Level • AI Interviewer"
    );
  });

  it("falls back to the raw value for an option it doesn't know", () => {
    expect(sessionSubtitle({ focusArea: "product-sense" })).toBe("product-sense • AI Interviewer");
  });

  it("doesn't leave a blank entry when the focus area is missing", () => {
    expect(sessionSubtitle({ focusArea: "" })).toBe("AI Interviewer");
  });
});
