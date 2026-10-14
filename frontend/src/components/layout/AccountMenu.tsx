"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { CircleHelp, LogOut, Settings, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export type AccountMenuEntry =
  | { type: "link"; label: string; href: string; icon: LucideIcon }
  | { type: "action"; label: string; icon: LucideIcon; onSelect: () => void }
  | { type: "divider" };

export interface AccountMenuUser {
  name: string;
  plan: string;
  /** Defaults to the first letter of `name`. */
  initial?: string;
}

interface Props {
  user: AccountMenuUser;
  onSignOut: () => void;
  /** Override to add/remove entries. Defaults to Settings, Help, divider, Sign out. */
  items?: AccountMenuEntry[];
  className?: string;
}

function defaultItems(onSignOut: () => void): AccountMenuEntry[] {
  return [
    { type: "link", label: "Settings", href: "/settings", icon: Settings },
    { type: "link", label: "Help", href: "/help", icon: CircleHelp },
    { type: "divider" },
    { type: "action", label: "Sign out", icon: LogOut, onSelect: onSignOut },
  ];
}

const ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-md py-2.5 text-left text-sm font-semibold text-primary " +
  "hover:text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * Sidebar footer button + popup. Colors inherit from the sidebar (`currentColor`) for the
 * trigger; the popup uses card tokens so it reads on any sidebar background.
 */
export function AccountMenu({ user, onSignOut, items, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const entries = items ?? defaultItems(onSignOut);

  const menuItems = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );

  // Close on outside pointer-down.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    const els = menuItems();
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      className={cn("relative", className)}
    >
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute inset-x-2 bottom-full z-20 mb-1 rounded-xl border border-line bg-card px-4 py-2 shadow-lg"
        >
          {entries.map((entry, idx) => {
            if (entry.type === "divider") {
              return (
                <div
                  key={`divider-${idx}`}
                  role="separator"
                  className="my-1 h-px bg-line"
                />
              );
            }
            const Icon = entry.icon;
            const content = (
              <>
                <Icon className="size-5 text-link" aria-hidden />
                {entry.label}
              </>
            );
            return entry.type === "link" ? (
              <Link
                key={entry.label}
                href={entry.href}
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => close()}
              >
                {content}
              </Link>
            ) : (
              <button
                key={entry.label}
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => {
                  close(true);
                  entry.onSelect();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-nav-section/60 aria-expanded:bg-nav-section/60 focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        <Avatar initials={user.initial ?? user.name.charAt(0).toUpperCase()} />
        <span className="min-w-0">
          <span className="block text-sm font-bold">{user.name}</span>
          <span className="block text-xs opacity-70">{user.plan}</span>
        </span>
      </button>
    </div>
  );
}
