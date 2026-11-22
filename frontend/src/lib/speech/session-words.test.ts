import { describe, it, expect } from "vitest";
import { getCandidateWords, stitchAnswers } from "./session-words";
import { computeSpeechMetrics } from "./metrics";
import { analyzePace } from "./pace";
import { analyzePauses } from "./pauses";
import { buildTranscript } from "./speech-mock";

// Same shape as InterviewMessage on the history page (no `words` yet).
// Passing these to getCandidateWords also proves the types line up.
type TextMessage = {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  timestamp: Date;
};

const noGaps = (n: number, prefix: string) =>
  buildTranscript(
    Array.from({ length: n }, (_, i) => [`${prefix}${i}`, 0] as [string, number]),
    0.3,
  );

describe("getCandidateWords", () => {
  it("returns null for sessions with no word timing yet (today's data)", () => {
    const messages: TextMessage[] = [
      { id: "1", role: "interviewer", content: "Tell me about yourself.", timestamp: new Date() },
      { id: "2", role: "candidate", content: "I am a developer.", timestamp: new Date() },
    ];
    expect(getCandidateWords({ messages })).toBeNull();
  });

  it("feeds the card an 'unavailable' state instead of fake numbers when null", () => {
    const m = computeSpeechMetrics(getCandidateWords({ messages: [] }));
    expect(m.pace).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
    expect(m.pauses).toMatchObject({ status: "unavailable", code: "NO_TRANSCRIPT" });
  });

  it("ignores words on interviewer messages", () => {
    const words = noGaps(8, "q");
    expect(getCandidateWords({ messages: [{ role: "interviewer", words }] })).toBeNull();
  });

  it("uses only candidate answers, in order", () => {
    const result = getCandidateWords({
      messages: [
        { role: "interviewer", words: noGaps(6, "q") },
        { role: "candidate", words: noGaps(6, "a") },
        { role: "candidate", words: noGaps(6, "b") },
      ],
    });
    expect(result?.map((w) => w.text)).toEqual([
      ...Array.from({ length: 6 }, (_, i) => `a${i}`),
      ...Array.from({ length: 6 }, (_, i) => `b${i}`),
    ]);
  });
});

describe("stitchAnswers", () => {
  it("makes answers that each restart at 0 into one valid timeline", () => {
    const raw = [...noGaps(6, "a"), ...noGaps(6, "b")]; // time jumps back to 0
    expect(analyzePace(raw)).toMatchObject({ status: "failed", code: "INVALID_TIMESTAMPS" });

    const stitched = stitchAnswers([noGaps(6, "a"), noGaps(6, "b")]);
    expect(analyzePace(stitched).status).toBe("ready");
  });

  it("does not count the gap between answers as a pause, but keeps pauses inside answers", () => {
    const answerA = noGaps(6, "a");
    const answerB = buildTranscript([
      ["x", 0],
      ["y", 0],
      ["z", 1.5], // a real pause inside answer B
      ["u", 0],
      ["v", 0],
      ["w", 0],
    ]);
    const result = analyzePauses(stitchAnswers([answerA, answerB]));
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.data.totalPauses).toBe(1);
      expect(result.data.pauses[0]).toMatchObject({ afterWord: "y", beforeWord: "z" });
    }
  });

  it("drops leading silence before the first word of each answer", () => {
    const lateStart = buildTranscript([
      ["a", 3], // answer audio starts with 3s of silence
      ["b", 0],
      ["c", 0],
      ["d", 0],
      ["e", 0],
    ]);
    const stitched = stitchAnswers([lateStart]);
    expect(stitched[0].start).toBe(0);
  });

  it("computes pace across all answers", () => {
    // two answers, 10 words x 0.3s each => 20 words in 6s => 200 wpm
    const stitched = stitchAnswers([noGaps(10, "a"), noGaps(10, "b")]);
    const pace = analyzePace(stitched);
    expect(pace.status).toBe("ready");
    if (pace.status === "ready") {
      expect(pace.data.wordCount).toBe(20);
      expect(pace.data.wpm).toBe(200);
    }
  });

  it("skips empty answers", () => {
    expect(stitchAnswers([[], noGaps(6, "a"), []])).toHaveLength(6);
    expect(stitchAnswers([])).toEqual([]);
  });
});
