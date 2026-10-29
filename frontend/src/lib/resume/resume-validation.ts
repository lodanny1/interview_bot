// Validation for Upload Resume (Issue #06). The client checks the name, type
// and size; the upload route also checks the file's first bytes. The backend
// repeats every check in backend/src/resumes/resume-validation.js; keep the two
// in sync.

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

export const RESUME_FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type ResumeExtension = keyof typeof RESUME_FILE_TYPES;

// For the file picker's accept attribute.
export const RESUME_ACCEPT = [".pdf", ".docx", ...Object.values(RESUME_FILE_TYPES)].join(",");

export type ResumeErrorCode =
  | "missing_file"
  | "empty_file"
  | "too_large"
  | "unsupported_type"
  | "unreadable_file";

export const RESUME_VALIDATION_MESSAGES: Record<ResumeErrorCode, string> = {
  missing_file: "Choose a resume file to upload.",
  empty_file: "That file is empty. Choose your resume file.",
  too_large: "That file is larger than 5 MB. Save a smaller version and try again.",
  unsupported_type: "Upload your resume as a PDF or Word (.docx) file.",
  unreadable_file:
    "We couldn't read that file. It may be damaged or not really a PDF or Word file. Try exporting it again.",
};

export type ResumeCheck =
  | { ok: true; extension: ResumeExtension }
  | { ok: false; code: ResumeErrorCode; message: string };

function fail(code: ResumeErrorCode): ResumeCheck {
  return { ok: false, code, message: RESUME_VALIDATION_MESSAGES[code] };
}

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

function isResumeExtension(value: string): value is ResumeExtension {
  return Object.hasOwn(RESUME_FILE_TYPES, value);
}

// Checks what the browser knows before uploading: name, type and size.
export function validateResumeFile(file: { name: string; size: number } | null | undefined): ResumeCheck {
  if (!file || !file.name) return fail("missing_file");

  const extension = extensionOf(file.name);
  if (!isResumeExtension(extension)) return fail("unsupported_type");
  if (file.size === 0) return fail("empty_file");
  if (file.size > MAX_RESUME_BYTES) return fail("too_large");

  return { ok: true, extension };
}

// Checks the file's first bytes so a renamed file is caught. PDF files start
// with "%PDF-". DOCX files are zip archives that contain "word/document.xml".
export function matchesResumeSignature(bytes: Uint8Array, extension: ResumeExtension): boolean {
  if (extension === "pdf") {
    return new TextDecoder("latin1").decode(bytes.subarray(0, 5)) === "%PDF-";
  }
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return isZip && new TextDecoder("latin1").decode(bytes).includes("word/document.xml");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeLabel(contentType: string): string {
  return contentType === RESUME_FILE_TYPES.pdf ? "PDF" : "Word document";
}
