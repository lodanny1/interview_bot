import type { TranscriptWord } from "@/types/speech";

/**
 * A message that may carry word-level timing from speech-to-text (#23).
 * Text-mode messages, and voice messages saved before #23, have no `words`.
 *
 * Structural on purpose: InterviewMessage in types/interview.ts is left
 * untouched until #23 decides the real field name. Any InterviewMessage is
 * assignable to this, and `words` lights up automatically once it exists.
 */
export interface MessageWithWords {
  role: string;
  words?: TranscriptWord[] | null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Joins several answers into one timeline.
 *
 * Each answer's timestamps start from 0 for THAT answer, so simply
 * concatenating them would make time jump backwards. Instead each answer is
 * shifted to begin where the previous one ended. Silence BETWEEN answers
 * (the interviewer talking, thinking before replying) is not a speech pause,
 * so it is dropped. Pauses WITHIN an answer are kept.
 */
export function stitchAnswers(answers: TranscriptWord[][]): TranscriptWord[] {
  const stitched: TranscriptWord[] = [];
  let cursor = 0;

  for (const answer of answers) {
    if (answer.length === 0) continue;
    const shift = cursor - answer[0].start;
    for (const w of answer) {
      stitched.push({ text: w.text, start: round3(w.start + shift), end: round3(w.end + shift) });
    }
    cursor = stitched[stitched.length - 1].end;
  }

  return stitched;
}

/**
 * All of the candidate's spoken words in a session, as one timeline.
 * Returns null when no answer has word timing, which the Speech Analysis card
 * renders as "unavailable" rather than inventing numbers.
 */
export function getCandidateWords(session: {
  messages: MessageWithWords[];
}): TranscriptWord[] | null {
  const answers = session.messages
    .filter((m) => m.role === "candidate" && m.words && m.words.length > 0)
    .map((m) => m.words as TranscriptWord[]);

  return answers.length > 0 ? stitchAnswers(answers) : null;
}
