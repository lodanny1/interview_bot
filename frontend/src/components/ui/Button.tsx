"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "soft" | "danger";
  size?: "sm" | "md";
}

const VARIANTS = {
  primary: "bg-cta text-white hover:bg-cta-hover active:bg-cta-pressed",
  soft: "bg-tinted text-secondary hover:bg-pressed",
  danger: "border border-error bg-card text-error hover:bg-error-bg",
} as const;

const SIZES = {
  sm: "h-9 px-4 text-sm",
  md: "h-10 px-5 text-sm",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
