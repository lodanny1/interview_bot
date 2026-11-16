"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowUpDown,
  LayoutGrid,
  List,
  MessageSquare,
  Mic,
  Search,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  InterviewHistoryItem,
} from "@/lib/interview/interview-api";

import type {
  InterviewMode,
} from "@/types/interview";

export default function InterviewsPage() {
  const [view, setView] =
    useState<"list" | "grid">("list");

  const [sessions, setSessions] =
    useState<InterviewHistoryItem[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/interview/history",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const body = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          throw new Error(
            body?.error ||
              "Unable to load interview history."
          );
        }

        if (!cancelled) {
          setSessions(
            Array.isArray(body?.sessions)
              ? body.sessions
              : []
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load interview history."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSessions =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return sessions;
      }

      return sessions.filter(
        (session) =>
          session.title
            .toLowerCase()
            .includes(query) ||
          (session.industry || "")
            .toLowerCase()
            .includes(query) ||
          (session.role || "")
            .toLowerCase()
            .includes(query)
      );
    }, [sessions, search]);

  return (
    <div className="p-8">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Interviews
          </h1>

          <p className="text-sm text-gray-500">
            View practice interview sessions
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            onClick={() =>
              setView("list")
            }
            className={cn(
              "rounded p-2",
              view === "list"
                ? "bg-gray-200"
                : "hover:bg-gray-100"
            )}
          >
            <List className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              setView("grid")
            }
            className={cn(
              "rounded p-2",
              view === "grid"
                ? "bg-gray-200"
                : "hover:bg-gray-100"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mb-6 mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <input
          type="text"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search"
          className="w-full max-w-sm rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading interview history...
        </div>
      )}

      {error && (
        <div className="py-12 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        filteredSessions.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="font-medium text-gray-900">
              No interviews found
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Completed practice interviews will appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        filteredSessions.length > 0 &&
        (view === "list" ? (
          <ListView
            sessions={
              filteredSessions
            }
          />
        ) : (
          <GridView
            sessions={
              filteredSessions
            }
          />
        ))}
    </div>
  );
}

function ListView({
  sessions,
}: {
  sessions: InterviewHistoryItem[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="grid grid-cols-7 gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium uppercase text-gray-500">
        <span></span>

        <span className="flex items-center gap-1">
          Mode
          <ArrowUpDown className="h-3 w-3" />
        </span>

        <span className="flex items-center gap-1">
          Title
          <ArrowUpDown className="h-3 w-3" />
        </span>

        <span className="flex items-center gap-1">
          Industry
          <ArrowUpDown className="h-3 w-3" />
        </span>

        <span className="flex items-center gap-1">
          Role
          <ArrowUpDown className="h-3 w-3" />
        </span>

        <span className="flex items-center gap-1">
          Duration
          <ArrowUpDown className="h-3 w-3" />
        </span>

        <span className="flex items-center gap-1">
          Date
          <ArrowUpDown className="h-3 w-3" />
        </span>
      </div>

      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/interviews/${session.id}`}
          className="grid grid-cols-7 items-center gap-4 border-b border-gray-100 px-4 py-4 transition-colors hover:bg-gray-50"
        >
          <StatusDot
            status={session.status}
          />

          <ModeIconSmall
            mode={session.mode}
          />

          <span className="text-sm font-medium text-gray-900">
            {session.title}
          </span>

          <span className="text-sm text-gray-600">
            {session.industry ||
              "—"}
          </span>

          <span className="text-sm text-gray-600">
            {session.role || "—"}
          </span>

          <span className="text-sm text-gray-600">
            {session.durationMinutes} min
          </span>

          <span className="text-sm text-gray-600">
            {formatDate(
              session.startedAt
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

function GridView({
  sessions,
}: {
  sessions: InterviewHistoryItem[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/interviews/${session.id}`}
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:bg-gray-100"
        >
          <div className="mb-3 flex items-center justify-between">
            <ModeIconSmall
              mode={session.mode}
            />

            <StatusBadge
              status={session.status}
            />
          </div>

          <h3 className="mb-1 font-semibold text-gray-900">
            {session.title}
          </h3>

          <p className="text-sm text-gray-500">
            {session.industry ||
              "No industry"}{" "}
            • {session.role || "No role"} •{" "}
            {session.durationMinutes} min
          </p>

          <p className="mt-2 text-xs text-gray-400">
            {formatDate(
              session.startedAt
            )}
          </p>
        </Link>
      ))}
    </div>
  );
}

function ModeIconSmall({
  mode,
}: {
  mode: InterviewMode;
}) {
  const iconMap = {
    text: MessageSquare,
    voice: Mic,
    avatar: User,
  };

  const Icon = iconMap[mode];

  return (
    <Icon className="h-5 w-5 text-gray-600" />
  );
}

function StatusDot({
  status,
}: {
  status: InterviewHistoryItem["status"];
}) {
  return (
    <div
      title={status}
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        status === "COMPLETED"
          ? "bg-green-500"
          : status === "ABANDONED"
            ? "bg-red-400"
            : status === "PAUSED"
              ? "bg-blue-400"
              : "bg-yellow-400",
      )}
    />
  );
}

function StatusBadge({
  status,
}: {
  status: InterviewHistoryItem["status"];
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        status === "COMPLETED"
          ? "bg-green-100 text-green-700"
          : status === "ABANDONED"
            ? "bg-red-100 text-red-700"
            : status === "PAUSED"
              ? "bg-blue-100 text-blue-700"
              : "bg-yellow-100 text-yellow-700",
      )}
    >
      {status === "COMPLETED"
        ? "Completed"
        : status === "ABANDONED"
          ? "Abandoned"
          : status === "PAUSED"
            ? "Paused"
            : "Active"}
    </span>
  );
}

function formatDate(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}
