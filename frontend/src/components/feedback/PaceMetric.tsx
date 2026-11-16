import type { MetricResult, PaceBand, PaceResult } from "@/types/speech";
import MetricFallback from "./MetricFallback";
import { MetricRow, type BadgeStyle } from "./MetricRow";

const PACE_BADGE: Record<PaceBand, BadgeStyle> = {
  slow: { label: "SLOW", className: "bg-warning-bg text-warning-text" },
  optimal: { label: "OPTIMAL", className: "bg-success-bg text-success-text" },
  fast: { label: "FAST", className: "bg-warning-bg text-warning-text" },
};

const PACE_TIP: Record<PaceBand, string> = {
  slow: "Try picking up the pace a little. Aim for 120-160 words per minute.",
  optimal: "Your pace sits in a comfortable conversational range.",
  fast: "Slow down slightly so each point lands. Aim for 120-160 words per minute.",
};

interface PaceMetricProps {
  result: MetricResult<PaceResult>;
  onRetry?: () => void;
}

/** The "Pacing  135 wpm  OPTIMAL" row from the Speech Analysis card (#27). */
export default function PaceMetric({ result, onRetry }: PaceMetricProps) {
  if (result.status !== "ready") {
    return <MetricFallback label="Pacing" result={result} onRetry={onRetry} />;
  }
  const pace = result.data;
  return (
    <div>
      <MetricRow label="Pacing" value={`${pace.wpm} wpm`} badge={PACE_BADGE[pace.band]} />
      <p className="mt-2 font-mono text-xs text-secondary">{PACE_TIP[pace.band]}</p>
    </div>
  );
}
