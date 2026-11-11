"use client";

// Generate Feedback Report (Issue #30). Shown on a finished interview's page.
// Loads the saved report; if none exists yet, asks the backend to generate it
// once, then shows it. The report is saved on the backend, so coming back to
// the page shows the same report without generating it again.

import { useEffect, useState } from "react";
import { CheckCircle2, Lightbulb, Loader2, RefreshCw, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FEEDBACK_API_URL,
  FEEDBACK_MESSAGES,
  parseFeedbackResponse,
  unavailableMessage,
  type FeedbackReport,
  type InterviewFeedback,
} from "@/lib/feedback/feedback-state";

type SessionStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

interface FeedbackReportPanelProps {
  sessionId: string;
  sessionStatus: SessionStatus;
  // For tests; how long to wait between checks while another request generates.
  pollIntervalMs?: number;
}

type PanelState =
  | { phase: "loading" }
  | { phase: "generating" }
  | { phase: "loaded"; feedback: InterviewFeedback }
  | { phase: "error" };

// Each request either just loads the saved state or asks for generation.
type Request = { attempt: number; generate: boolean };

const MAX_POLLS = 40;

export const FEEDBACK_COPY = {
  heading: "Feedback report",
  loading: "Loading feedback…",
  generating: "Generating your feedback report. This can take a few seconds.",
  retry: "Try again",
  strengths: "What went well",
  improvements: "What to improve",
  categories: "Score breakdown",
} as const;

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export function FeedbackReportPanel({
  sessionId,
  sessionStatus,
  pollIntervalMs = 3000,
}: FeedbackReportPanelProps) {
  const [state, setState] = useState<PanelState>({ phase: "loading" });
  const [request, setRequest] = useState<Request>({ attempt: 0, generate: false });

  const isActive = sessionStatus === "ACTIVE";

  useEffect(() => {
    if (isActive) return;

    const controller = new AbortController();

    async function call(generate: boolean): Promise<InterviewFeedback | null> {
      try {
        const response = generate
          ? await fetch(FEEDBACK_API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
              signal: controller.signal,
            })
          : await fetch(`${FEEDBACK_API_URL}?id=${encodeURIComponent(sessionId)}`, {
              cache: "no-store",
              signal: controller.signal,
            });

        if (response.status !== 200 && response.status !== 202) return null;
        return parseFeedbackResponse(await response.json().catch(() => null));
      } catch {
        return null;
      }
    }

    async function run() {
      let generate = request.generate;

      for (let poll = 0; poll <= MAX_POLLS; poll += 1) {
        const feedback = await call(generate);
        if (controller.signal.aborted) return;

        if (!feedback) {
          setState({ phase: "error" });
          return;
        }

        if (feedback.status === "not_generated") {
          // First visit after the interview: generate it now.
          setState({ phase: "generating" });
          generate = true;
          continue;
        }

        if (feedback.status === "generating") {
          // Another request (or tab) is generating it; check back shortly.
          setState({ phase: "generating" });
          generate = false;
          await wait(pollIntervalMs, controller.signal);
          if (controller.signal.aborted) return;
          continue;
        }

        setState({ phase: "loaded", feedback });
        return;
      }

      setState({ phase: "error" });
    }

    void run();

    return () => controller.abort();
  }, [isActive, sessionId, request, pollIntervalMs]);

  function retry(generate: boolean) {
    setState(generate ? { phase: "generating" } : { phase: "loading" });
    setRequest((current) => ({ attempt: current.attempt + 1, generate }));
  }

  return (
    <section
      aria-labelledby="feedback-report-heading"
      className="rounded-xl border border-gray-200 bg-white p-5"
    >
      <h2 id="feedback-report-heading" className="font-semibold text-gray-900">
        {FEEDBACK_COPY.heading}
      </h2>

      {isActive ? (
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          {FEEDBACK_MESSAGES.notCompleted}
        </p>
      ) : (
        <PanelBody state={state} onRetry={retry} />
      )}
    </section>
  );
}

function PanelBody({
  state,
  onRetry,
}: {
  state: PanelState;
  onRetry: (generate: boolean) => void;
}) {
  if (state.phase === "loading" || state.phase === "generating") {
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {state.phase === "loading" ? FEEDBACK_COPY.loading : FEEDBACK_COPY.generating}
      </p>
    );
  }

  if (state.phase === "error") {
    return <Notice message={FEEDBACK_MESSAGES.loadError} onRetry={() => onRetry(false)} />;
  }

  const { feedback } = state;

  if (feedback.status === "ready" && feedback.report) {
    return <Report report={feedback.report} generatedAt={feedback.generatedAt} />;
  }

  if (feedback.status === "failed") {
    return <Notice message={FEEDBACK_MESSAGES.failed} onRetry={() => onRetry(true)} />;
  }

  if (feedback.status === "unavailable") {
    return (
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {unavailableMessage(feedback.reason)}
      </p>
    );
  }

  // not_completed can show up if the session status changed under us.
  return (
    <p className="mt-2 text-sm leading-relaxed text-gray-500">{FEEDBACK_MESSAGES.notCompleted}</p>
  );
}

function Notice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {FEEDBACK_COPY.retry}
      </button>
    </div>
  );
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Developing";
  return "Needs work";
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-sky-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function questionLabel(numbers: number[]) {
  if (numbers.length === 0) return null;
  return numbers.map((n) => `Q${n}`).join(", ");
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Report({ report, generatedAt }: { report: FeedbackReport; generatedAt: string | null }) {
  const generated = formatDate(generatedAt);

  return (
    <div className="mt-4 space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4 border-gray-900"
          aria-label={`Overall score ${report.overallScore} out of 100`}
        >
          <span className="text-xl font-bold text-gray-900">{report.overallScore}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{scoreLabel(report.overallScore)}</p>
          <p className="text-xs text-gray-500">Overall score out of 100</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-gray-700">{report.summary}</p>

      {report.categories.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {FEEDBACK_COPY.categories}
          </h3>
          <ul className="space-y-3">
            {report.categories.map((category) => (
              <li key={category.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{category.label}</span>
                  <span className="text-gray-600">{category.score}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn("h-full rounded-full", scoreColor(category.score))}
                    style={{ width: `${category.score}%` }}
                  />
                </div>
                {category.comment && (
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{category.comment}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.strengths.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {FEEDBACK_COPY.strengths}
          </h3>
          <ul className="space-y-2">
            {report.strengths.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm text-gray-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  {item.point}
                  <QuestionRefs numbers={item.questionNumbers} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.improvements.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {FEEDBACK_COPY.improvements}
          </h3>
          <ul className="space-y-3">
            {report.improvements.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm text-gray-700">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  {item.point}
                  <QuestionRefs numbers={item.questionNumbers} />
                  {item.suggestion && (
                    <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                      Try: {item.suggestion}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-gray-100 pt-3 text-xs text-gray-400">
        Based on {report.questionsAnswered} answered{" "}
        {report.questionsAnswered === 1 ? "question" : "questions"}
        {generated ? ` · Generated ${generated}` : ""}
      </p>
    </div>
  );
}

function QuestionRefs({ numbers }: { numbers: number[] }) {
  const label = questionLabel(numbers);
  if (!label) return null;

  return (
    <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
      {label}
    </span>
  );
}
