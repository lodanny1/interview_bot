import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { mockStats, mockUpcoming, mockSessions } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/interview/setup"
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Practice Interview
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Sessions" value={mockStats.totalSessions} />
        <StatCard label="Interviews This Month" value={mockStats.interviewsThisMonth} />
        <StatCard label="Hours Practiced" value={mockStats.hoursPracticed} />
        <StatCard label="Current Streak" value={mockStats.currentStreak} />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Upcoming Interview */}
        <div className="col-span-1 p-5 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase">Upcoming Interview</span>
            <span className="px-2 py-0.5 bg-gray-200 text-xs font-medium rounded">
              In {mockUpcoming.daysUntil} days
            </span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">{mockUpcoming.role}</h3>
          <p className="text-sm text-gray-500 mb-4">
            {mockUpcoming.company} • {mockUpcoming.type}
          </p>
          <Link href="/calendar" className="text-sm font-medium text-gray-700 flex items-center gap-1 hover:text-gray-900">
            Prep Guide <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Prep Progress */}
        <div className="col-span-1 p-5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-gray-500 uppercase mb-3">Prep Progress</span>
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#6b7280"
                strokeWidth="3"
                strokeDasharray="75, 100"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">75%</span>
              <span className="text-xs text-gray-500">Ready</span>
            </div>
          </div>
        </div>

        {/* Calendar Widget */}
        <div className="col-span-1 p-5 bg-gray-50 rounded-xl border border-gray-200">
          <MiniCalendar />
        </div>
      </div>

      {/* Recent Practice Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Practice Sessions</h2>
          <Link href="/interviews" className="text-sm text-gray-500 hover:text-gray-700">
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {mockSessions.slice(0, 4).map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <ModeIcon mode={session.mode} />
                <div>
                  <p className="font-medium text-gray-900">{session.title}</p>
                  <p className="text-sm text-gray-500">
                    {session.duration} min • {session.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Score</p>
                  <p className="text-lg font-bold text-gray-900">{session.score}%</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  const icons: Record<string, string> = { text: "💬", voice: "🎙️", avatar: "🎥" };
  return (
    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-lg">
      {icons[mode] || "💬"}
    </div>
  );
}

function MiniCalendar() {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">May 2026</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d) => (
          <span key={d} className="text-[10px] font-medium text-gray-500">{d}</span>
        ))}
        {Array.from({ length: 35 }, (_, i) => {
          const day = i - 3; // offset for month start
          const num = day >= 0 && day < 31 ? day + 1 : null;
          return (
            <span
              key={i}
              className={`text-xs py-1 rounded ${num === 6 ? "bg-green-100 text-green-700 font-bold" : "text-gray-600"} ${!num ? "text-gray-300" : ""}`}
            >
              {num || ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
