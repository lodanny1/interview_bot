"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  FileUp,
  MessageSquareText,
  Mic,
  Paperclip,
  SlidersHorizontal,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InterviewMode } from "@/types/interview";
import { useRouter } from "next/navigation";

type PracticeGoal = "general" | "specific";

const MODES: {
  value: InterviewMode;
  icon: typeof MessageSquareText;
  label: string;
  description: string;
}[] = [
  {
    value: "text",
    icon: MessageSquareText,
    label: "Text Chat",
    description: "Typing-based interview. Good for drafting structured responses.",
  },
  {
    value: "voice",
    icon: Mic,
    label: "Voice Only",
    description: "Conversational audio. Simulates phone screening environments.",
  },
  {
    value: "avatar",
    icon: Video,
    label: "Video Mockup",
    description: "Full camera and voice simulation. Highest pressure setting.",
  },
];

const INDUSTRIES = [
  { value: "tech", label: "Technology" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "consulting", label: "Consulting" },
];

const ROLE_LEVELS = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

const EXPERIENCE_LEVELS = [
  { value: "0-1", label: "0–1 years" },
  { value: "1-3", label: "1–3 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "5-10", label: "5–10 years" },
  { value: "10+", label: "10+ years" },
];

const FOCUS_AREAS = [
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Technical" },
  { value: "system-design", label: "System Design" },
  { value: "leadership", label: "Leadership" },
  { value: "mixed", label: "Mixed" },
];

/* ---------------------------- Reusable pieces ---------------------------- */

const fieldBase =
  "w-full rounded-lg border border-input-default bg-card px-4 py-3 text-sm text-primary " +
  "transition-colors hover:border-input-hover focus:border-input-focus " +
  "focus:outline-none focus:ring-2 focus:ring-focus-ring/30";

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line-subtle bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2 border-b border-line-subtle pb-3">
        <Icon className="h-5 w-5 text-cta" aria-hidden />
        <h2 className="text-xl font-medium text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block font-mono text-xs uppercase tracking-wide text-secondary">
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldBase, "appearance-none pr-10", !value && "text-secondary")}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary"
          aria-hidden
        />
      </div>
    </div>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-cta" : "border-line-strong"
      )}
      aria-hidden
    >
      {selected && <span className="h-2.5 w-2.5 rounded-full bg-cta" />}
    </span>
  );
}

/* --------------------------------- Page ---------------------------------- */

export default function InterviewSetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [goal, setGoal] = useState<PracticeGoal>("specific");
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [roleLevel, setRoleLevel] = useState("");
  const [experience, setExperience] = useState("");
  const [focus, setFocus] = useState("");
  const [mode, setMode] = useState<InterviewMode>("voice");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [jobDescription, setJobDescription] = useState("");

  const handleStart = () => {
    router.push(
      `/interview/session?mode=${mode}&title=${encodeURIComponent(title || "Interview")}`
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  return (
    <div className="w-full text-primary">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-line-subtle bg-card px-6 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="rounded-md p-1 text-primary transition-colors hover:bg-hover"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={handleStart}
          className="inline-flex items-center gap-2 rounded-md bg-cta px-6 py-3 text-sm font-semibold text-inverse transition-colors hover:bg-cta-hover active:bg-cta-pressed"
        >
          Start Session
          <ArrowRight className="h-4 w-4" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 pb-10">
        {/* Practice Goals */}
        <section className="px-6">
          <h1 className="text-2xl font-medium text-primary">Practice Goals</h1>
          <p className="mt-1 text-sm text-secondary">
            Choose whether you want a general practice session or want to prepare for a
            scheduled interview.
          </p>

          <div role="radiogroup" aria-label="Practice goal" className="mt-4 grid grid-cols-2 gap-6">
            {(
              [
                {
                  value: "general",
                  title: "General Practice",
                  body: "Practice freely without attaching this session to a real interview.",
                  cta: "Start from scratch",
                },
                {
                  value: "specific",
                  title: "Prepare for a Specific Interview",
                  body: "Use a scheduled calendar interview to prefill context and track progress.",
                  cta: "Choose interview",
                },
              ] as const
            ).map((g) => {
              const selected = goal === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGoal(g.value)}
                  className={cn(
                    "rounded-xl border p-5 text-left transition-colors",
                    selected
                      ? "border-cta bg-info-bg"
                      : "border-line bg-card hover:border-line-strong"
                  )}
                >
                  <p className="text-sm font-semibold text-primary">{g.title}</p>
                  <p className="mt-2 text-xs text-secondary">{g.body}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-link">
                    {g.cta}
                    {g.value === "specific" && <ArrowRight className="h-3 w-3" />}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Interview Details */}
        <SectionCard icon={FileText} title="Interview Details">
          <div className="space-y-5">
            <div>
              <FieldLabel>Interview Name</FieldLabel>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Senior Frontend Engineer - TechCorp"
                className={cn(fieldBase, "placeholder:text-placeholder")}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <SelectField
                label="Industry"
                value={industry}
                onChange={setIndustry}
                placeholder="Select Industry"
                options={INDUSTRIES}
              />
              <SelectField
                label="Role Level"
                value={roleLevel}
                onChange={setRoleLevel}
                placeholder="Select Level"
                options={ROLE_LEVELS}
              />
              <SelectField
                label="Experience Level"
                value={experience}
                onChange={setExperience}
                placeholder="Select Experience"
                options={EXPERIENCE_LEVELS}
              />
              <SelectField
                label="Focus Areas"
                value={focus}
                onChange={setFocus}
                placeholder="Select Focus"
                options={FOCUS_AREAS}
              />
            </div>
          </div>
        </SectionCard>

        {/* Simulation Mode */}
        <SectionCard icon={SlidersHorizontal} title="Simulation Mode">
          <p className="mb-5 text-sm text-secondary">
            Choose how you want to interact with the AI interviewer.
          </p>
          <div role="radiogroup" aria-label="Simulation mode" className="grid grid-cols-3 gap-4">
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "rounded-lg border-2 p-4 text-left transition-colors",
                    selected
                      ? "border-cta bg-tinted"
                      : "border-line bg-card hover:border-line-strong"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <m.icon
                      className={cn("h-6 w-6", selected ? "text-cta" : "text-secondary")}
                      aria-hidden
                    />
                    <RadioDot selected={selected} />
                  </div>
                  <p className="mt-3 text-base font-medium text-primary">{m.label}</p>
                  <p className="mt-1 text-sm text-secondary">{m.description}</p>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Tailor Experience */}
        <SectionCard icon={Paperclip} title="Tailor Experience">
          <p className="mb-5 text-secondary">
            Upload your resume or job description to generate highly specific questions
            based on your profile.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-cta bg-tinted" : "border-line-strong bg-card"
            )}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-tinted">
              <FileUp className="h-7 w-7 text-cta" aria-hidden />
            </div>
            <p className="mt-4 text-lg text-primary">
              {file ? file.name : "Drag and drop file here"}
            </p>
            <p className="mt-1 text-sm text-secondary">Supports PDF, DOCX up to 5MB</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 rounded-md border border-cta bg-card px-5 py-2 text-sm font-medium text-link transition-colors hover:bg-hover"
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-line-subtle" />
            <span className="font-mono text-xs uppercase tracking-widest text-secondary">
              Or paste job description
            </span>
            <span className="h-px flex-1 bg-line-subtle" />
          </div>

          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            rows={4}
            className={cn(fieldBase, "resize-none placeholder:text-placeholder")}
          />
        </SectionCard>
      </main>
    </div>
  );
}