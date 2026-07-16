"use client";

import { useState } from "react";
import { List, LayoutGrid, Search, ArrowUpDown, MessageSquare, Mic, User } from "lucide-react";
import { mockSessions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { InterviewMode } from "@/types/interview";

export default function InterviewsPage() {
  const [view, setView] = useState<"list" | "grid">("list");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
          <p className="text-sm text-gray-500">View practice interview sessions</p>
        </div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setView("list")}
            className={cn("p-2 rounded", view === "list" ? "bg-gray-200" : "hover:bg-gray-100")}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn("p-2 rounded", view === "grid" ? "bg-gray-200" : "hover:bg-gray-100")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search"
          className="w-full max-w-sm pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      {view === "list" ? <ListView /> : <GridView />}
    </div>
  );
}

function ListView() {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
        <span></span>
        <span className="flex items-center gap-1">Mode <ArrowUpDown className="w-3 h-3" /></span>
        <span className="flex items-center gap-1">Title <ArrowUpDown className="w-3 h-3" /></span>
        <span className="flex items-center gap-1">Industry <ArrowUpDown className="w-3 h-3" /></span>
        <span className="flex items-center gap-1">Role <ArrowUpDown className="w-3 h-3" /></span>
        <span className="flex items-center gap-1">Duration <ArrowUpDown className="w-3 h-3" /></span>
        <span className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></span>
      </div>
      {/* Rows */}
      {mockSessions.slice(0, 5).map((session) => (
        <div
          key={session.id}
          className="grid grid-cols-7 gap-4 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer items-center"
        >
          <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
          <ModeIconSmall mode={session.mode} />
          <span className="text-sm font-medium text-gray-900">{session.title}</span>
          <span className="text-sm text-gray-600">{session.industry}</span>
          <span className="text-sm text-gray-600">{session.role}</span>
          <span className="text-sm text-gray-600">{session.duration} min</span>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{session.date}</span>
            <ScoreBadge score={session.score} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GridView() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {mockSessions.map((session) => (
        <div
          key={session.id}
          className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <ModeIconSmall mode={session.mode} />
            <ScoreBadge score={session.score} />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">{session.title}</h3>
          <p className="text-sm text-gray-500">
            {session.industry} • {session.role} • {session.duration} min • {session.date}
          </p>
        </div>
      ))}
    </div>
  );
}

function ModeIconSmall({ mode }: { mode: InterviewMode }) {
  const iconMap = {
    text: MessageSquare,
    voice: Mic,
    avatar: User,
  };
  const Icon = iconMap[mode];
  return <Icon className="w-5 h-5 text-gray-600" />;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-100 text-green-800" :
    score >= 60 ? "bg-yellow-100 text-yellow-800" :
    "bg-red-100 text-red-800";
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", color)}>
      {score}%
    </span>
  );
}
