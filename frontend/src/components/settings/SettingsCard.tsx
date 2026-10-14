import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** "danger" tints the icon tile red. Use for destructive sections. */
  tone?: "default" | "danger";
  /** Slot at the right of the header, e.g. a status Badge. */
  headerEnd?: ReactNode;
  children: ReactNode;
}

/** Section container used by every block on the settings page. */
export function SettingsCard({
  icon: Icon,
  title,
  description,
  tone = "default",
  headerEnd,
  children,
}: SettingsCardProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-line-subtle bg-card p-5 pb-6"
    >
      <header className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-error-bg text-error"
              : "bg-tinted text-secondary",
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-[17px] font-semibold leading-tight text-primary"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-secondary">{description}</p>
        </div>
        {headerEnd ? <div className="ml-auto">{headerEnd}</div> : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
