// Server-side calls to the backend for Upload Resume (Issue #06).
//   GET    /me/resume      -> the saved resume's details
//   PUT    /me/resume      -> upload the file (raw bytes + X-File-Name header)
//   GET    /me/resume/file -> the file itself
//   DELETE /me/resume      -> remove it
// With USE_MOCK_DATA=true (local frontend development), an in-memory store is
// used instead of the backend.
import "server-only";

import type { Resume } from "./resume-state";
import {
  RESUME_FILE_TYPES,
  RESUME_VALIDATION_MESSAGES,
  type ResumeErrorCode,
  type ResumeExtension,
} from "./resume-validation";

type Failure = "unauthenticated" | "unavailable";

export type LoadResumeResult = { ok: true; resume: Resume | null } | { ok: false; reason: Failure };

export type UploadResumeResult =
  | { ok: true; resume: Resume }
  | { ok: false; reason: Failure }
  | { ok: false; reason: "invalid"; code: ResumeErrorCode; message: string };

export type RemoveResumeResult = { ok: true } | { ok: false; reason: Failure };

export type ResumeFileResult =
  | { ok: true; body: ReadableStream<Uint8Array> | Uint8Array; headers: Headers }
  | { ok: false; reason: Failure | "not_found" };

export function isMockMode(): boolean {
  return process.env.USE_MOCK_DATA === "true";
}

// Mock mode only: survives between requests while the dev server runs. Kept on
// globalThis because the page and the /api/resume routes load separate copies
// of this module in development.
type MockStore = { resume: Resume; bytes: Uint8Array } | null;
const mockGlobal = globalThis as typeof globalThis & { __mockResumeStore?: MockStore };

function getMockStore(): MockStore {
  return mockGlobal.__mockResumeStore ?? null;
}

function setMockStore(store: MockStore): void {
  mockGlobal.__mockResumeStore = store;
}

export function resetMockResume(): void {
  setMockStore(null);
}

async function request(path: string, init: RequestInit & { idToken: string }): Promise<Response | null> {
  const base = process.env.BACKEND_URL;
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return null;
  }

  const { idToken, headers, ...rest } = init;
  try {
    return await fetch(`${base}${path}`, {
      ...rest,
      headers: { Authorization: `Bearer ${idToken}`, ...headers },
      cache: "no-store",
    });
  } catch (error) {
    // Network failure or the backend is down.
    console.error(`${init.method ?? "GET"} ${path} failed:`, error);
    return null;
  }
}

function isAuthFailure(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function isResume(value: unknown): value is Resume {
  const r = value as Resume | null;
  return Boolean(r && typeof r.fileName === "string" && typeof r.sizeBytes === "number");
}

export async function loadResume(idToken: string): Promise<LoadResumeResult> {
  if (isMockMode()) return { ok: true, resume: getMockStore()?.resume ?? null };

  const response = await request("/me/resume", { method: "GET", idToken });
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (!response.ok) {
    console.error(`Loading resume failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const data = (await response.json().catch(() => null)) as { resume?: unknown } | null;
  if (!data) return { ok: false, reason: "unavailable" };
  return { ok: true, resume: isResume(data.resume) ? data.resume : null };
}

export async function uploadResume(
  idToken: string,
  file: { fileName: string; extension: ResumeExtension; bytes: Uint8Array }
): Promise<UploadResumeResult> {
  if (isMockMode()) {
    const resume: Resume = {
      fileName: file.fileName,
      contentType: RESUME_FILE_TYPES[file.extension],
      sizeBytes: file.bytes.length,
      uploadedAt: new Date().toISOString(),
    };
    setMockStore({ resume, bytes: file.bytes });
    return { ok: true, resume };
  }

  const response = await request("/me/resume", {
    method: "PUT",
    idToken,
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.fileName),
    },
    body: file.bytes as BodyInit,
  });
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };

  if (response.status === 400 || response.status === 413) {
    const data = (await response.json().catch(() => ({}))) as { code?: string };
    const code = (
      data.code && data.code in RESUME_VALIDATION_MESSAGES ? data.code : "unreadable_file"
    ) as ResumeErrorCode;
    return { ok: false, reason: "invalid", code, message: RESUME_VALIDATION_MESSAGES[code] };
  }

  if (!response.ok) {
    console.error(`Uploading resume failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const data = (await response.json().catch(() => null)) as { resume?: unknown } | null;
  return data && isResume(data.resume)
    ? { ok: true, resume: data.resume }
    : { ok: false, reason: "unavailable" };
}

export async function removeResume(idToken: string): Promise<RemoveResumeResult> {
  if (isMockMode()) {
    setMockStore(null);
    return { ok: true };
  }

  const response = await request("/me/resume", { method: "DELETE", idToken });
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (!response.ok) {
    console.error(`Removing resume failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true };
}

export async function fetchResumeFile(idToken: string, download: boolean): Promise<ResumeFileResult> {
  if (isMockMode()) {
    const store = getMockStore();
    if (!store) return { ok: false, reason: "not_found" };
    const { resume, bytes } = store;
    return {
      ok: true,
      body: bytes,
      headers: new Headers({
        "Content-Type": resume.contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(resume.fileName)}`,
      }),
    };
  }

  const response = await request(`/me/resume/file${download ? "?download=1" : ""}`, {
    method: "GET",
    idToken,
  });
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (!response.ok || !response.body) return { ok: false, reason: "unavailable" };

  const headers = new Headers();
  for (const name of ["Content-Type", "Content-Length", "Content-Disposition"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return { ok: true, body: response.body, headers };
}
