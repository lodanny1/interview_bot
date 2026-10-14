import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SettingRowProps {
  /** Both optional: a row can be a title + control, or a note + control (see Delete Account). */
  title?: string;
  description?: ReactNode;
  /** Icon/logo tile shown before the text. */
  leading?: ReactNode;
  /** Anything interactive on the right: Toggle, Button, ... */
  control?: ReactNode;
  /** Tinted background panel (used for connection / plan / danger rows). */
  filled?: boolean;
}

export function SettingRow({
  title,
  description,
  leading,
  control,
  filled = false,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg py-3",
        filled ? "bg-app px-4" : "px-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-secondary">
            {leading}
          </span>
        ) : null}
        <div className="min-w-0">
          {title ? (
            <p className="text-sm font-semibold text-primary">{title}</p>
          ) : null}
          {description ? (
            <p className="text-[13px] text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      {control}
    </div>
  );
}
