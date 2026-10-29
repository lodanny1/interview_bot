"use client";

// Upload Resume (Issue #06).
// Users may save multiple PDF/DOCX resumes for different interview targets.
// Browser validation happens before the request; the API/backend validates again.

import {
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  Download,
  ExternalLink,
  FileText,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  RESUME_ACCEPT,
  fileTypeLabel,
  formatFileSize,
  validateResumeFile,
} from "@/lib/resume/resume-validation";

import {
  RESUME_API_URL,
  RESUME_ERROR_MESSAGES,
  RESUME_FILE_URL,
  RESUME_NOTICES,
  type Resume,
  type ResumeApiResponse,
} from "@/lib/resume/resume-state";

interface ResumeUploadProps {
  initialResumes: Resume[];
  loadError?: string;
}

type Status = "idle" | "uploading" | "removing";

interface Problem {
  message: string;
  chooseAnother?: boolean;
  signInAgain?: boolean;
}

const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cta px-5 text-sm font-semibold text-white transition-colors " +
  "hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const softButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-tinted px-4 text-sm font-semibold text-secondary transition-colors " +
  "hover:bg-pressed disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function ResumeUpload({
  initialResumes,
  loadError,
}: ResumeUploadProps) {
  const [resumes, setResumes] = useState<Resume[]>(initialResumes);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] =
    useState<string | null>(null);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showLoadError, setShowLoadError] =
    useState(Boolean(loadError));

  const inputRef = useRef<HTMLInputElement>(null);

  const busy = status !== "idle";

  function chooseFile(next: File | null | undefined) {
    setNotice(null);
    setShowLoadError(false);

    if (!next) return;

    const check = validateResumeFile(next);

    if (!check.ok) {
      setFile(null);
      setProblem({
        message: check.message,
        chooseAnother: true,
      });
      return;
    }

    setFile(next);
    setProblem(null);
  }

  function openPicker() {
    if (!inputRef.current) return;

    // Allows the same file to be selected again after an error.
    inputRef.current.value = "";
    inputRef.current.click();
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);

    if (!busy) {
      chooseFile(event.dataTransfer.files?.[0]);
    }
  }

  async function upload() {
    if (!file || busy) return;

    setStatus("uploading");
    setProblem(null);
    setNotice(null);

    const form = new FormData();
    form.set("file", file);

    let result: ResumeApiResponse | null = null;

    try {
      const response = await fetch(RESUME_API_URL, {
        method: "POST",
        body: form,
      });

      result = (await response.json()) as ResumeApiResponse;
    } catch {
      result = null;
    }

    setStatus("idle");

    if (result && "resume" in result) {
      // New resumes appear first.
      setResumes((current) => [
        result.resume,
        ...current,
      ]);

      setFile(null);
      setNotice(RESUME_NOTICES.uploaded);
      return;
    }

    const code =
      result && "code" in result
        ? result.code
        : "unavailable";

    if (code === "unauthenticated") {
      setProblem({
        message: RESUME_ERROR_MESSAGES.unauthenticated,
        signInAgain: true,
      });
      return;
    }

    if (
      code === "unavailable" ||
      !result ||
      !("error" in result)
    ) {
      // Keep the selected file so the user can retry.
      setProblem({
        message: RESUME_ERROR_MESSAGES.uploadUnavailable,
      });
      return;
    }

    // File validation failed, so don't keep the invalid selection.
    setFile(null);

    setProblem({
      message: result.error,
      chooseAnother: true,
    });
  }

  async function remove(resumeId: string) {
    if (busy) return;

    setStatus("removing");
    setRemovingId(resumeId);
    setProblem(null);
    setNotice(null);

    let result: ResumeApiResponse | null = null;

    try {
      const response = await fetch(
        `${RESUME_API_URL}?id=${encodeURIComponent(resumeId)}`,
        {
          method: "DELETE",
        }
      );

      result = (await response.json()) as ResumeApiResponse;
    } catch {
      result = null;
    }

    setStatus("idle");
    setRemovingId(null);
    setConfirmingRemoveId(null);

    if (result && "success" in result && result.success) {
      setResumes((current) =>
        current.filter((resume) => resume.id !== resumeId)
      );

      setNotice(RESUME_NOTICES.removed);
      return;
    }

    const code =
      result && "code" in result
        ? result.code
        : "unavailable";

    setProblem(
      code === "unauthenticated"
        ? {
            message: RESUME_ERROR_MESSAGES.unauthenticated,
            signInAgain: true,
          }
        : {
            message: RESUME_ERROR_MESSAGES.removeUnavailable,
          }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {showLoadError && loadError && (
        <Banner tone="warning" role="status">
          <p>{loadError}</p>
        </Banner>
      )}

      {problem && (
        <Banner tone="error" role="alert">
          <p>{problem.message}</p>

          {problem.signInAgain && (
            <Link
              href="/login"
              className="mt-1 inline-block font-semibold underline"
            >
              Go to Sign In
            </Link>
          )}

          {problem.chooseAnother && (
            <button
              type="button"
              onClick={openPicker}
              className="mt-1 inline-block font-semibold underline"
            >
              Choose a different file
            </button>
          )}
        </Banner>
      )}

      {notice && (
        <Banner tone="success" role="status">
          <p>{notice}</p>
        </Banner>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-line-subtle bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-medium text-primary">
            Upload a resume
          </h2>

          <p className="mt-1 text-sm text-tertiary">
            You can save multiple resumes and choose the appropriate
            one when creating an interview.
          </p>
        </div>

        <label
          htmlFor="resume-file"
          onDragOver={(event) => {
            event.preventDefault();

            if (!busy) {
              setDragging(true);
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring",
            dragging
              ? "border-cta bg-tinted"
              : "border-input-default hover:bg-hover/40",
            busy && "cursor-not-allowed opacity-60"
          )}
        >
          <Upload
            className="h-8 w-8 text-cta"
            aria-hidden="true"
          />

          <span className="text-base font-semibold text-primary">
            Drag and drop your resume here, or{" "}
            <span className="text-link underline">
              choose a file
            </span>
          </span>

          <span className="text-sm text-tertiary">
            PDF or Word (.docx), up to 5 MB
          </span>

          <input
            ref={inputRef}
            id="resume-file"
            name="file"
            type="file"
            accept={RESUME_ACCEPT}
            disabled={busy}
            onChange={(event) =>
              chooseFile(event.target.files?.[0])
            }
            className="sr-only"
          />
        </label>

        {file && (
          <div className="flex items-center gap-3 rounded-lg border border-line-subtle bg-app px-4 py-3">
            <FileText
              className="h-5 w-5 shrink-0 text-cta"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">
                {file.name}
              </p>

              <p className="text-xs text-tertiary">
                {formatFileSize(file.size)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={busy}
              aria-label={`Remove ${file.name}`}
              className="rounded p-1 text-tertiary hover:text-primary disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className={primaryButton}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />

            {status === "uploading"
              ? "Uploading…"
              : "Upload Resume"}
          </button>
        </div>
      </section>

      <section
        aria-labelledby="saved-resumes"
        className="flex flex-col gap-4"
      >
        <div>
          <h2
            id="saved-resumes"
            className="text-xl font-semibold text-primary"
          >
            Saved Resumes
          </h2>

          <p className="mt-1 text-sm text-tertiary">
            {resumes.length === 0
              ? "You haven't uploaded a resume yet."
              : `${resumes.length} ${
                  resumes.length === 1 ? "resume" : "resumes"
                } saved.`}
          </p>
        </div>

        {resumes.map((resume) => {
          const viewUrl =
            `${RESUME_FILE_URL}?id=${encodeURIComponent(
              resume.id
            )}`;

          const downloadUrl =
            `${viewUrl}&download=1`;

          const confirming =
            confirmingRemoveId === resume.id;

          const removing =
            removingId === resume.id;

          return (
            <article
              key={resume.id}
              className="rounded-2xl border border-line-subtle bg-card p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tinted">
                  <FileText
                    className="h-6 w-6 text-cta"
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-medium text-primary">
                    {resume.fileName}
                  </h3>

                  <p className="text-sm text-tertiary">
                    {fileTypeLabel(resume.contentType)}
                    {" · "}
                    {formatFileSize(resume.sizeBytes)}
                    {" · Uploaded "}

                    <time
                      dateTime={resume.uploadedAt}
                      suppressHydrationWarning
                    >
                      {formatDate(resume.uploadedAt)}
                    </time>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-line-subtle pt-4">
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener"
                  className={softButton}
                >
                  <ExternalLink
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  View
                </a>

                <a
                  href={downloadUrl}
                  className={softButton}
                >
                  <Download
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  Download
                </a>

                {!confirming && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingRemoveId(resume.id);
                      setNotice(null);
                    }}
                    disabled={busy}
                    className={softButton}
                  >
                    <Trash2
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    Remove
                  </button>
                )}
              </div>

              {confirming && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-error-bg px-4 py-3 text-sm text-error-text">
                  <span>
                    Remove this resume?
                  </span>

                  <button
                    type="button"
                    onClick={() => remove(resume.id)}
                    disabled={busy}
                    className="font-semibold underline disabled:opacity-50"
                  >
                    {removing
                      ? "Removing…"
                      : "Yes, remove it"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmingRemoveId(null)
                    }
                    disabled={busy}
                    className="font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
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

function Banner({
  tone,
  role,
  children,
}: {
  tone: "success" | "warning" | "error";
  role: "status" | "alert";
  children: ReactNode;
}) {
  const styles = {
    success:
      "border-success-border bg-success-bg text-success-text",
    warning:
      "border-warning-border bg-warning-bg text-warning-text",
    error:
      "border-error-border bg-error-bg text-error-text",
  }[tone];

  const Icon =
    tone === "error" || tone === "warning"
      ? TriangleAlert
      : null;

  return (
    <div
      role={role}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        styles
      )}
    >
      <div className="flex gap-2">
        {Icon && (
          <Icon
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
        )}

        <div>{children}</div>
      </div>
    </div>
  );
}
