import type { MetricResult, PaceResult, TranscriptWord } from "@/types/speech";
import type { PauseResult } from "@/types/speech-pauses";
import { analyzePace } from "./pace";
import { analyzePauses } from "./pauses";

/** Everything the Speech Analysis card shows. Each metric succeeds or fails on its own. */
export interface SpeechMetrics {
  pace: MetricResult<PaceResult>;
  pauses: MetricResult<PauseResult>;
}

/**
 * Computes all delivery metrics from one transcript. Never throws (#33 AC 2 + AC 3).
 *
 * This is the single seam for real data: when #23 lands, map its output to
 * TranscriptWord[] and pass it here. When #26 (filler words) lands, add a
 * `fillers` field next to these.
 */
export function computeSpeechMetrics(words: TranscriptWord[] | null | undefined): SpeechMetrics {
  return { pace: analyzePace(words), pauses: analyzePauses(words) };
}
