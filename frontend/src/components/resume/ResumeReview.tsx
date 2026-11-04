"use client";

// Review Resume Information (Issue #08).
// Shows a resume's extracted information so the user can correct and confirm
// it, extracting it first if needed. The form validates in the browser; the
// API route and the backend validate again before saving.

import { useState, type FormEvent, type ReactNode } from "react";

import Link from "next/link";

import {
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { RESUME_PATH } from "@/lib/resume/resume-state";

import {
  RESUME_EXTRACT_API_URL,
  RESUME_REVIEW_API_URL,
  RESUME_REVIEW_MESSAGES as MSG,
  RESUME_REVIEW_NOTICES,
  fromFormValues,
  toFormValues,
  toResumeReview,
  type ResumeFormValues,
  type ResumeReview as Review,
} from "@/lib/resume/resume-review-state";

import {
  RESUME_LIST_RULES,
  RESUME_SECTIONS,
  RESUME_TEXT_RULES,
  validateResumeReview,
  type ResumeReviewFieldErrors,
  type ResumeSectionName,
} from "@/lib/resume/resume-review-validation";

interface ResumeReviewProps {
  initialReview: Review;
}

type Busy = "extracting" | "saving" | null;

interface Problem {
  message: string;
  signInAgain?: boolean;
}

const SECTION_NAMES = Object.keys(RESUME_SECTIONS) as ResumeSectionName[];

const SECTION_TITLES: Record<ResumeSectionName, { title: string; entry: string }> = {
  education: { title: "Education", entry: "Education" },
  experience: { title: "Experience", entry: "Experience" },
  projects: { title: "Projects", entry: "Project" },
};

const inputClass =
  "w-full rounded-lg border bg-card px-3 text-sm text-primary placeholder:text-placeholder " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cta px-5 text-sm font-semibold text-white transition-colors " +
  "hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const softButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-tinted px-4 text-sm font-semibold text-secondary transition-colors " +
  "hover:bg-pressed disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

// Returns the JSON object from an app API route, or null on a network failure
// or an unexpected response.
async function requestJson(
  url: string,
  init: RequestInit
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, init);
    const body: unknown = await response.json();

    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function ResumeReview({ initialReview }: ResumeReviewProps) {
  const [review, setReview] = useState(initialReview);
  const [values, setValues] = useState<ResumeFormValues | null>(() =>
    initialReview.data ? toFormValues(initialReview.data) : null
  );
  const [fieldErrors, setFieldErrors] = useState<ResumeReviewFieldErrors>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = `?id=${encodeURIComponent(review.resumeId)}`;

  function show(next: Review) {
    setReview(next);
    setValues(next.data ? toFormValues(next.data) : null);
    setFieldErrors({});
  }

  async function extract() {
    if (busy) return;

    setBusy("extracting");
    setProblem(null);
    setNotice(null);

    const body = await requestJson(`${RESUME_EXTRACT_API_URL}${query}`, {
      method: "POST",
    });

    setBusy(null);

    const resume = body?.resume as
      | { parseStatus?: unknown; parsedJson?: unknown }
      | null
      | undefined;

    if (resume) {
      // Unusable output becomes "failed" here as well as on the server.
      show(
        toResumeReview({
          resumeId: review.resumeId,
          fileName: review.fileName,
          parseStatus: resume.parseStatus,
          parsedJson: resume.parsedJson,
        })
      );
      return;
    }

    if (body?.code === "unauthenticated") {
      setProblem({ message: MSG.unauthenticated, signInAgain: true });
      return;
    }

    if (body?.code === "not_found") {
      setProblem({ message: MSG.notFound });
      return;
    }

    // Extraction failed, or the service couldn't be reached.
    show({ ...review, status: "failed", data: null, reviewedAt: null });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !values) return;

    setNotice(null);

    const validation = validateResumeReview(fromFormValues(values));

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      setProblem({ message: MSG.invalid });
      return;
    }

    setFieldErrors({});
    setProblem(null);
    setBusy("saving");

    const body = await requestJson(`${RESUME_REVIEW_API_URL}${query}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validation.data),
    });

    setBusy(null);

    const saved = body?.review as Review | undefined;

    if (saved?.data) {
      show(saved);
      setNotice(RESUME_REVIEW_NOTICES.confirmed);
      return;
    }

    // Edits stay in the form so the user can try again.
    switch (body?.code) {
      case "unauthenticated":
        setProblem({ message: MSG.unauthenticated, signInAgain: true });
        break;
      case "invalid":
        setFieldErrors((body?.fieldErrors as ResumeReviewFieldErrors) ?? {});
        setProblem({ message: MSG.invalid });
        break;
      case "not_found":
        setProblem({ message: MSG.notFound });
        break;
      case "not_extracted":
        setProblem({ message: MSG.notExtracted });
        break;
      default:
        setProblem({ message: MSG.saveUnavailable });
    }
  }

  function setField(field: keyof ResumeFormValues, value: string) {
    setNotice(null);
    setValues((current) => current && { ...current, [field]: value });
  }

  function setEntryField(
    section: ResumeSectionName,
    index: number,
    field: string,
    value: string
  ) {
    setNotice(null);
    setValues(
      (current) =>
        current && {
          ...current,
          [section]: current[section].map((entry, i) =>
            i === index ? { ...entry, [field]: value } : entry
          ),
        }
    );
  }

  function removeEntry(section: ResumeSectionName, index: number) {
    setNotice(null);
    setValues(
      (current) =>
        current && {
          ...current,
          [section]: current[section].filter((_, i) => i !== index),
        }
    );

    // Entry errors are keyed by position, which just changed.
    setFieldErrors({});
  }

  const extracting = busy === "extracting";
  const reviewed = review.status === "reviewed";
  const editable = values && (review.status === "ready" || reviewed);

  const extractLabel = (idle: string) => (extracting ? "Extracting…" : idle);

  return (
    <div className="flex flex-col gap-6">
      {problem && (
        <Banner tone="error" role="alert">
          <p>{problem.message}</p>

          {problem.signInAgain && (
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

      {review.status === "not_extracted" && (
        <Card
          title="Extract this resume's information"
          description="Interview Bot hasn't read this resume yet. Extract its information, then check that it's correct."
        >
          <div>
            <button type="button" onClick={extract} disabled={busy !== null} className={primaryButton}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {extractLabel("Extract information")}
            </button>
          </div>
        </Card>
      )}

      {review.status === "processing" && (
        <Card
          title="Still extracting"
          description="This resume's information is still being extracted. If it doesn't finish after you refresh the page, extract it again."
        >
          <div>
            <button type="button" onClick={extract} disabled={busy !== null} className={softButton}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {extractLabel("Extract again")}
            </button>
          </div>
        </Card>
      )}

      {review.status === "failed" && (
        <Card tone="error" title="We couldn't read this resume" description={MSG.extractFailed}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={extract} disabled={busy !== null} className={primaryButton}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {extractLabel("Try again")}
            </button>

            <Link href={RESUME_PATH} className={softButton}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload a different file
            </Link>
          </div>
        </Card>
      )}

      {extracting && (
        <p role="status" className="text-sm text-tertiary">
          Reading your resume. This can take up to a minute.
        </p>
      )}

      {editable && (
        <form
          onSubmit={save}
          noValidate
          aria-label="Resume information"
          className="flex flex-col gap-6"
        >
          {reviewed && review.reviewedAt ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success-text">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>
                Reviewed on{" "}
                <time dateTime={review.reviewedAt} suppressHydrationWarning>
                  {formatDate(review.reviewedAt)}
                </time>
                . You can still make changes.
              </span>
            </p>
          ) : (
            <p className="text-sm text-tertiary">
              Not confirmed yet. Check each section, correct anything that&apos;s
              wrong, then confirm.
            </p>
          )}

          {fieldErrors.content && (
            <p className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error-text">
              {fieldErrors.content}
            </p>
          )}

          <Card title="Contact and summary">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["name", "email", "phone", "location"] as const).map((field) => (
                <TextInput
                  key={field}
                  id={`review-${field}`}
                  label={RESUME_TEXT_RULES[field].label}
                  required={RESUME_TEXT_RULES[field].required}
                  maxLength={RESUME_TEXT_RULES[field].max}
                  type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                  value={values[field]}
                  error={fieldErrors[field]}
                  onChange={(value) => setField(field, value)}
                />
              ))}
            </div>

            <LinesInput
              id="review-summary"
              label={RESUME_TEXT_RULES.summary.label}
              maxLength={RESUME_TEXT_RULES.summary.max}
              value={values.summary}
              error={fieldErrors.summary}
              onChange={(value) => setField("summary", value)}
            />
          </Card>

          <Card title="Skills and certifications">
            {(["skills", "certifications"] as const).map((field) => (
              <LinesInput
                key={field}
                id={`review-${field}`}
                label={RESUME_LIST_RULES[field].label}
                help="One per line."
                value={values[field]}
                error={fieldErrors[field]}
                onChange={(value) => setField(field, value)}
              />
            ))}
          </Card>

          {SECTION_NAMES.map((section) => {
            const rules = RESUME_SECTIONS[section];
            const { title, entry: entryTitle } = SECTION_TITLES[section];

            return (
              <Card key={section} title={title}>
                {fieldErrors[section] && (
                  <p className="text-sm text-error-text">{fieldErrors[section]}</p>
                )}

                {values[section].length === 0 && (
                  <p className="text-sm text-tertiary">
                    No {rules.noun} found in this resume.
                  </p>
                )}

                {values[section].map((entry, index) => {
                  const name = `${entryTitle} ${index + 1}`;
                  const errorKey = (field: string) => `${section}.${index}.${field}`;

                  return (
                    <fieldset
                      key={entry.key}
                      className="flex flex-col gap-4 rounded-xl border border-line-subtle p-4"
                    >
                      <legend className="px-1 text-sm font-semibold text-primary">
                        {name}
                      </legend>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {Object.entries(rules.text).map(([field, rule]) => (
                          <TextInput
                            key={field}
                            id={`review-${section}-${index}-${field}`}
                            label={rule.label}
                            required={rule.required}
                            maxLength={rule.max}
                            value={entry[field] ?? ""}
                            error={fieldErrors[errorKey(field)]}
                            onChange={(value) => setEntryField(section, index, field, value)}
                          />
                        ))}
                      </div>

                      {Object.entries(rules.lists).map(([field, rule]) => (
                        <LinesInput
                          key={field}
                          id={`review-${section}-${index}-${field}`}
                          label={rule.label}
                          help="One per line."
                          value={entry[field] ?? ""}
                          error={fieldErrors[errorKey(field)]}
                          onChange={(value) => setEntryField(section, index, field, value)}
                        />
                      ))}

                      <div>
                        <button
                          type="button"
                          onClick={() => removeEntry(section, index)}
                          disabled={busy !== null}
                          aria-label={`Remove ${name}`}
                          className={softButton}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </fieldset>
                  );
                })}
              </Card>
            );
          })}

          <div>
            <button type="submit" disabled={busy !== null} className={primaryButton}>
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              {busy === "saving"
                ? "Saving…"
                : reviewed
                  ? "Save changes"
                  : "Confirm information"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function Card({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description?: string;
  tone?: "default" | "error";
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm",
        tone === "error" ? "border-input-error" : "border-line-subtle"
      )}
    >
      <div>
        <h2 className="text-lg font-medium text-primary">{title}</h2>

        {description && (
          <p className={cn("mt-1 text-sm", tone === "error" ? "text-error-text" : "text-tertiary")}>
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function Banner({
  tone,
  role,
  children,
}: {
  tone: "error" | "success";
  role: "alert" | "status";
  children: ReactNode;
}) {
  const styles = {
    error: "border-input-error bg-error-bg text-error-text",
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
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  help?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-primary">
        {label}
        {optional && <span className="font-normal text-tertiary"> (optional)</span>}
      </label>

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

function TextInput({
  id,
  label,
  required,
  maxLength,
  type = "text",
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  maxLength: number;
  type?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} optional={!required} error={error}>
      {(describedBy) => (
        <input
          id={id}
          type={type}
          required={required}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass, "h-11", error ? "border-input-error" : "border-input-default")}
        />
      )}
    </Field>
  );
}

// A textarea; list fields put one item on each line.
function LinesInput({
  id,
  label,
  help,
  maxLength,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  maxLength?: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} optional help={help} error={error}>
      {(describedBy) => (
        <textarea
          id={id}
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputClass,
            "resize-y py-2.5 leading-6",
            error ? "border-input-error" : "border-input-default"
          )}
        />
      )}
    </Field>
  );
}
