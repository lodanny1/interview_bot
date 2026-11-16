"use client";

import type { MetricNotReady } from "@/types/speech";

interface MetricFallbackProps {
  /** Short name of the metric, e.g. "Pacing", "Pauses", "Speech metrics". */
  label: string;
  result: MetricNotReady;
  /** Re-run the analysis / refetch the transcript. Only used for failures. */
  onRetry?: () => void;
}

/**
 * Shared AC 2 / AC 3 state for any speech metric.
 * - unavailable: nothing to analyze. Calm, informational.
 * - failed: something broke. Clear message plus a retry, and the rest of the page keeps working.
 */
export default function MetricFallback({ label, result, onRetry }: MetricFallbackProps) {
  if (result.status === "unavailable") {
    return (
      <div role="status" className="rounded-lg border border-line bg-app p-4 text-sm text-secondary">
        <p className="font-semibold text-primary">{label} unavailable</p>
        <p className="mt-1">{result.message}</p>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-lg border border-input-error bg-error-bg p-4">
      <p className="font-semibold text-error-text">
        We couldn&apos;t analyze your {label.toLowerCase()}
      </p>
      <p className="mt-1 text-sm text-error-text">{result.message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-inverse hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Retry analysis
        </button>
      )}
    </div>
  );
}
