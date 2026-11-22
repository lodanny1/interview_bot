import type { MetricResult } from "@/types/speech";
import type { PauseBand, PauseResult } from "@/types/speech-pauses";
import MetricFallback from "./MetricFallback";
import { MetricRow, type BadgeStyle } from "./MetricRow";

const PAUSE_BADGE: Record<PauseBand, BadgeStyle> = {
  fluent: { label: "FLUENT", className: "bg-success-bg text-success-text" },
  some_hesitation: { label: "SOME HESITATION", className: "bg-warning-bg text-warning-text" },
  frequent: { label: "FREQUENT PAUSES", className: "bg-error-bg text-error-text" },
};

function pauseTip(pauses: PauseResult): string {
  if (pauses.totalPauses === 0) return "No noticeable pauses. Your delivery was steady.";
  if (pauses.longPauses > 0) {
    return 'Long silences can read as uncertainty. Try a short bridge phrase like "let me think about that" instead.';
  }
  if (pauses.band === "fluent") {
    return "A few short pauses is natural. Use them to organize your next point.";
  }
  return "Try to plan the shape of your answer first, so you pause less mid-sentence.";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-subtle bg-app px-2 py-2">
      <dt className="font-mono text-[10px] uppercase text-tertiary">{label}</dt>
      <dd className="font-semibold text-primary">{value}</dd>
    </div>
  );
}

interface PauseMetricProps {
  result: MetricResult<PauseResult>;
  onRetry?: () => void;
}

/** "Pauses Detected" section of the Speech Analysis card (#28). */
export default function PauseMetric({ result, onRetry }: PauseMetricProps) {
  if (result.status !== "ready") {
    return <MetricFallback label="Pauses" result={result} onRetry={onRetry} />;
  }
  const pauses = result.data;
  const longOnes = pauses.pauses.filter((p) => p.isLong).slice(0, 3);

  return (
    <section aria-labelledby="pauses-heading">
      <h3 id="pauses-heading" className="mb-2 font-semibold text-primary">
        Pauses Detected
      </h3>
      <MetricRow
        label="Fluency"
        value={`${pauses.totalPauses} ${pauses.totalPauses === 1 ? "pause" : "pauses"}`}
        badge={PAUSE_BADGE[pauses.band]}
      />

      {pauses.totalPauses > 0 && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Long (2s+)" value={String(pauses.longPauses)} />
          <Stat label="Average" value={`${pauses.averagePauseSeconds}s`} />
          <Stat label="Longest" value={`${pauses.longestPauseSeconds}s`} />
        </dl>
      )}

      {longOnes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {longOnes.map((p) => (
            <li
              key={`${p.start}-${p.end}`}
              className="rounded-full border border-line bg-tinted px-3 py-1 font-mono text-xs text-primary"
            >
              {`${p.durationSeconds}s after "${p.afterWord}"`}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 font-mono text-xs text-secondary">{pauseTip(pauses)}</p>
    </section>
  );
}
