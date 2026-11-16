import type { TranscriptWord } from "@/types/speech";

/**
 * Builds a fake transcript from a script of [word, gapBeforeSeconds] entries.
 * Every word lasts `wordSeconds`.
 */
export function buildTranscript(
  script: Array<[string, number]>,
  wordSeconds = 0.35,
): TranscriptWord[] {
  let t = 0;
  return script.map(([text, gap]) => {
    const start = Math.round((t + gap) * 100) / 100;
    const end = Math.round((start + wordSeconds) * 100) / 100;
    t = end;
    return { text, start, end };
  });
}

const MOCK_TEXT =
  "I led the migration to React and we cut load time by forty percent which meant fewer " +
  "drop-offs on mobile and a clearer checkout flow for users because the new design system " +
  "removed a lot of duplicated code and made every page faster to build";

/** Gap (seconds) before the word at this index. Everything else gets 0.05s. */
const MOCK_GAPS: Record<number, number> = {
  6: 0.7, // before "and"   -> a pause
  14: 2.4, // before "which" -> a long pause
  20: 0.8, // before "and"   -> a pause
};

/** 45 words, ~139 wpm (optimal), 3 pauses, one of them long. Close to the mockup. */
export const MOCK_TRANSCRIPT: TranscriptWord[] = buildTranscript(
  MOCK_TEXT.split(" ").map((w, i): [string, number] => [w, i === 0 ? 0 : (MOCK_GAPS[i] ?? 0.05)]),
  0.3,
);

/** Fixtures for the error states. */
export const MOCK_EMPTY: TranscriptWord[] = [];
export const MOCK_TOO_SHORT: TranscriptWord[] = buildTranscript([
  ["Yes", 0],
  ["I", 0.1],
]);
export const MOCK_BAD_TIMESTAMPS: TranscriptWord[] = [
  { text: "one", start: 0, end: 0.3 },
  { text: "two", start: 0.4, end: 0.2 }, // ends before it starts
  { text: "three", start: 0.5, end: 0.8 },
  { text: "four", start: 0.9, end: 1.2 },
  { text: "five", start: 1.3, end: 1.6 },
];
