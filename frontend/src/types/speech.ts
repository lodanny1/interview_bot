// Shared speech types. Introduced in #27 and reused by #28 and #33.
// All times are in SECONDS from the start of the answer's audio.

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export type MetricUnavailableCode = "NO_TRANSCRIPT" | "TOO_SHORT";
export type MetricFailedCode = "INVALID_TIMESTAMPS" | "PROCESSING_FAILED";

/** Nothing to analyze. Informational, not an error (AC 2). */
export interface MetricUnavailable {
  status: "unavailable";
  code: MetricUnavailableCode;
  message: string;
}

/** Something went wrong processing the voice data. Retryable (AC 3). */
export interface MetricFailed {
  status: "failed";
  code: MetricFailedCode;
  message: string;
}

export type MetricNotReady = MetricUnavailable | MetricFailed;

/**
 * What every speech metric returns. A discriminated union so the UI can
 * never render a number that doesn't exist (no fabricated results).
 */
export type MetricResult<T> = { status: "ready"; data: T } | MetricNotReady;

// ---- #27 Speaking pace ----

export type PaceBand = "slow" | "optimal" | "fast";

export interface PaceResult {
  wpm: number;
  wordCount: number;
  durationSeconds: number;
  band: PaceBand;
}
