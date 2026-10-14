"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  className?: string;
}

export function TextField({ label, value, onChange, type = "text", autoComplete, className }: Props) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg bg-app px-3 text-sm text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      />
    </div>
  );
}
