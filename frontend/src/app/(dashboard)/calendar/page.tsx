"use client";

import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { mockChecklist } from "@/lib/mock-data";

export default function CalendarPage() {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const calendarDays = generateCalendarDays(2026, 4); // May 2026 (0-indexed)

  return (
    <div className="p-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-500">Log upcoming interview dates</p>
      </div>

      <div className="flex gap-8 mt-6">
        {/* Calendar */}
        <div className="flex-1">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-semibold">May 2026</h2>
              <button className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium">
                Month ▾
              </button>
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium">
                + New Interview
              </button>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 pb-2 mb-2">
            {days.map((d) => (
              <span key={d} className="text-center text-xs font-semibold text-gray-500">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => (
              <div
                key={i}
                className="h-20 border border-gray-100 p-1 relative"
              >
                {day.num && (
                  <>
                    <span className="text-sm text-gray-700">{day.num}</span>
                    {day.num === 6 && (
                      <div className="mt-1">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-[10px] text-gray-600">Cafe</span>
                        </div>
                        <span className="text-[10px] text-gray-400 ml-3">9:00 AM</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 space-y-8">
          {/* Pre-interview Checklist */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pre-interview Checklist</h3>
            <div className="space-y-3">
              {mockChecklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.company}</p>
                    <p className="text-sm text-gray-500">{item.role}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Difficulty</h3>
            <div className="space-y-3">
              <DifficultyRow label="Easy" color="bg-green-500" />
              <DifficultyRow label="Medium" color="bg-yellow-400" />
              <DifficultyRow label="Hard" color="bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DifficultyRow({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </div>
  );
}

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { num: number | null }[] = [];

  for (let i = 0; i < firstDay; i++) days.push({ num: null });
  for (let i = 1; i <= daysInMonth; i++) days.push({ num: i });
  while (days.length < 35) days.push({ num: null });

  return days;
}
