// Per Question Feedback (Issue #31). Shows feedback on each answered question
// of a finished interview: the question, the user's answer, a score, and what
// worked and what to improve. Questions without feedback say why instead of
// showing a made-up score.

import { CheckCircle2, Lightbulb, MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  QUESTION_FEEDBACK_MESSAGES,
  type QuestionFeedback,
} from "@/lib/feedback/feedback-state";
import { questionFeedbackId, scoreBadgeColor, scoreLabel } from "@/lib/feedback/feedback-score";

export const QUESTION_FEEDBACK_COPY = {
  heading: "Question-by-question feedback",
  description: "How each of your answers did on its own.",
  yourAnswer: "Your answer",
  worked: "What worked",
  improve: "To improve",
  noQuestionText: "(Question text not saved)",
} as const;

interface QuestionFeedbackListProps {
  questions: QuestionFeedback[];
}

export function QuestionFeedbackList({ questions }: QuestionFeedbackListProps) {
  if (questions.length === 0) return null;

  return (
    <section
      aria-labelledby="question-feedback-heading"
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 id="question-feedback-heading" className="font-semibold text-gray-900">
          {QUESTION_FEEDBACK_COPY.heading}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{QUESTION_FEEDBACK_COPY.description}</p>
      </div>

      <ol className="divide-y divide-gray-100">
        {questions.map((item) => (
          <QuestionFeedbackItem key={item.number} item={item} />
        ))}
      </ol>
    </section>
  );
}

function QuestionFeedbackItem({ item }: { item: QuestionFeedback }) {
  const headingId = `${questionFeedbackId(item.number)}-heading`;

  return (
    <li
      id={questionFeedbackId(item.number)}
      aria-labelledby={headingId}
      className="scroll-mt-6 px-6 py-5"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 id={headingId} className="text-sm font-medium leading-relaxed text-gray-900">
          <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
            Q{item.number}
          </span>
          {item.question || QUESTION_FEEDBACK_COPY.noQuestionText}
        </h3>

        {item.feedbackAvailable && item.score !== null && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
              scoreBadgeColor(item.score)
            )}
            aria-label={`Score ${item.score} out of 100, ${scoreLabel(item.score)}`}
          >
            {item.score} · {scoreLabel(item.score)}
          </span>
        )}
      </div>

      {item.answer && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            {QUESTION_FEEDBACK_COPY.yourAnswer}
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
            {item.answer}
          </p>
        </details>
      )}

      {item.feedbackAvailable ? (
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p className="leading-relaxed">{item.feedback}</p>

          {item.strength && (
            <p className="flex gap-2">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>
                <span className="font-medium text-gray-900">{QUESTION_FEEDBACK_COPY.worked}: </span>
                {item.strength}
              </span>
            </p>
          )}

          {item.improvement && (
            <p className="flex gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                <span className="font-medium text-gray-900">{QUESTION_FEEDBACK_COPY.improve}: </span>
                {item.improvement}
              </span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-gray-500">
          {QUESTION_FEEDBACK_MESSAGES[item.reason ?? "not_reviewed"]}
        </p>
      )}
    </li>
  );
}
