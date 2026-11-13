// Score labels and colors shared by the feedback report and per-question
// feedback (Issues #30 and #31).

export function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Developing";
  return "Needs work";
}

export function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-sky-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function scoreBadgeColor(score: number) {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 60) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (score >= 40) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

// Anchor id for a question's feedback card, so Q1/Q2 tags can link to it.
export function questionFeedbackId(number: number) {
  return `question-feedback-${number}`;
}
