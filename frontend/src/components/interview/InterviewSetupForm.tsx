"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  MessageSquareText,
  Mic,
  Paperclip,
  SlidersHorizontal,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InterviewMode, PracticeGoal } from "@/types/interview";
import { startInterviewAction } from "@/app/(protected)/interview/setup/actions";
import {
  INITIAL_INTERVIEW_SETUP_STATE,
  type InterviewSetupFormState,
} from "@/lib/interview/interview-form-state";
import {
  EXPERIENCE_LEVELS,
  FOCUS_AREAS,
  INDUSTRIES,
  ROLE_LEVELS,
  type Option,
} from "@/lib/interview/interview-options";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { TargetJobForm } from "@/components/target-job/TargetJobForm";
import type { Resume } from "@/lib/resume/resume-state";
import type {
  TargetJob,
  TargetJobAction,
} from "@/lib/target-job/target-job-form-state";

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
    description:
      "Typing-based interview. Good for drafting structured responses.",
  },
  {
    value: "voice",
    icon: Mic,
    label: "Voice Only",
    description:
      "Conversational audio. Simulates phone screening environments.",
  },
  {
    value: "avatar",
    icon: Video,
    label: "Video Mockup",
    description: "Full camera and voice simulation. Highest pressure setting.",
  },
];

/* ---------------------------- Reusable pieces ---------------------------- */

const fieldBase =
  "w-full rounded-lg border bg-card px-4 py-3 text-sm text-primary " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-focus-ring/30";

function fieldBorder(hasError: boolean) {
  return hasError
    ? "border-input-error"
    : "border-input-default hover:border-input-hover focus:border-input-focus";
}

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

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block font-mono text-xs uppercase tracking-wide text-secondary"
    >
      {children}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-error-text">
      {message}
    </p>
  );
}

function SelectField({
  name,
  label,
  value,
  onChange,
  placeholder,
  options,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Option[];
  error?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            fieldBase,
            fieldBorder(!!error),
            "appearance-none pr-10",
            !value && "text-secondary",
          )}
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
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-cta" : "border-line-strong",
      )}
      aria-hidden
    >
      {selected && <span className="h-2.5 w-2.5 rounded-full bg-cta" />}
    </span>
  );
}

function FormBanner({ state }: { state: InterviewSetupFormState }) {
  if (!state.formError) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-input-error bg-error-bg px-4 py-3 text-sm text-error-text"
    >
      {state.formError}
      {state.signInAgain && (
        <>
          {" "}
          <Link href="/login" className="font-medium underline">
            Sign in again
          </Link>
        </>
      )}
    </div>
  );
}

/* --------------------------------- Form ---------------------------------- */

interface InterviewSetupFormProps {
  initialResumes: Resume[];
  resumeLoadError?: string;
  initialTargetJob: TargetJob | null;
  targetJobLoadError?: string;
  saveTargetJobAction: TargetJobAction;
  removeTargetJobAction: TargetJobAction;
}

export default function InterviewSetupForm({
  initialResumes,
  resumeLoadError,
  initialTargetJob,
  targetJobLoadError,
  saveTargetJobAction,
  removeTargetJobAction,
}: InterviewSetupFormProps) {
  const router = useRouter();
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [state, formAction, isPending] = useActionState(
    startInterviewAction,
    INITIAL_INTERVIEW_SETUP_STATE,
  );
  const errors = state.fieldErrors ?? {};

  // "general" is the default because the "Choose interview" calendar picker doesn't exist yet.
  const [goal, setGoal] = useState<PracticeGoal>("general");
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [roleLevel, setRoleLevel] = useState("");
  const [experience, setExperience] = useState("");
  const [focus, setFocus] = useState("");
  const [mode, setMode] = useState<InterviewMode>("voice");

  return (
    <div className="w-full text-primary">
      {/* Top bar. The submit button is tied to the form below via `form`. */}
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
          type="submit"
          form="interview-setup-form"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-cta px-6 py-3 text-sm font-semibold text-inverse transition-colors hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled"
        >
          {isPending ? "Starting..." : "Start Session"}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 pb-10">
        <form
          id="interview-setup-form"
          action={formAction}
          noValidate
          className="space-y-8"
        >
          {/* Values held in buttons rather than inputs */}
          <input type="hidden" name="goal" value={goal} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="resumeId" value={selectedResumeId} />

          <FormBanner state={state} />

          {/* Practice Goals */}
          <section className="px-6">
            <h1 className="text-2xl font-medium text-primary">
              Practice Goals
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Choose whether you want a general practice session or want to
              prepare for a scheduled interview.
            </p>

            <div
              role="radiogroup"
              aria-label="Practice goal"
              className="mt-4 grid grid-cols-2 gap-6"
            >
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
                        : "border-line bg-card hover:border-line-strong",
                    )}
                  >
                    <p className="text-sm font-semibold text-primary">
                      {g.title}
                    </p>
                    <p className="mt-2 text-xs text-secondary">{g.body}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-link">
                      {g.cta}
                      {g.value === "specific" && (
                        <ArrowRight className="h-3 w-3" />
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
            <FieldError id="goal-error" message={errors.goal} />
          </section>

          {/* Interview Details */}
          <SectionCard icon={FileText} title="Interview Details">
            <div className="space-y-5">
              <div>
                <FieldLabel htmlFor="title">Interview Name*</FieldLabel>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Frontend Engineer - TechCorp"
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  className={cn(
                    fieldBase,
                    fieldBorder(!!errors.title),
                    "placeholder:text-placeholder",
                  )}
                />
                <FieldError id="title-error" message={errors.title} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <SelectField
                  name="industry"
                  label="Industry"
                  value={industry}
                  onChange={setIndustry}
                  placeholder="Select Industry"
                  options={INDUSTRIES}
                  error={errors.industry}
                />
                <SelectField
                  name="roleLevel"
                  label="Role Level"
                  value={roleLevel}
                  onChange={setRoleLevel}
                  placeholder="Select Level"
                  options={ROLE_LEVELS}
                  error={errors.roleLevel}
                />
                <SelectField
                  name="experienceLevel"
                  label="Experience Level"
                  value={experience}
                  onChange={setExperience}
                  placeholder="Select Experience"
                  options={EXPERIENCE_LEVELS}
                  error={errors.experienceLevel}
                />
                <SelectField
                  name="focusArea"
                  label="Focus Areas*"
                  value={focus}
                  onChange={setFocus}
                  placeholder="Select Focus"
                  options={FOCUS_AREAS}
                  error={errors.focusArea}
                />
              </div>
            </div>
          </SectionCard>

          {/* Simulation Mode */}
          <SectionCard icon={SlidersHorizontal} title="Simulation Mode">
            <p className="mb-5 text-sm text-secondary">
              Choose how you want to interact with the AI interviewer.
            </p>
            <div
              role="radiogroup"
              aria-label="Simulation mode"
              className="grid grid-cols-3 gap-4"
            >
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
                        : "border-line bg-card hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <m.icon
                        className={cn(
                          "h-6 w-6",
                          selected ? "text-cta" : "text-secondary",
                        )}
                        aria-hidden
                      />
                      <RadioDot selected={selected} />
                    </div>
                    <p className="mt-3 text-base font-medium text-primary">
                      {m.label}
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <FieldError id="mode-error" message={errors.mode} />
          </SectionCard>
        </form>

        {/* Tailor Experience: outside the setup form, because ResumeUpload and
            TargetJobForm manage their own submissions (nested forms are invalid HTML). */}
        <SectionCard icon={Paperclip} title="Tailor Experience">
          <p className="mb-6 text-secondary">
            Add a resume and the job you&apos;re targeting to generate highly
            specific questions based on your profile.
          </p>

          <div className="space-y-8">
            <ResumeUpload
              initialResumes={initialResumes}
              loadError={resumeLoadError}
              selectedId={selectedResumeId}
              onSelect={setSelectedResumeId}
            />
            <TargetJobForm
              saveAction={saveTargetJobAction}
              removeAction={removeTargetJobAction}
              initialTargetJob={initialTargetJob}
              loadError={targetJobLoadError}
            />
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
