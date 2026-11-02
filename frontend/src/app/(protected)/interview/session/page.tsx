"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import InterviewSession from "@/components/interview/InterviewSession";
import type {
  ActiveInterviewSession,
  InterviewMessage,
} from "@/types/interview";

export default function InterviewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-app text-secondary">
          Loading...
        </div>
      }
    >
      <InterviewSessionContent />
    </Suspense>
  );
}

function InterviewSessionContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  const [session, setSession] = useState<ActiveInterviewSession | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60);
  const [loading, setLoading] = useState(Boolean(sessionId));
  // loadError replaces the whole page; actionError only shows above the composer
  const [loadError, setLoadError] = useState<string | null>(
    sessionId ? null : "Interview session id is missing.",
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const timeLimitFiredRef = useRef(false);
  const sessionStatusRef = useRef<"ACTIVE" | "COMPLETED" | "ABANDONED">(
    "ACTIVE",
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const activeSessionId = sessionId;
    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(
          `/api/interview/session?id=${encodeURIComponent(activeSessionId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);

          throw new Error(body?.error || "Unable to load interview session.");
        }

        const body = (await response.json()) as {
          session: ActiveInterviewSession;
        };

        if (cancelled) {
          return;
        }

        const loadedSession = {
          ...body.session,
          messages: body.session.messages.map((message) => ({
            ...message,
            timestamp: new Date(message.timestamp),
          })),
        };

        setSession(loadedSession);
        setMessages(loadedSession.messages);

        const remainingSeconds = Math.max(
          0,
          Math.ceil(
            (new Date(loadedSession.endsAt).getTime() - Date.now()) / 1000,
          ),
        );

        setTimeRemaining(remainingSeconds);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load interview session.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (session) {
      sessionStatusRef.current = session.status;
    }
  }, [session]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const abandonInterview = () => {
      if (sessionStatusRef.current !== "ACTIVE") {
        return;
      }

      const payload = JSON.stringify({
        sessionId,
        reason: "ABANDONED",
      });

      navigator.sendBeacon(
        "/api/interview/session/complete",
        new Blob([payload], {
          type: "application/json",
        }),
      );

      sessionStatusRef.current = "ABANDONED";
    };

    window.addEventListener("pagehide", abandonInterview);

    return () => {
      window.removeEventListener("pagehide", abandonInterview);
    };
  }, [sessionId]);

  const handleSend = async () => {
    const content = input.trim();

    if (!content || !sessionId || sending) {
      return;
    }

    setSending(true);
    setActionError(null);

    try {
      const response = await fetch("/api/interview/session/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          content,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || "Unable to submit interview response.");
      }

      const newMessages = (body?.messages || []).map(
        (message: InterviewMessage) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        }),
      );

      setMessages((current) => [...current, ...newMessages]);

      if (body?.completed === true) {
        sessionStatusRef.current = "COMPLETED";

        setSession((current) =>
          current
            ? {
                ...current,
                status: "COMPLETED",
                completionReason:
                  body?.completionReason === "TIME_LIMIT"
                    ? "TIME_LIMIT"
                    : current.completionReason,
              }
            : current,
        );

        setTimeRemaining(0);
      }

      setInput("");
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to submit interview response.",
      );
    } finally {
      setSending(false);
    }
  };

  const completeInterview = useCallback(
    async (reason: "USER_ENDED" | "TIME_LIMIT") => {
      if (!sessionId || !session || session.status !== "ACTIVE" || ending) {
        return;
      }

      setEnding(true);
      setActionError(null);

      try {
        const response = await fetch("/api/interview/session/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            reason,
          }),
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
          if (response.status === 409) {
            setSession((current) =>
              current
                ? {
                    ...current,
                    status: "COMPLETED",
                  }
                : current,
            );
            return;
          }

          throw new Error(body?.error || "Unable to end interview.");
        }

        const closingMessages = (body?.messages || []).map(
          (message: InterviewMessage) => ({
            ...message,
            timestamp: new Date(message.timestamp),
          }),
        );

        if (closingMessages.length > 0) {
          setMessages((current) => [...current, ...closingMessages]);
        }

        sessionStatusRef.current = "COMPLETED";

        setSession((current) =>
          current
            ? {
                ...current,
                status: "COMPLETED",
                completionReason: reason,
              }
            : current,
        );

        setTimeRemaining(0);
        setInput("");
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Unable to end interview.",
        );
      } finally {
        setEnding(false);
      }
    },
    [sessionId, session, ending],
  );

  useEffect(() => {
    if (!session || session.status !== "ACTIVE") {
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(session.endsAt).getTime() - Date.now()) / 1000),
      );

      setTimeRemaining(remaining);

      if (remaining === 0 && !timeLimitFiredRef.current) {
        timeLimitFiredRef.current = true;
        void completeInterview("TIME_LIMIT");
      }
    };

    updateTimer();

    const timer = window.setInterval(updateTimer, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [session, completeInterview]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-app text-secondary">
        Loading interview...
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-app px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-primary">
            Unable to load interview
          </h1>
          <p className="mt-2 text-sm text-secondary">
            {loadError || "The interview session could not be found."}
          </p>
        </div>
      </div>
    );
  }

  const minutesRemaining =
    session.status === "ACTIVE" ? Math.ceil(timeRemaining / 60) : undefined;

  return (
    <InterviewSession
      session={session}
      messages={messages}
      input={input}
      setInput={setInput}
      onSend={handleSend}
      onEnd={() => void completeInterview("USER_ENDED")}
      sending={sending}
      ending={ending}
      error={actionError}
      minutesRemaining={minutesRemaining}
    />
  );
}
