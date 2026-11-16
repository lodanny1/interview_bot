import { describe, it, expect } from "vitest";
import { PACE_CONFIG, analyzePace, calculatePace, classifyPace } from "./pace";
import {
  MOCK_BAD_TIMESTAMPS,
  MOCK_EMPTY,
  MOCK_TOO_SHORT,
  MOCK_TRANSCRIPT,
  buildTranscript,
} from "./speech-mock";

describe("calculatePace", () => {
  it("computes words per minute from first start to last end", () => {
    // 10 words, each 0.3s, no gaps => 3s total => 200 wpm
    const words = buildTranscript(
      Array.from({ length: 10 }, (_, i) => [`w${i}`, 0] as [string, number]),
      0.3,
    );
    const pace = calculatePace(words);
    expect(pace.wordCount).toBe(10);
    expect(pace.durationSeconds).toBe(3);
    expect(pace.wpm).toBe(200);
    expect(pace.band).toBe("fast");
  });

  it("classifies bands at the boundaries", () => {
    expect(classifyPace(PACE_CONFIG.optimalWpmMin - 1)).toBe("slow");
    expect(classifyPace(PACE_CONFIG.optimalWpmMin)).toBe("optimal");
    expect(classifyPace(PACE_CONFIG.optimalWpmMax)).toBe("optimal");
    expect(classifyPace(PACE_CONFIG.optimalWpmMax + 1)).toBe("fast");
  });
});

describe("analyzePace (never throws)", () => {
  it("returns ready with an optimal pace for the representative mock transcript", () => {
    const result = analyzePace(MOCK_TRANSCRIPT);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.data.wordCount).toBe(45);
      expect(result.data.band).toBe("optimal");
    }
  });

  it("returns unavailable for missing or empty transcripts (AC 2)", () => {
    expect(analyzePace(null)).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
    expect(analyzePace(undefined)).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
    expect(analyzePace(MOCK_EMPTY)).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
  });

  it("returns unavailable when the answer is too short (AC 2)", () => {
    expect(analyzePace(MOCK_TOO_SHORT)).toMatchObject({ status: "unavailable", code: "TOO_SHORT" });
  });

  it("returns failed for unusable timestamps (AC 3)", () => {
    expect(analyzePace(MOCK_BAD_TIMESTAMPS)).toMatchObject({
      status: "failed",
      code: "INVALID_TIMESTAMPS",
    });
  });

  it("returns failed when all words share one timestamp (zero duration)", () => {
    const words = Array.from({ length: 6 }, (_, i) => ({ text: `w${i}`, start: 1, end: 1 }));
    expect(analyzePace(words)).toMatchObject({ status: "failed", code: "INVALID_TIMESTAMPS" });
  });
});
