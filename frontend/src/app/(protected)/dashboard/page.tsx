import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronRight,
  Code2,
  BrainCircuit,
  Mic,
  Info,
  Lightbulb,
  CheckCircle2,
  Play,
  Target,
  Timer,
  TrendingUp,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { mockUpcoming, mockSessions, mockUser } from "@/lib/mock-data";

// Not in mock data yet — swap for real values when available.
const dailyGoal = { done: 45, target: 60 };
const upcomingTime = "2:00 PM";
const upcomingDuration = 45;

type Tag = { label: string; tone: "good" | "improve" };
type Session = (typeof mockSessions)[number] & { tags?: Tag[] };

export default function DashboardPage() {
  const sessions = (mockSessions as Session[]).slice(0, 2);

  return (
    <div className="p-10 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-primary mb-2">
            Welcome back, {mockUser.name.split(" ")[0]}.
          </h1>
          <p className="text-lg text-tertiary">
            You have 1 upcoming interview and 3 tasks to complete today.
          </p>
        </div>
      </div>

      {/* Top Row */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6 mb-10">
        <DailyGoalCard done={dailyGoal.done} target={dailyGoal.target} />
        <UpcomingCard />
      </div>

      {/* Recent Practice Analysis */}
      <section className="p-6 bg-card rounded-2xl border border-line-subtle shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-2 border-b border-line-subtle">
          <h2 className="text-2xl font-medium text-primary">
            Recent Practice Analysis
          </h2>
          <Link
            href="/interviews"
            className="flex items-center gap-1 text-sm font-semibold text-link hover:text-link-hover"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-line-subtle">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DailyGoalCard({ done, target }: { done: number; target: number }) {
  const pct = Math.min(100, Math.round((done / target) * 100));
  const onTrack = pct >= 50;
  return (
    <div className="p-6 bg-card rounded-2xl border border-line-subtle shadow-sm flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-medium text-primary">Daily Goal</h3>
          <p className="text-sm text-tertiary">Practice minutes</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-tinted flex items-center justify-center">
          <Target className="w-5 h-5 text-cta" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-2">
        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke="var(--bg-cta)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${pct}, 100`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-medium text-primary leading-none">
              {done}
            </span>
            <span className="font-mono text-[11px] text-tertiary mt-1">
              / {target} min
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 px-3 py-2 rounded-full bg-success-bg text-center">
        <span className="font-mono text-xs text-success-text">
          {onTrack
            ? "On track to meet weekly target"
            : "Keep going to hit today's goal"}
        </span>
      </div>
    </div>
  );
}

function UpcomingCard() {
  return (
    <div className="p-6 rounded-2xl bg-nav-section text-white shadow-sm flex flex-col justify-between min-h-[250px]">
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 font-mono text-xs uppercase tracking-wider">
          <CalendarDays className="w-3.5 h-3.5" />
          Upcoming Today
        </span>
        <span className="text-2xl font-medium">{upcomingTime}</span>
      </div>

      <div>
        <h3 className="text-4xl font-bold tracking-tight mb-3">
          {mockUpcoming.role}
        </h3>
        <div className="flex items-center gap-6 text-white/85 mb-6">
          <span className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {mockUpcoming.company}
          </span>
          <span className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            {upcomingDuration} Min • {mockUpcoming.type}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-nav-section text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Prep Session
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 px-5 py-3 border border-white/40 text-white text-sm font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            <Info className="w-4 h-4" />
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

const modeIcons: Record<string, LucideIcon> = {
  text: Code2,
  voice: Mic,
  avatar: BrainCircuit,
};

function SessionRow({ session }: { session: Session }) {
  const Icon = modeIcons[session.mode] ?? MessageSquare;
  return (
    <Link
      href="/interviews"
      className="flex items-center gap-4 py-5 hover:bg-hover/40 transition-colors -mx-2 px-2 rounded-lg"
    >
      <div className="w-12 h-12 shrink-0 rounded-xl bg-card border border-line flex items-center justify-center">
        <Icon className="w-5 h-5 text-secondary" />
      </div>

      <div className="min-w-0">
        <p className="text-lg font-medium text-primary truncate">
          {session.title}
        </p>
        <p className="text-tertiary">
          {session.date} • {session.duration} mins
        </p>
      </div>

      <div className="flex-1 flex flex-wrap items-center gap-2 justify-start pl-2">
        {session.tags?.map((tag) => (
          <span
            key={tag.label}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] ${
              tag.tone === "good"
                ? "bg-success-bg text-success-text"
                : "bg-info-bg text-info-text border border-line-subtle"
            }`}
          >
            {tag.tone === "good" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Lightbulb className="w-3.5 h-3.5" />
            )}
            {tag.label}
          </span>
        ))}
      </div>

      <div className="text-right shrink-0">
        <p className="text-2xl font-medium text-primary leading-tight">
          {session.score}/100
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-tertiary">
          Overall Score
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-tertiary shrink-0" />
    </Link>
  );
}
