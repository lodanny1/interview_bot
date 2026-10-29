"use client";

// Add Target Job Description (Issue #09). Shows the saved target job, or a form
// to add one. The logic follows SetupForm: validate in the browser, then the
// server action validates again and saves.

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Briefcase, Building2, CheckCircle2, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TARGET_JOB_LIMITS,
  countWords,
  validateTargetJob,
  type TargetJobFieldErrors,
} from "@/lib/target-job/target-job-validation";
import type {
  TargetJob,
  TargetJobAction,
  TargetJobFormState,
} from "@/lib/target-job/target-job-form-state";

interface TargetJobFormProps {
  saveAction: TargetJobAction;
  removeAction: TargetJobAction;
  initialTargetJob: TargetJob | null;
  // Shown when the saved job couldn't be loaded; the form still works.
  loadError?: string;
}

const inputClass =
  "w-full rounded-lg border bg-card px-3 text-sm text-primary placeholder:text-placeholder " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cta px-5 text-sm font-semibold text-white transition-colors " +
  "hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const softButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-tinted px-5 text-sm font-semibold text-secondary transition-colors " +
  "hover:bg-pressed disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function TargetJobForm({
  saveAction,
  removeAction,
  initialTargetJob,
  loadError,
}: TargetJobFormProps) {
  const [editing, setEditing] = useState(initialTargetJob === null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [jobTitle, setJobTitle] = useState(initialTargetJob?.jobTitle ?? "");
  const [company, setCompany] = useState(initialTargetJob?.company ?? "");
  const [description, setDescription] = useState(initialTargetJob?.description ?? "");
  const [clientErrors, setClientErrors] = useState<TargetJobFieldErrors>({});

  // One action state for both buttons, so the latest result is always shown.
  const [state, dispatch, pending] = useActionState(
    async (prevState: TargetJobFormState, formData: FormData) => {
      const action = formData.get("intent") === "remove" ? removeAction : saveAction;
      const nextState = (await action(prevState, formData)) ?? prevState;

      if (nextState.targetJob !== undefined) {
        // Saved or removed: show the saved card, or an empty form.
        setEditing(nextState.targetJob === null);
        setConfirmingRemove(false);
        if (nextState.targetJob === null) {
          setJobTitle("");
          setCompany("");
          setDescription("");
        }
      }
      return nextState;
    },
    {}
  );

  const savedJob = state.targetJob !== undefined ? state.targetJob : initialTargetJob;

  function submit(values: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) formData.set(key, value);
    startTransition(() => dispatch(formData));
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateTargetJob({ jobTitle, company, description });
    if (!validation.ok) {
      setClientErrors(validation.fieldErrors);
      return;
    }

    setClientErrors({});
    submit({ intent: "save", ...validation.data });
  }

  function handleRemove() {
    if (pending) return;
    submit({ intent: "remove" });
  }

  function startEditing() {
    if (savedJob) {
      setJobTitle(savedJob.jobTitle);
      setCompany(savedJob.company ?? "");
      setDescription(savedJob.description);
    }
    setClientErrors({});
    setConfirmingRemove(false);
    setEditing(true);
  }

  function cancelEditing() {
    setClientErrors({});
    setEditing(false);
  }

  // Show one error source at a time: current client errors, otherwise the last
  // server result. Hide stale server messages while a new attempt is pending.
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const fieldErrors = hasClientErrors ? clientErrors : pending ? {} : (state.fieldErrors ?? {});
  const formError = pending || hasClientErrors ? undefined : state.formError;
  const notice = pending || formError ? undefined : state.notice;
  const showLoadError = loadError && state.targetJob === undefined && !formError;

  const words = countWords(description);
  const chars = description.length;

  return (
    <div className="flex flex-col gap-6">
      {showLoadError && (
        <Banner tone="warning" role="status">
          <p>{loadError}</p>
        </Banner>
      )}

      {formError && (
        <Banner tone="error" role="alert">
          <p>{formError}</p>
          {state.signInAgain && (
            <Link href="/login" className="mt-1 inline-block font-semibold underline">
              Go to Sign In
            </Link>
          )}
        </Banner>
      )}

      {notice && (
        <Banner tone="success" role="status">
          <p>{notice}</p>
        </Banner>
      )}

      {savedJob && !editing && (
        <section
          aria-labelledby="saved-job-title"
          className="rounded-2xl border border-line-subtle bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-wider text-tertiary">
                Preparing for
              </p>
              <h2 id="saved-job-title" className="mt-1 text-2xl font-medium text-primary">
                {savedJob.jobTitle}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tertiary">
                {savedJob.company && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    {savedJob.company}
                  </span>
                )}
                <span>
                  Updated{" "}
                  <time dateTime={savedJob.updatedAt} suppressHydrationWarning>
                    {formatDate(savedJob.updatedAt)}
                  </time>
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={startEditing} disabled={pending} className={softButton}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
              {!confirmingRemove && (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={pending}
                  className={softButton}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
          </div>

          {confirmingRemove && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-error-bg px-4 py-3 text-sm text-error-text">
              <span>Remove this job description? You can add a new one afterward.</span>
              <button
                type="button"
                onClick={handleRemove}
                disabled={pending}
                className="font-semibold underline disabled:opacity-50"
              >
                {pending ? "Removing…" : "Yes, remove it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                disabled={pending}
                className="font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}

          <details className="mt-5 border-t border-line-subtle pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-link hover:text-link-hover">
              Show job description
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-primary">
              {savedJob.description}
            </p>
          </details>
        </section>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          noValidate
          aria-label="Target job form"
          className="flex flex-col gap-6 rounded-2xl border border-line-subtle bg-card p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field id="jobTitle" label="Job title" error={fieldErrors.jobTitle}>
              {(describedBy) => (
                <input
                  id="jobTitle"
                  name="jobTitle"
                  type="text"
                  placeholder="e.g. Junior Software Engineer"
                  maxLength={TARGET_JOB_LIMITS.jobTitle}
                  required
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  aria-invalid={fieldErrors.jobTitle ? true : undefined}
                  aria-describedby={describedBy}
                  className={cn(
                    inputClass,
                    "h-11",
                    fieldErrors.jobTitle ? "border-input-error" : "border-input-default"
                  )}
                />
              )}
            </Field>

            <Field id="company" label="Company" optional error={fieldErrors.company}>
              {(describedBy) => (
                <input
                  id="company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  placeholder="e.g. Acme Corp"
                  maxLength={TARGET_JOB_LIMITS.company}
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  aria-invalid={fieldErrors.company ? true : undefined}
                  aria-describedby={describedBy}
                  className={cn(
                    inputClass,
                    "h-11",
                    fieldErrors.company ? "border-input-error" : "border-input-default"
                  )}
                />
              )}
            </Field>
          </div>

          <Field
            id="description"
            label="Job description"
            hint={`${words} ${words === 1 ? "word" : "words"} ·${chars.toLocaleString("en-US")}/${TARGET_JOB_LIMITS.descriptionMaxChars.toLocaleString("en-US")}`}
            help="Paste the full posting text, including responsibilities and qualifications."
            error={fieldErrors.description}
          >
            {(describedBy) => (
              <textarea
                id="description"
                name="description"
                rows={12}
                placeholder="Paste the job description here…"
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                aria-invalid={fieldErrors.description ? true : undefined}
                aria-describedby={describedBy}
                className={cn(
                  inputClass,
                  "resize-y py-2.5 leading-6",
                  fieldErrors.description ? "border-input-error" : "border-input-default"
                )}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className={primaryButton}>
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              {pending ? "Saving…" : "Save job description"}
            </button>
            {savedJob && (
              <button type="button" onClick={cancelEditing} disabled={pending} className={softButton}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Banner({
  tone,
  role,
  children,
}: {
  tone: "error" | "warning" | "success";
  role: "alert" | "status";
  children: ReactNode;
}) {
  const styles = {
    error: "border-input-error bg-error-bg text-error-text",
    warning: "border-warning bg-warning-bg text-warning-text",
    success: "border-input-success bg-success-bg text-success-text",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert;

  return (
    <div role={role} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", styles)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  optional,
  hint,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  help?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-primary">
          {label}
          {optional && <span className="font-normal text-tertiary"> (optional)</span>}
        </label>
        {hint && <span className="font-mono text-[11px] text-tertiary">{hint}</span>}
      </div>
      {help && (
        <p id={helpId} className="text-sm text-tertiary">
          {help}
        </p>
      )}
      {children(describedBy || undefined)}
      {error && (
        <p id={errorId} className="text-sm text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
