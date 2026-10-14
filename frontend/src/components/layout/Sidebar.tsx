"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/layout/AccountMenu";
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  BarChart3,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockUser } from "@/lib/mock-data";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interviews", label: "Interviews", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-card border-r border-line-subtle">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-24 border-b border-line-subtle">
        <div className="w-10 h-10 bg-cta rounded-xl flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-semibold text-primary">InterviewBot</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                isActive
                  ? "bg-hover text-link border-r-4 border-cta"
                  : "text-secondary hover:bg-hover",
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* New Practice Interview Button */}
      <div className="px-4 pb-6">
        <Link
          href="/interview/setup"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-cta text-white text-sm font-medium rounded-lg hover:bg-cta-hover active:bg-cta-pressed transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Practice Interview
        </Link>
      </div>

      {/* User */}
      <div className="border-t border-gray-200 px-3 py-3 text-gray-800 cursor-pointer">
        <AccountMenu
          user={{ name: mockUser.name, plan: mockUser.plan }}
          onSignOut={() => {
            // TODO: call your sign-out
          }}
        />
      </div>
    </aside>
  );
}
