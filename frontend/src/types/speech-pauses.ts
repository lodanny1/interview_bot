// Types for #28 Speech pause analysis. Builds on the shared types from #27 (types/speech.ts).
// All times are in SECONDS from the start of the answer's audio.
//
// Naming note: this is about SILENCE between spoken words, not the
// "pause interview" feature (feature/interview-pause-resume).

export interface SpeechPause {
  /** Silence starts when this word ends. */
  start: number;
  end: number;
  durationSeconds: number;
  /** Words on either side, so the UI can show context. */
  afterWord: string;
  beforeWord: string;
  isLong: boolean;
}

export type PauseBand = "fluent" | "some_hesitation" | "frequent";

export interface PauseResult {
  totalPauses: number;
  longPauses: number;
  averagePauseSeconds: number;
  longestPauseSeconds: number;
  pausesPerMinute: number;
  band: PauseBand;
  pauses: SpeechPause[];
}
