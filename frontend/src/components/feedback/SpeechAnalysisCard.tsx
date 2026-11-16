import type { ReactNode } from "react";
import type { SpeechMetrics } from "@/lib/speech/metrics";
import MetricFallback from "./MetricFallback";
import PaceMetric from "./PaceMetric";
import PauseMetric from "./PauseMetric";

interface SpeechAnalysisCardProps {
  metrics: SpeechMetrics;
  /** Re-run analysis / refetch the transcript. Shown on failure states. */
  onRetry?: () => void;
  /** Slot for issue #26's filler-word chips so all delivery metrics share one card. */
  fillerWords?: ReactNode;
}

/**
 * "Speech Analysis" card from the feedback report (#33).
 * Pace (#27) and pauses (#28) each render their own states, so one failing
 * never hides the other. If both are down for the same reason, show one message.
 */
export default function SpeechAnalysisCard({
  metrics,
  onRetry,
  fillerWords,
}: SpeechAnalysisCardProps) {
  const { pace, pauses } = metrics;
  const bothDown = pace.status !== "ready" && pauses.status !== "ready" ? pace : null;

  return (
    <div className="rounded-xl border border-line-subtle bg-card p-6 shadow-sm">
      <h2 className="mb-5 text-xl font-semibold text-primary">Speech Analysis</h2>

      <div className="flex flex-col gap-6">
        {bothDown ? (
          <MetricFallback label="Speech metrics" result={bothDown} onRetry={onRetry} />
        ) : (
          <PaceMetric result={pace} onRetry={onRetry} />
        )}

        {fillerWords}

        {!bothDown && <PauseMetric result={pauses} onRetry={onRetry} />}
      </div>
    </div>
  );
}
