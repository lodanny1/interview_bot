import type { MetricResult, TranscriptWord } from "@/types/speech";
import type { PauseBand, PauseResult, SpeechPause } from "@/types/speech-pauses";
import { round1, round2, toMetricResult, validateWords } from "./shared";

/** Tunable in one place. Confirm these numbers with your team. */
export const PAUSE_CONFIG = {
  /** Gap between words (s) that counts as a pause. Shorter is normal breathing. */
  pauseThresholdSeconds: 0.6,
  /** Gap (s) that counts as a long pause. */
  longPauseSeconds: 2.0,
  /** Pauses per minute cutoffs for the fluency band. */
  fluentMaxPausesPerMinute: 8,
  hesitantMaxPausesPerMinute: 14,
} as const;

export function classifyPauses(pausesPerMinute: number): PauseBand {
  if (pausesPerMinute <= PAUSE_CONFIG.fluentMaxPausesPerMinute) return "fluent";
  if (pausesPerMinute <= PAUSE_CONFIG.hesitantMaxPausesPerMinute) return "some_hesitation";
  return "frequent";
}

/** Silent gaps between consecutive words that exceed the pause threshold. Throws on bad input. */
export function calculatePauses(words: TranscriptWord[] | null | undefined): PauseResult {
  validateWords(words);
  const pauses: SpeechPause[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    // Rounded so float noise (0.5999999) can't flip a boundary case.
    const gap = round2(words[i + 1].start - words[i].end);
    if (gap >= PAUSE_CONFIG.pauseThresholdSeconds) {
      pauses.push({
        start: words[i].end,
        end: words[i + 1].start,
        durationSeconds: gap,
        afterWord: words[i].text,
        beforeWord: words[i + 1].text,
        isLong: gap >= PAUSE_CONFIG.longPauseSeconds,
      });
    }
  }

  const minutes = (words[words.length - 1].end - words[0].start) / 60;
  const pausesPerMinute = minutes > 0 ? round1(pauses.length / minutes) : 0;
  const total = pauses.reduce((sum, p) => sum + p.durationSeconds, 0);

  return {
    totalPauses: pauses.length,
    longPauses: pauses.filter((p) => p.isLong).length,
    averagePauseSeconds: pauses.length ? round2(total / pauses.length) : 0,
    longestPauseSeconds: pauses.length ? Math.max(...pauses.map((p) => p.durationSeconds)) : 0,
    pausesPerMinute,
    band: classifyPauses(pausesPerMinute),
    pauses,
  };
}

/** Never throws. Use this from the UI / data layer. */
export function analyzePauses(
  words: TranscriptWord[] | null | undefined,
): MetricResult<PauseResult> {
  return toMetricResult(() => calculatePauses(words));
}
