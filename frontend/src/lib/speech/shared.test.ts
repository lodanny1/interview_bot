import { describe, it, expect } from "vitest";
import { SpeechAnalysisError, toMetricResult, validateWords } from "./shared";
import {
  MOCK_BAD_TIMESTAMPS,
  MOCK_EMPTY,
  MOCK_TOO_SHORT,
  MOCK_TRANSCRIPT,
} from "./speech-mock";

describe("validateWords", () => {
  it("accepts a normal transcript", () => {
    expect(() => validateWords(MOCK_TRANSCRIPT)).not.toThrow();
  });

  it.each([
    ["null", null, "NO_TRANSCRIPT"],
    ["undefined", undefined, "NO_TRANSCRIPT"],
    ["empty", MOCK_EMPTY, "NO_TRANSCRIPT"],
    ["too short", MOCK_TOO_SHORT, "TOO_SHORT"],
    ["bad timestamps", MOCK_BAD_TIMESTAMPS, "INVALID_TIMESTAMPS"],
  ])("rejects %s", (_name, words, code) => {
    try {
      validateWords(words);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SpeechAnalysisError);
      expect((err as SpeechAnalysisError).code).toBe(code);
    }
  });

  it("rejects NaN timestamps", () => {
    const words = MOCK_TRANSCRIPT.map((w, i) => (i === 3 ? { ...w, start: NaN } : w));
    expect(() => validateWords(words)).toThrow(SpeechAnalysisError);
  });
});

describe("toMetricResult", () => {
  it("wraps a value as ready", () => {
    expect(toMetricResult(() => 42)).toEqual({ status: "ready", data: 42 });
  });

  it("maps unexpected errors to a retryable failure instead of throwing (AC 3)", () => {
    const result = toMetricResult(() => {
      throw new Error("boom");
    });
    expect(result).toMatchObject({ status: "failed", code: "PROCESSING_FAILED" });
  });
});
