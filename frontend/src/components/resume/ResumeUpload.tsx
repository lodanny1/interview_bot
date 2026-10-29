"use client";

// Upload Resume (Issue #06). Shows the saved resume, or a drop zone to upload
// one. Files are checked in the browser first (type and size); the upload
// route and backend check them again, including the file's contents.

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
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
  initialResume: Resume | null;
  // Shown when the saved resume couldn't be loaded; uploading still works.
  loadError?: string;
}

type Status = "idle" | "uploading" | "removing";

interface Problem {
  message: string;
  // The file itself was the problem, so offer to pick a different one.
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

export function ResumeUpload({ initialResume, loadError }: ResumeUploadProps) {
  const [resume, setResume] = useState<Resume | null>(initialResume);
  const [replacing, setReplacing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showLoadError, setShowLoadError] = useState(Boolean(loadError));
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = status !== "idle";
  const showUploader = !resume || replacing;

  function chooseFile(next: File | null | undefined) {
    setNotice(null);
    setShowLoadError(false);
    if (!next) return;

    const check = validateResumeFile(next);
    if (!check.ok) {
      setFile(null);
      setProblem({ message: check.message, chooseAnother: true });
      return;
    }
    setFile(next);
    setProblem(null);
  }

  function openPicker() {
    if (inputRef.current) {
      // Let the same file be chosen again after an error.
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) chooseFile(event.dataTransfer.files?.[0]);
  }

  async function send(method: "POST" | "DELETE", body?: FormData): Promise<ResumeApiResponse | null> {
    try {
      const response = await fetch(RESUME_API_URL, { method, body });
      return (await response.json()) as ResumeApiResponse;
    } catch {
      return null;
    }
  }

  async function upload() {
    if (!file || busy) return;
    setStatus("uploading");
    setProblem(null);
    setNotice(null);

    const form = new FormData();
    form.set("file", file);
    const result = await send("POST", form);
    setStatus("idle");

    if (result && "resume" in result && result.resume) {
      setResume(result.resume);
      setFile(null);
      setReplacing(false);
      setNotice(RESUME_NOTICES.uploaded);
      return;
    }

    // Keep the selected file so the user can retry (Scenario 2).
    const code = result && "code" in result ? result.code : "unavailable";
    if (code === "unauthenticated") {
      setProblem({ message: RESUME_ERROR_MESSAGES.unauthenticated, signInAgain: true });
    } else if (code === "unavailable" || !result || !("error" in result)) {
      setProblem({ message: RESUME_ERROR_MESSAGES.uploadUnavailable });
    } else {
      // The file was rejected (Scenario 3): don't keep it, offer another.
      setFile(null);
      setProblem({ message: result.error, chooseAnother: true });
    }
  }

  async function remove() {
    if (busy) return;
    setStatus("removing");
    setProblem(null);
    setNotice(null);

    const result = await send("DELETE");
    setStatus("idle");
    setConfirmingRemove(false);

    if (result && "resume" in result) {
      setResume(null);
      setReplacing(false);
      setNotice(RESUME_NOTICES.removed);
      return;
    }

    const code = result && "code" in result ? result.code : "unavailable";
    setProblem(
      code === "unauthenticated"
        ? { message: RESUME_ERROR_MESSAGES.unauthenticated, signInAgain: true }
        : { message: RESUME_ERROR_MESSAGES.removeUnavailable }
    );
  }

  function cancelReplace() {
    setReplacing(false);
    setFile(null);
    setProblem(null);
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
            <Link href="/login" className="mt-1 inline-block font-semibold underline">
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

      {resume && (
        <section
          aria-labelledby="saved-resume"
          className="rounded-2xl border border-line-subtle bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tinted">
              <FileText className="h-6 w-6 text-cta" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs uppercase tracking-wider text-tertiary">
                Current resume
              </p>
              <h2 id="saved-resume" className="truncate text-lg font-medium text-primary">
                {resume.fileName}
              </h2>
              <p className="text-sm text-tertiary">
                {fileTypeLabel(resume.contentType)} · {formatFileSize(resume.sizeBytes)} · Uploaded{" "}
                <time dateTime={resume.uploadedAt} suppressHydrationWarning>
                  {formatDate(resume.uploadedAt)}
                </time>
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-line-subtle pt-4">
            <a href={RESUME_FILE_URL} target="_blank" rel="noopener" className={softButton}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View
            </a>
            <a href={`${RESUME_FILE_URL}?download=1`} className={softButton}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </a>
            {!replacing && (
              <button
                type="button"
                onClick={() => {
                  setReplacing(true);
                  setConfirmingRemove(false);
                  setNotice(null);
                }}
                disabled={busy}
                className={softButton}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Replace
              </button>
            )}
            {!confirmingRemove && (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                disabled={busy}
                className={softButton}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>

          {confirmingRemove && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-error-bg px-4 py-3 text-sm text-error-text">
              <span>Remove your resume? You can upload a new one afterward.</span>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="font-semibold underline disabled:opacity-50"
              >
                {status === "removing" ? "Removing…" : "Yes, remove it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                disabled={busy}
                className="font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      )}

      {showUploader && (
        <section
          aria-label={resume ? "Replace resume" : "Upload resume"}
          className="flex flex-col gap-4 rounded-2xl border border-line-subtle bg-card p-6 shadow-sm"
        >
          {resume && (
            <h2 className="text-lg font-medium text-primary">Upload a new version</h2>
          )}

          <label
            htmlFor="resume-file"
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring",
              dragging ? "border-cta bg-tinted" : "border-input-default hover:bg-hover/40",
              busy && "cursor-not-allowed opacity-60"
            )}
          >
            <Upload className="h-8 w-8 text-cta" aria-hidden="true" />
            <span className="text-base font-semibold text-primary">
              Drag and drop your resume here, or{" "}
              <span className="text-link underline">choose a file</span>
            </span>
            <span className="text-sm text-tertiary">PDF or Word (.docx), up to 5 MB</span>
            <input
              ref={inputRef}
              id="resume-file"
              name="file"
              type="file"
              accept={RESUME_ACCEPT}
              disabled={busy}
              onChange={(event) => chooseFile(event.target.files?.[0])}
              className="sr-only"
            />
          </label>

          {file && (
            <div className="flex items-center gap-3 rounded-lg border border-line-subtle bg-app px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-cta" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-primary">{file.name}</p>
                <p className="text-xs text-tertiary">{formatFileSize(file.size)}</p>
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

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={upload}
              disabled={!file || busy}
              className={primaryButton}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {status === "uploading" ? "Uploading…" : "Upload resume"}
            </button>
            {resume && (
              <button type="button" onClick={cancelReplace} disabled={busy} className={softButton}>
                Cancel
              </button>
            )}
          </div>
        </section>
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
