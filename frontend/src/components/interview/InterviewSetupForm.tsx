"use client";

import { useActionState, useEffect, useState } from "react";
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

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
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
          className={cn(fieldBase, fieldBorder(!!error), "appearance-none pr-10", !value && "text-secondary")}
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
        selected ? "border-cta" : "border-line-strong"
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

export default function InterviewSetupForm() {
  const router = useRouter();
  const [resumes, setResumes] = useState<
    { id: string; fileName: string }[]
  >([]);

  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumesLoading, setResumesLoading] = useState(true);

  const [targetJobs, setTargetJobs] = useState<
    {
      id: string;
      jobTitle: string;
      company: string | null;
      description: string;
    }[]
  >([]);
  const [selectedTargetJobId, setSelectedTargetJobId] = useState("");
  const [targetJobsLoading, setTargetJobsLoading] = useState(true);
  const [state, formAction, isPending] = useActionState(
    startInterviewAction,
    INITIAL_INTERVIEW_SETUP_STATE
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
  const [jobDescription, setJobDescription] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSavedResumes() {
      try {
        const response = await fetch("/api/resume", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const body = await response.json();

        if (!cancelled && Array.isArray(body?.resumes)) {
          setResumes(
            body.resumes
              .filter(
                (resume: unknown): resume is {
                  id: string;
                  fileName: string;
                } =>
                  Boolean(
                    resume &&
                      typeof resume === "object" &&
                      typeof (resume as { id?: unknown }).id === "string" &&
                      typeof (resume as { fileName?: unknown }).fileName === "string"
                  )
              )
              .map(
                (resume: {
                  id: string;
                  fileName: string;
                }) => ({
                  id: resume.id,
                  fileName: resume.fileName,
                })
              )
          );
        }
      } finally {
        if (!cancelled) {
          setResumesLoading(false);
        }
      }
    }

    loadSavedResumes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTargetJobs() {
      try {
        const response = await fetch("/api/target-jobs", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const body = await response.json();

        if (!cancelled && Array.isArray(body?.targetJobs)) {
          setTargetJobs(
            body.targetJobs.map(
              (job: {
                id: string;
                job_title: string;
                company: string | null;
                description: string;
              }) => ({
                id: job.id,
                jobTitle: job.job_title,
                company: job.company,
                description: job.description,
              })
            )
          );
        }
      } finally {
        if (!cancelled) {
          setTargetJobsLoading(false);
        }
      }
    }

    loadTargetJobs();

    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <form action={formAction} noValidate className="w-full text-primary">
      {/* Values held in buttons rather than inputs */}
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="mode" value={mode} />
      <input
        type="hidden"
        name="resumeId"
        value={selectedResumeId}
      />
      <input
        type="hidden"
        name="targetJobId"
        value={selectedTargetJobId}
      />
      <input
        type="hidden"
        name="jobDescription"
        value={jobDescription}
      />

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
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-cta px-6 py-3 text-sm font-semibold text-inverse transition-colors hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled"
        >
          {isPending ? "Starting..." : "Start Session"}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 pb-10">
        <FormBanner state={state} />

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
                className={cn(fieldBase, fieldBorder(!!errors.title), "placeholder:text-placeholder")}
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
          <FieldError id="mode-error" message={errors.mode} />
        </SectionCard>

        {/* Tailor Experience */}
        <SectionCard icon={Paperclip} title="Tailor Experience">
          <p className="mb-5 text-secondary">
            Upload your resume or job description to generate highly specific questions
            based on your profile.
          </p>

          <div>
            <FieldLabel htmlFor="resumeId">
              Saved Resume
            </FieldLabel>

            <div className="relative">
              <select
                id="resumeId"
                value={selectedResumeId}
                onChange={(e) =>
                  setSelectedResumeId(e.target.value)
                }
                disabled={resumesLoading}
                className={cn(
                  fieldBase,
                  fieldBorder(false),
                  "appearance-none pr-10"
                )}
              >
                <option value="">
                  {resumesLoading
                    ? "Loading resumes..."
                    : "No resume selected"}
                </option>

                {resumes.map((resume) => (
                  <option
                    key={resume.id}
                    value={resume.id}
                  >
                    {resume.fileName}
                  </option>
                ))}
              </select>

              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary"
                aria-hidden
              />
            </div>

            {!resumesLoading && resumes.length === 0 && (
              <p className="mt-2 text-sm text-secondary">
                No saved resumes yet. Upload one from your resume page first.
              </p>
            )}

            {!resumesLoading && resumes.length > 0 && (
              <p className="mt-2 text-sm text-secondary">
                Selecting a saved resume lets the interviewer generate questions grounded in your experience.
              </p>
            )}
          </div>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-line-subtle" />
            <span className="font-mono text-xs uppercase tracking-widest text-secondary">
              Target job
            </span>
            <span className="h-px flex-1 bg-line-subtle" />
          </div>

          <div>
            <FieldLabel htmlFor="targetJobId">
              Saved Target Job
            </FieldLabel>

            <div className="relative">
              <select
                id="targetJobId"
                value={selectedTargetJobId}
                disabled={targetJobsLoading}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedTargetJobId(id);

                  // The backend loads the current description by targetJobId.
                  // Avoid sending a stale copy that could override later edits.
                  setJobDescription("");

                  if (id) {
                    setGoal("specific");
                  }
                }}
                className={cn(
                  fieldBase,
                  fieldBorder(false),
                  "appearance-none pr-10"
                )}
              >
                <option value="">
                  {targetJobsLoading
                    ? "Loading target jobs..."
                    : "No target job selected"}
                </option>

                {targetJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.company
                      ? `${job.jobTitle} — ${job.company}`
                      : job.jobTitle}
                  </option>
                ))}
              </select>

              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary"
                aria-hidden
              />
            </div>

            {!targetJobsLoading && targetJobs.length === 0 && (
              <p className="mt-2 text-sm text-secondary">
                No saved target jobs yet. Add one from the Target Jobs page.
              </p>
            )}

            {!targetJobsLoading && targetJobs.length > 0 && (
              <p className="mt-2 text-sm text-secondary">
                The selected role, company, and job description will tailor the interview.
              </p>
            )}

            <FieldError
              id="jobDescription-error"
              message={errors.jobDescription}
            />
          </div>
        </SectionCard>
      </main>
    </form>
  );
}
