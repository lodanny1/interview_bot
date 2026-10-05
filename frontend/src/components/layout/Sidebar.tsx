"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  TrendingUp,
  Plus,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockUser } from "@/lib/mock-data";
import { canManageUsers } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interviews", label: "Interviews", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = getCurrentUser();
  const showAdminLink = canManageUsers(currentUser);

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-100 border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-gray-600" />
        </div>
        <span className="font-semibold text-gray-800">Interview Bot</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
        
        {showAdminLink && (
          <Link
            href="/admin/users"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-gray-800 text-white"
                : "text-gray-600 hover:bg-gray-200"
            )}
          >
            <Users className="w-4 h-4" />
            Admin Users
          </Link>
        )}

      </nav>

      {/* Practice Interview Button */}
      <div className="px-3 py-2">
        <Link
          href="/interview/setup"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Practice Interview
        </Link>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 px-4 py-4 border-t border-gray-200">
        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{mockUser.name}</p>
          <p className="text-xs text-gray-500">{mockUser.plan}</p>
        </div>
      </div>
    </aside>
  );
}
