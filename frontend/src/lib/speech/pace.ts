import type { MetricResult, PaceBand, PaceResult, TranscriptWord } from "@/types/speech";
import { SpeechAnalysisError, round1, toMetricResult, validateWords } from "./shared";

/** Tunable in one place. Conversational pace range in words per minute. */
export const PACE_CONFIG = {
  optimalWpmMin: 120,
  optimalWpmMax: 160,
} as const;

export function classifyPace(wpm: number): PaceBand {
  if (wpm < PACE_CONFIG.optimalWpmMin) return "slow";
  if (wpm > PACE_CONFIG.optimalWpmMax) return "fast";
  return "optimal";
}

/** Words per minute across the whole answer (first word start -> last word end). Throws on bad input. */
export function calculatePace(words: TranscriptWord[] | null | undefined): PaceResult {
  validateWords(words);
  const durationSeconds = words[words.length - 1].end - words[0].start;
  if (durationSeconds <= 0) {
    throw new SpeechAnalysisError("INVALID_TIMESTAMPS", "The transcript timing data was unusable.");
  }
  const wpm = Math.round((words.length / durationSeconds) * 60);
  return {
    wpm,
    wordCount: words.length,
    durationSeconds: round1(durationSeconds),
    band: classifyPace(wpm),
  };
}

/** Never throws. Use this from the UI / data layer. */
export function analyzePace(words: TranscriptWord[] | null | undefined): MetricResult<PaceResult> {
  return toMetricResult(() => calculatePace(words));
}
