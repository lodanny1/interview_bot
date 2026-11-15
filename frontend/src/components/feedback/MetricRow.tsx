export interface BadgeStyle {
  label: string;
  className: string;
}

export function Badge({ label, className }: BadgeStyle) {
  return (
    <span
      className={`rounded px-2 py-1 font-mono text-[10px] font-bold tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

/** One "label ... value [BADGE]" row, matching the Pacing row in the feedback mockup. */
export function MetricRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge: BadgeStyle;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line-subtle bg-app px-4 py-3">
      <span className="font-semibold text-primary">{label}</span>
      <span className="flex items-center gap-3">
        <span className="font-mono text-sm text-secondary">{value}</span>
        <Badge {...badge} />
      </span>
    </div>
  );
}
