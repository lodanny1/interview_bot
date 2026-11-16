// Word-level timing for spoken answers (speech-to-text output, Issue #23).
// Used by speech pace (#27), pause (#28) and delivery metrics (#33).
//
// Shape: [{ text: "hello", start: 0.12, end: 0.48 }, ...]
// Times are SECONDS from the start of THAT answer's audio.

const MAX_WORDS = 5000;
const MAX_TEXT_LENGTH = 100;

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Cleans word timing sent with a spoken answer.
 *
 * Returns a new array of { text, start, end }, or null when the input is
 * missing or unusable. It is all-or-nothing: a partly valid list would give
 * wrong pace and pause numbers, so one bad word drops the whole list. The
 * answer text is still saved, so the session stays usable (the metrics card
 * then shows "unavailable" instead of made-up numbers).
 */
function sanitizeWords(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_WORDS) {
    return null;
  }

  const words = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const { text, start, end } = item;

    if (typeof text !== "string" || !text.trim()) {
      return null;
    }

    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start
    ) {
      return null;
    }

    words.push({
      text: text.trim().slice(0, MAX_TEXT_LENGTH),
      start: round3(start),
      end: round3(end),
    });
  }

  return words;
}

module.exports = {
  sanitizeWords,
  MAX_WORDS,
  MAX_TEXT_LENGTH,
};
