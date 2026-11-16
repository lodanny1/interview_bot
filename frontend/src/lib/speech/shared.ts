import type {
  MetricResult,
  MetricUnavailableCode,
  TranscriptWord,
} from "@/types/speech";

/** Below this many words the metrics aren't meaningful. */
export const MIN_WORDS = 5;

export class SpeechAnalysisError extends Error {
  constructor(
    public code: MetricUnavailableCode | "INVALID_TIMESTAMPS",
    message: string,
  ) {
    super(message);
    this.name = "SpeechAnalysisError";
  }
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Throws SpeechAnalysisError if the words can't be analyzed. */
export function validateWords(
  words: TranscriptWord[] | null | undefined,
): asserts words is TranscriptWord[] {
  if (!words || words.length === 0) {
    throw new SpeechAnalysisError("NO_TRANSCRIPT", "No transcript was captured for this answer.");
  }
  if (words.length < MIN_WORDS) {
    throw new SpeechAnalysisError("TOO_SHORT", "This answer was too short to analyze.");
  }
  let prevEnd = -Infinity;
  for (const w of words) {
    const ok =
      Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end >= w.start;
    // Small tolerance: STT engines sometimes overlap words by a few ms.
    if (!ok || w.start < prevEnd - 0.05) {
      throw new SpeechAnalysisError(
        "INVALID_TIMESTAMPS",
        "The transcript timing data was unusable.",
      );
    }
    prevEnd = w.end;
  }
}

/**
 * Runs a calculation and turns any outcome into a MetricResult. Never throws,
 * so one bad transcript can't crash the feedback page (AC 2 + AC 3).
 */
export function toMetricResult<T>(compute: () => T): MetricResult<T> {
  try {
    return { status: "ready", data: compute() };
  } catch (err) {
    if (err instanceof SpeechAnalysisError) {
      if (err.code === "INVALID_TIMESTAMPS") {
        return { status: "failed", code: err.code, message: err.message };
      }
      return { status: "unavailable", code: err.code, message: err.message };
    }
    return {
      status: "failed",
      code: "PROCESSING_FAILED",
      message: "Speech analysis couldn't be completed.",
    };
  }
}
