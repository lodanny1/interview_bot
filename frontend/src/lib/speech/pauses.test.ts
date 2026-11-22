import { describe, it, expect } from "vitest";
import { PAUSE_CONFIG, analyzePauses, calculatePauses, classifyPauses } from "./pauses";
import {
  MOCK_BAD_TIMESTAMPS,
  MOCK_EMPTY,
  MOCK_TOO_SHORT,
  MOCK_TRANSCRIPT,
  buildTranscript,
} from "./speech-mock";

describe("calculatePauses", () => {
  it("finds gaps at or above the threshold and ignores shorter ones", () => {
    const words = buildTranscript([
      ["a", 0],
      ["b", 0.2],
      ["c", 0.6],
      ["d", 0.59],
      ["e", 2.0],
      ["f", 0.1],
    ]);
    const result = calculatePauses(words);
    expect(result.totalPauses).toBe(2); // 0.6 and 2.0; 0.2 and 0.59 are too short
    expect(result.longPauses).toBe(1);
    expect(result.longestPauseSeconds).toBe(2);
    expect(result.pauses[0]).toMatchObject({ afterWord: "b", beforeWord: "c", isLong: false });
    expect(result.pauses[1]).toMatchObject({ afterWord: "d", beforeWord: "e", isLong: true });
  });

  it("reports zero pauses cleanly", () => {
    const words = buildTranscript(
      Array.from({ length: 8 }, (_, i) => [`w${i}`, 0.1] as [string, number]),
    );
    const result = calculatePauses(words);
    expect(result.totalPauses).toBe(0);
    expect(result.averagePauseSeconds).toBe(0);
    expect(result.longestPauseSeconds).toBe(0);
    expect(result.band).toBe("fluent");
  });

  it("averages pause length", () => {
    const words = buildTranscript([
      ["a", 0],
      ["b", 1.0],
      ["c", 0.1],
      ["d", 2.0],
      ["e", 0.1],
      ["f", 0.1],
    ]);
    const result = calculatePauses(words);
    expect(result.totalPauses).toBe(2);
    expect(result.averagePauseSeconds).toBe(1.5);
  });
});

describe("classifyPauses", () => {
  it("classifies bands at the boundaries", () => {
    expect(classifyPauses(PAUSE_CONFIG.fluentMaxPausesPerMinute)).toBe("fluent");
    expect(classifyPauses(PAUSE_CONFIG.fluentMaxPausesPerMinute + 0.1)).toBe("some_hesitation");
    expect(classifyPauses(PAUSE_CONFIG.hesitantMaxPausesPerMinute)).toBe("some_hesitation");
    expect(classifyPauses(PAUSE_CONFIG.hesitantMaxPausesPerMinute + 0.1)).toBe("frequent");
  });
});

describe("analyzePauses (never throws)", () => {
  it("returns ready for the representative mock transcript", () => {
    const result = analyzePauses(MOCK_TRANSCRIPT);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.data.totalPauses).toBe(3);
      expect(result.data.longPauses).toBe(1);
      expect(result.data.longestPauseSeconds).toBe(2.4);
    }
  });

  it("returns unavailable for missing or empty transcripts (AC 2)", () => {
    expect(analyzePauses(null)).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
    expect(analyzePauses(MOCK_EMPTY)).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
  });

  it("returns unavailable when the answer is too short (AC 2)", () => {
    expect(analyzePauses(MOCK_TOO_SHORT)).toMatchObject({ status: "unavailable", code: "TOO_SHORT" });
  });

  it("returns failed for unusable timestamps (AC 3)", () => {
    expect(analyzePauses(MOCK_BAD_TIMESTAMPS)).toMatchObject({
      status: "failed",
      code: "INVALID_TIMESTAMPS",
    });
  });
});
