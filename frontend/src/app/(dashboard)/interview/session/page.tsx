"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { MessageSquare, Mic, User, MoreVertical, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { InterviewMode, InterviewMessage } from "@/types/interview";

const mockMessages: InterviewMessage[] = [
  { id: "1", role: "interviewer", content: "Hi, welcome to this interview. Let's start with a warm-up question. Can you tell me a little about yourself and your background?", timestamp: new Date() },
  { id: "2", role: "candidate", content: "Thank you for having me. I'm a software engineer with 5 years of experience building distributed systems at scale.", timestamp: new Date() },
  { id: "3", role: "interviewer", content: "Great. Tell me about a time you had to deal with a challenging technical problem under pressure. What was the situation and how did you approach it?", timestamp: new Date() },
  { id: "4", role: "candidate", content: "At my previous company, we had a production outage affecting 50,000 users. I led the incident response and identified the root cause within 20 minutes.", timestamp: new Date() },
  { id: "5", role: "interviewer", content: "Interesting. What specific steps did you take to identify the root cause so quickly? Walk me through your debugging process.", timestamp: new Date() },
];

export default function InterviewSessionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <InterviewSessionContent />
    </Suspense>
  );
}

function InterviewSessionContent() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as InterviewMode) || "text";
  const title = searchParams.get("title") || "Interview Title";

  const [mode, setMode] = useState<InterviewMode>(initialMode);
  const [messages, setMessages] = useState<InterviewMessage[]>(mockMessages);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([
      ...messages,
      { id: Date.now().toString(), role: "candidate", content: input, timestamp: new Date() },
    ]);
    setInput("");
  };

  const modes: { value: InterviewMode; icon: typeof MessageSquare }[] = [
    { value: "text", icon: MessageSquare },
    { value: "voice", icon: Mic },
    { value: "avatar", icon: User },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "flex items-center justify-center w-12 h-9 transition-colors",
                  mode === m.value ? "bg-gray-700 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                <m.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <button className="p-2 hover:bg-gray-100 rounded">
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {mode === "text" && (
          <TextMode
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            messagesEndRef={messagesEndRef}
          />
        )}
        {mode === "voice" && <VoiceMode />}
        {mode === "avatar" && <AvatarMode input={input} setInput={setInput} onSend={handleSend} />}
      </div>
    </div>
  );
}

function TextMode({
  messages,
  input,
  setInput,
  onSend,
  messagesEndRef,
}: {
  messages: InterviewMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex items-start gap-3 max-w-[80%]",
              msg.role === "candidate" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
            <div
              className={cn(
                "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                msg.role === "interviewer"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-gray-700 text-white"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-xl">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Write a message..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={onSend} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <Send className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VoiceMode() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* Waveform */}
      <div className="flex items-center justify-center gap-[2px] h-32">
        {Array.from({ length: 40 }).map((_, i) => {
          const height = Math.random() * 80 + 20;
          return (
            <div
              key={i}
              className={cn(
                "w-1.5 rounded-full transition-all duration-300",
                isRecording ? "bg-gray-900 animate-pulse" : "bg-gray-400"
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      {/* Mic Button */}
      <button
        onClick={() => setIsRecording(!isRecording)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
          isRecording ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        )}
      >
        <Mic className="w-7 h-7" />
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
  setInput: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Avatar View */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-[500px] h-[300px] bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
          <User className="w-20 h-20 text-gray-400" />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-xl">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Write a message..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={onSend} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <Send className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
