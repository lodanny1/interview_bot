"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Briefcase, Code, Mic, Paperclip, PhoneOff, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveInterviewSession, InterviewMessage } from "@/types/interview";
import { sessionSubtitle } from "@/lib/interview/interview-header";

// The interview session screen. The mode picked on the setup page decides which body shows
// (Text Chat -> chat, Voice Only -> voice, Video Mockup -> avatar); the header is shared.
// Candidate messages are still local-only; saving them needs a messages endpoint (separate story).

const INTERVIEWER_NAME = "Interview Bot";
const END_SESSION_PATH = "/interviews";
const TECHNICAL_FOCUS = ["technical", "system-design"];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Counts down from the backend's estimate. A reload re-reads the backend's value.
function useMinutesRemaining(initial?: number): number | undefined {
  const [minutes, setMinutes] = useState(initial);
  useEffect(() => {
    if (initial === undefined) return;
    const id = setInterval(() => {
      setMinutes((m) => (m === undefined ? m : Math.max(0, m - 1)));
    }, 60_000);
    return () => clearInterval(id);
  }, [initial]);
  return minutes;
}

export default function InterviewSession({ session }: { session: ActiveInterviewSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<InterviewMessage[]>(session.messages);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const minutesRemaining = useMinutesRemaining(session.estimatedMinutesRemaining);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "candidate", content: text, timestamp: new Date() },
    ]);
    setInput("");
  };

  const questionNumber = messages.filter((m) => m.role === "interviewer").length;

  return (
    <div className="flex h-screen flex-col bg-app text-primary">
      <SessionHeader session={session} onEnd={() => router.push(END_SESSION_PATH)} />

      <div className="min-h-0 flex-1">
        {session.mode === "text" && (
          <TextMode
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            messagesEndRef={messagesEndRef}
            questionNumber={questionNumber}
            totalQuestions={session.totalQuestions}
            minutesRemaining={minutesRemaining}
          />
        )}
        {session.mode === "voice" && <VoiceMode />}
        {session.mode === "avatar" && (
          <AvatarMode input={input} setInput={setInput} onSend={handleSend} />
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Header --------------------------------- */

function SessionHeader({
  session,
  onEnd,
}: {
  session: ActiveInterviewSession;
  onEnd: () => void;
}) {
  const Icon = TECHNICAL_FOCUS.includes(session.focusArea) ? Code : Briefcase;
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line-subtle bg-card px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tinted">
          <Icon className="h-5 w-5 text-secondary" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-primary">{session.title}</h1>
          <p className="truncate font-mono text-xs text-secondary">{sessionSubtitle(session)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEnd}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-error-text px-6 py-3 text-sm font-semibold text-inverse transition-opacity hover:opacity-90"
      >
        End Session
      </button>
    </header>
  );
}

/* ------------------------------- Text chat -------------------------------- */

function BotAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta">
      <Bot className="h-5 w-5 text-inverse" aria-hidden />
    </div>
  );
}

function MessageTime({ date }: { date: Date }) {
  // suppressHydrationWarning: the server and the browser can be in different time zones.
  return (
    <time
      dateTime={date.toISOString()}
      suppressHydrationWarning
      className="font-mono text-xs text-secondary"
    >
      {formatTime(date)}
    </time>
  );
}

function MessageRow({ msg }: { msg: InterviewMessage }) {
  if (msg.role === "interviewer") {
    return (
      <div className="flex max-w-[80%] items-start gap-3">
        <BotAvatar />
        <div className="min-w-0">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-primary">{INTERVIEWER_NAME}</span>
            <MessageTime date={msg.timestamp} />
          </div>
          <div className="whitespace-pre-wrap rounded-xl border border-line-subtle bg-card px-5 py-4 text-base leading-relaxed text-primary">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-auto flex max-w-[80%] flex-col items-end">
      <div className="mb-1.5 flex items-baseline gap-2">
        <MessageTime date={msg.timestamp} />
        <span className="text-sm font-semibold text-primary">You</span>
      </div>
      <div className="whitespace-pre-wrap rounded-2xl bg-cta px-5 py-4 text-base leading-relaxed text-inverse">
        {msg.content}
      </div>
    </div>
  );
}

function ChatComposer({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 focus-within:border-input-focus focus-within:ring-2 focus-within:ring-focus-ring/30">
      {/* Attachments aren't supported yet, so this is shown but disabled. */}
      <button
        type="button"
        disabled
        aria-label="Attach file (coming soon)"
        title="Attachments are coming soon"
        className="shrink-0 text-tertiary disabled:cursor-not-allowed"
      >
        <Paperclip className="h-5 w-5" />
      </button>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder="Type your response..."
        aria-label="Type your response"
        className="min-w-0 flex-1 bg-transparent text-base text-primary placeholder:text-placeholder focus:outline-none"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!input.trim()}
        aria-label="Send response"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cta text-inverse transition-colors hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

function SessionFooter({
  questionNumber,
  totalQuestions,
  minutesRemaining,
}: {
  questionNumber: number;
  totalQuestions?: number;
  minutesRemaining?: number;
}) {
  return (
    <div className="mt-2 flex items-center justify-between px-1 font-mono text-xs text-secondary">
      <span>
        {questionNumber > 0
          ? `Question ${questionNumber}${totalQuestions ? ` of ${totalQuestions}` : ""}`
          : ""}
      </span>
      <span>
        {minutesRemaining !== undefined
          ? `Est. ${minutesRemaining} ${minutesRemaining === 1 ? "min" : "mins"} remaining`
          : ""}
      </span>
    </div>
  );
}

function TextMode({
  messages,
  input,
  setInput,
  onSend,
  messagesEndRef,
  questionNumber,
  totalQuestions,
  minutesRemaining,
}: {
  messages: InterviewMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  questionNumber: number;
  totalQuestions?: number;
  minutesRemaining?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Messages, with a soft fade at the bottom edge */}
      <div className="relative min-h-0 flex-1">
        <div className="h-full space-y-8 overflow-y-auto p-6">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-app to-transparent"
          aria-hidden
        />
      </div>

      <div className="px-6 pb-3 pt-2">
        <ChatComposer input={input} setInput={setInput} onSend={onSend} />
        <SessionFooter
          questionNumber={questionNumber}
          totalQuestions={totalQuestions}
          minutesRemaining={minutesRemaining}
        />
      </div>
    </div>
  );
}

/* ------------------------------- Voice mode ------------------------------- */

function VoiceMode() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      {/* Waveform */}
      <div className="flex h-32 items-center justify-center gap-[2px]">
        {Array.from({ length: 40 }).map((_, i) => {
          const height = ((i * 37) % 80) + 20;
          return (
            <div
              key={i}
              className={cn(
                "w-1.5 rounded-full transition-all duration-300",
                isRecording ? "animate-pulse bg-cta" : "bg-line-strong"
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      {/* Mic Button */}
      <button
        type="button"
        onClick={() => setIsRecording(!isRecording)}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
          isRecording ? "bg-error-bg text-error" : "bg-tinted text-primary hover:bg-hover"
        )}
      >
        <Mic className="h-7 w-7" />
      </button>
      <p className="text-sm text-secondary">
        {isRecording ? "Recording... tap to stop" : "Tap to start recording"}
      </p>
    </div>
  );
}

/* ------------------------------- Avatar mode ------------------------------ */

function AvatarMode({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-[300px] w-[500px] items-center justify-center rounded-xl border border-line bg-tinted">
          <User className="h-20 w-20 text-tertiary" />
        </div>
      </div>

      <div className="px-6 pb-3 pt-2">
        <ChatComposer input={input} setInput={setInput} onSend={onSend} />
      </div>
    </div>
  );
}
