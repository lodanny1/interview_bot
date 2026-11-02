"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ArrowLeft,
  MessageSquare,
  Mic,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  ActiveInterviewSession,
  InterviewMessage,
  InterviewMode,
} from "@/types/interview";

export default function InterviewHistoryDetailPage() {
  const params = useParams();

  const sessionId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [session, setSession] =
    useState<ActiveInterviewSession | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError(
        "Interview session id is missing."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/interview/session?id=${encodeURIComponent(
            sessionId
          )}`,
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
              "Unable to load interview."
          );
        }

        const loadedSession = {
          ...body.session,
          messages:
            body.session.messages.map(
              (
                message: InterviewMessage
              ) => ({
                ...message,
                timestamp: new Date(
                  message.timestamp
                ),
              })
            ),
        };

        if (!cancelled) {
          setSession(loadedSession);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load interview."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading interview...
        </p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-8">
        <Link
          href="/interviews"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to interviews
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-semibold text-red-900">
            Unable to load interview
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <Link
        href="/interviews"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to interviews
      </Link>

      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ModeIcon
              mode={session.mode}
            />

            <StatusBadge
              status={session.status}
            />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            {session.title}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {session.durationMinutes} minute interview
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Interview Transcript
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Full conversation from this practice session.
            </p>
          </div>

          <div className="space-y-6 p-6">
            {session.messages.length ===
            0 ? (
              <p className="text-sm text-gray-500">
                No messages were saved for this interview.
              </p>
            ) : (
              session.messages.map(
                (message) => (
                  <TranscriptMessage
                    key={message.id}
                    message={message}
                  />
                )
              )
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">
              Session Details
            </h2>

            <dl className="mt-4 space-y-4 text-sm">
              <DetailRow
                label="Mode"
                value={
                  session.mode
                    .charAt(0)
                    .toUpperCase() +
                  session.mode.slice(1)
                }
              />

              <DetailRow
                label="Status"
                value={
                  session.status
                    .charAt(0) +
                  session.status
                    .slice(1)
                    .toLowerCase()
                }
              />

              <DetailRow
                label="Duration"
                value={`${session.durationMinutes} min`}
              />

              <DetailRow
                label="Started"
                value={formatDateTime(
                  session.startedAt
                )}
              />

              <DetailRow
                label="Completion"
                value={formatCompletionReason(
                  session.completionReason
                )}
              />
            </dl>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <h2 className="font-semibold text-gray-900">
              Interview Analysis
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Performance analysis, scoring,
              strengths, improvement areas,
              and question-level feedback
              will appear here.
            </p>

            <span className="mt-4 inline-flex rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
              Coming soon
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TranscriptMessage({
  message,
}: {
  message: InterviewMessage;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[85%] items-start gap-3",
        message.role === "candidate" &&
          "ml-auto flex-row-reverse"
      )}
    >
      <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200" />

      <div>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            message.role ===
              "interviewer"
              ? "bg-gray-100 text-gray-900"
              : "bg-gray-700 text-white"
          )}
        >
          {message.content}
        </div>

        <p
          className={cn(
            "mt-1 text-xs text-gray-400",
            message.role ===
              "candidate" &&
              "text-right"
          )}
        >
          {message.role ===
          "interviewer"
            ? "Interviewer"
            : "You"}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500">
        {label}
      </dt>

      <dd className="text-right font-medium text-gray-900">
        {value}
      </dd>
    </div>
  );
}

function ModeIcon({
  mode,
}: {
  mode: InterviewMode;
}) {
  const icons = {
    text: MessageSquare,
    voice: Mic,
    avatar: User,
  };

  const Icon = icons[mode];

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
      <Icon className="h-4 w-4 text-gray-600" />
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status:
    ActiveInterviewSession["status"];
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        status === "COMPLETED"
          ? "bg-green-100 text-green-700"
          : status === "ABANDONED"
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
      )}
    >
      {status === "COMPLETED"
        ? "Completed"
        : status === "ABANDONED"
          ? "Abandoned"
          : "Active"}
    </span>
  );
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatCompletionReason(
  reason:
    | ActiveInterviewSession["completionReason"]
) {
  if (reason === "TIME_LIMIT") {
    return "Time limit reached";
  }

  if (reason === "USER_ENDED") {
    return "Ended by candidate";
  }

  if (reason === "ABANDONED") {
    return "Abandoned";
  }

  return "—";
}
