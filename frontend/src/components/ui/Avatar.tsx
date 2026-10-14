import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  initials: string;
  size?: "md" | "lg";
  /** Small overlay in the bottom-right corner (e.g. a camera icon). */
  badge?: ReactNode;
}

export function Avatar({ initials, size = "md", badge }: Props) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-tinted font-bold text-link",
        size === "lg" ? "size-16 text-xl" : "size-10 text-sm",
      )}
    >
      {initials}
      {badge ? (
        <span className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full bg-cta text-white">
          {badge}
        </span>
      ) : null}
    </span>
  );
}
