"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";

import { Bot, MessageSquare, Mic, User, PhoneOff, Send } from "lucide-react";

import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

import type {
  ActiveInterviewSession,
  InterviewMessage,
  InterviewMode,
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

  const [mode, setMode] = useState<InterviewMode>("text");

  const [messages, setMessages] = useState<InterviewMessage[]>([]);

  const [input, setInput] = useState("");

  const [sending, setSending] = useState(false);

  const [ending, setEnding] = useState(false);

  const [timeRemaining, setTimeRemaining] = useState(30 * 60);

  const [loading, setLoading] = useState(Boolean(sessionId));

  const [error, setError] = useState<string | null>(
    sessionId ? null : "Interview session id is missing.",
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        setError(null);

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
        setMode(loadedSession.mode);
        setMessages(loadedSession.messages);

        const remainingSeconds = Math.max(
          0,
          Math.ceil(
            (new Date(loadedSession.endsAt).getTime() - Date.now()) / 1000,
          ),
        );

        setTimeRemaining(remainingSeconds);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();

    if (!content || !sessionId || sending) {
      return;
    }

    setSending(true);
    setError(null);

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
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
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
      setError(null);

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
      } catch (completeError) {
        setError(
          completeError instanceof Error
            ? completeError.message
            : "Unable to end interview.",
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

      if (remaining === 0) {
        void completeInterview("TIME_LIMIT");
      }
    };

    updateTimer();

    const timer = window.setInterval(updateTimer, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [session, completeInterview]);

  const interviewEnded = session?.status !== "ACTIVE";

  const minutes = Math.floor(timeRemaining / 60);

  const seconds = timeRemaining % 60;

  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-app text-secondary">
        Loading interview...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-app px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-primary">
            Unable to load interview
          </h1>

          <p className="mt-2 text-sm text-tertiary">
            {error || "The interview session could not be found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-app">
      <div className="flex items-center justify-between gap-4 border-b border-line-subtle bg-card px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tinted text-secondary">
            <MessageSquare className="size-5" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-primary">
              {session.title}
            </h1>

            <p className="font-mono text-xs text-tertiary">AI Interviewer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "rounded-lg border px-3 py-2 font-mono text-sm font-medium tabular-nums",
              timeRemaining <= 300 && !interviewEnded
                ? "border-error bg-error-bg text-error-text"
                : "border-line bg-card text-secondary",
            )}
          >
            {interviewEnded ? "Interview complete" : formattedTime}
          </div>

          {!interviewEnded && (
            <button
              type="button"
              onClick={() => void completeInterview("USER_ENDED")}
              disabled={ending}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-red-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PhoneOff className="size-4" />
              {ending ? "Ending..." : "End Session"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === "text" && (
          <TextMode
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            sending={sending}
            disabled={interviewEnded || ending}
            ended={interviewEnded}
            timeRemaining={timeRemaining}
            messagesEndRef={messagesEndRef}
          />
        )}

        {mode === "voice" && <VoiceMode />}

        {mode === "avatar" && (
          <AvatarMode input={input} setInput={setInput} onSend={handleSend} />
        )}
      </div>
    </div>
  );
}

function formatMessageTime(value: Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TextMode({
  messages,
  input,
  setInput,
  onSend,
  sending,
  disabled,
  ended,
  timeRemaining,
  messagesEndRef,
}: {
  messages: InterviewMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void | Promise<void>;
  sending: boolean;
  disabled: boolean;
  ended: boolean;
  timeRemaining: number;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-8">
        {messages.map((message) => {
          const isCandidate = message.role === "candidate";

          return (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                isCandidate ? "justify-end" : "justify-start",
              )}
            >
              {!isCandidate && (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cta text-white">
                  <Bot className="size-5" />
                </div>
              )}

              <div
                className={cn(
                  "flex max-w-[75%] flex-col gap-1",
                  isCandidate ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "flex items-baseline gap-2",
                    isCandidate && "flex-row-reverse",
                  )}
                >
                  <span className="text-xs font-semibold text-primary">
                    {isCandidate ? "You" : "Interview Bot"}
                  </span>

                  <span className="font-mono text-[11px] text-tertiary">
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>

                <div
                  className={cn(
                    "whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed",
                    isCandidate
                      ? "rounded-2xl rounded-br-md bg-cta text-white"
                      : "rounded-2xl rounded-tl-md border border-line-subtle bg-card text-primary shadow-sm",
                  )}
                >
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 pb-3 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5 transition-colors focus-within:border-input-focus">
          <input
            type="text"
            value={input}
            disabled={sending || disabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSend();
              }
            }}
            placeholder={
              disabled ? "This interview has ended." : "Type your response..."
            }
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-placeholder focus:outline-none disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={onSend}
            disabled={sending || disabled}
            aria-label="Send message"
            className="flex size-9 items-center justify-center rounded-lg bg-cta text-white transition-colors hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between px-1 font-mono text-[11px] text-tertiary">
          <span>Press Enter to send</span>

          <span>
            {ended
              ? "Interview complete"
              : `Est. ${Math.max(
                  1,
                  Math.ceil(timeRemaining / 60),
                )} mins remaining`}
          </span>
        </div>
      </div>
    </div>
  );
}

function VoiceMode() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div className="flex h-32 items-center justify-center gap-[2px]">
        {Array.from({
          length: 40,
        }).map((_, index) => {
          const height = ((index * 37) % 80) + 20;

          return (
            <div
              key={index}
              className={cn(
                "w-1.5 rounded-full transition-all duration-300",
                isRecording ? "animate-pulse bg-gray-900" : "bg-gray-400",
              )}
              style={{
                height: `${height}%`,
              }}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setIsRecording((current) => !current)}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
          isRecording
            ? "bg-red-100 text-red-600"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200",
        )}
      >
        <Mic className="h-7 w-7" />
      </button>

      <p className="text-sm text-gray-500">
        {isRecording ? "Recording... tap to stop" : "Tap to start recording"}
      </p>
    </div>
  );
}

function AvatarMode({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-[300px] w-[500px] items-center justify-center rounded-xl border border-gray-200 bg-gray-100">
          <User className="h-20 w-20 text-gray-400" />
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSend();
              }
            }}
            placeholder="Write a message..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />

          <button
            type="button"
            onClick={onSend}
            className="rounded-lg p-2 transition-colors hover:bg-gray-200"
          >
            <Send className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
