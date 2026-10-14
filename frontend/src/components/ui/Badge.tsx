import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-0.5 font-mono text-[11px] font-semibold text-success-text">
      {children}
    </span>
  );
}
