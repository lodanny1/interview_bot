"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Briefcase,
  Code,
  Mic,
  Paperclip,
  PhoneOff,
  Send,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionSubtitle } from "@/lib/interview/interview-header";
import type {
  ActiveInterviewSession,
  InterviewMessage,
} from "@/types/interview";

// Presentational interview screen. The page owns fetching, the timer and
// completion; everything arrives here as props. The session's mode decides
// which body shows (text -> chat, voice -> voice, avatar -> avatar).

const INTERVIEWER_NAME = "Interview Bot";
const TECHNICAL_FOCUS = ["technical", "system-design"];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export type InterviewSessionProps = {
  session: ActiveInterviewSession;
  messages: InterviewMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void | Promise<void>;
  onEnd: () => void;
  sending: boolean;
  ending: boolean;
  error: string | null;
  minutesRemaining?: number;
};

export default function InterviewSession({
  session,
  messages,
  input,
  setInput,
  onSend,
  onEnd,
  sending,
  ending,
  error,
  minutesRemaining,
}: InterviewSessionProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ended = session.status !== "ACTIVE";
  const composerDisabled = ended || ending;
  const questionNumber = messages.filter(
    (m) => m.role === "interviewer",
  ).length;

  return (
    <div className="flex h-screen flex-col bg-app text-primary">
      <SessionHeader
        session={session}
        ended={ended}
        ending={ending}
        onEnd={onEnd}
      />

      <div className="min-h-0 flex-1">
        {session.mode === "text" && (
          <TextMode
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={onSend}
            sending={sending}
            disabled={composerDisabled}
            error={error}
            messagesEndRef={messagesEndRef}
            questionNumber={questionNumber}
            totalQuestions={session.totalQuestions}
            minutesRemaining={minutesRemaining}
          />
        )}

        {session.mode === "voice" && <VoiceMode />}

        {session.mode === "avatar" && (
          <AvatarMode
            input={input}
            setInput={setInput}
            onSend={onSend}
            sending={sending}
            disabled={composerDisabled}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Header --------------------------------- */

function SessionHeader({
  session,
  ended,
  ending,
  onEnd,
}: {
  session: ActiveInterviewSession;
  ended: boolean;
  ending: boolean;
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
          <h1 className="truncate text-sm font-semibold text-primary">
            {session.title}
          </h1>
          <p className="truncate font-mono text-xs text-secondary">
            {sessionSubtitle(session)}
          </p>
        </div>
      </div>

      {ended ? (
        <span className="shrink-0 rounded-full bg-tinted px-4 py-2 text-sm font-semibold text-secondary">
          Interview complete
        </span>
      ) : (
        <button
          type="button"
          onClick={onEnd}
          disabled={ending}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-error-text px-6 py-3 text-sm font-semibold text-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PhoneOff className="h-4 w-4" aria-hidden />
          {ending ? "Ending..." : "End Session"}
        </button>
      )}
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
            <span className="text-sm font-semibold text-primary">
              {INTERVIEWER_NAME}
            </span>
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
  sending,
  disabled,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void | Promise<void>;
  sending: boolean;
  disabled: boolean;
}) {
  const blocked = sending || disabled;

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
        disabled={blocked}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void onSend();
          }
        }}
        placeholder={
          disabled ? "This interview has ended." : "Type your response..."
        }
        aria-label="Type your response"
        className="min-w-0 flex-1 bg-transparent text-base text-primary placeholder:text-placeholder focus:outline-none disabled:cursor-not-allowed"
      />

      <button
        type="button"
        onClick={() => void onSend()}
        disabled={blocked || !input.trim()}
        aria-label="Send response"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cta text-inverse transition-colors hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p role="alert" className="mb-2 px-1 text-sm text-error">
      {message}
    </p>
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
  sending,
  disabled,
  error,
  messagesEndRef,
  questionNumber,
  totalQuestions,
  minutesRemaining,
}: {
  messages: InterviewMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void | Promise<void>;
  sending: boolean;
  disabled: boolean;
  error: string | null;
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
        <ErrorNote message={error} />
        <ChatComposer
          input={input}
          setInput={setInput}
          onSend={onSend}
          sending={sending}
          disabled={disabled}
        />
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
                isRecording ? "animate-pulse bg-cta" : "bg-line-strong",
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      {/* Mic Button */}
      <button
        type="button"
        onClick={() => setIsRecording((current) => !current)}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
          isRecording
            ? "bg-error-bg text-error"
            : "bg-tinted text-primary hover:bg-hover",
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
  sending,
  disabled,
  error,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void | Promise<void>;
  sending: boolean;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-[300px] w-[500px] items-center justify-center rounded-xl border border-line bg-tinted">
          <User className="h-20 w-20 text-tertiary" />
        </div>
      </div>

      <div className="px-6 pb-3 pt-2">
        <ErrorNote message={error} />
        <ChatComposer
          input={input}
          setInput={setInput}
          onSend={onSend}
          sending={sending}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
