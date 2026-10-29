// Server-side backend calls for Upload Resume (Issue #06).
//
// Backend contract:
//   GET    /me/resumes
//   POST   /me/resumes
//   GET    /me/resumes/:resumeId/file
//   DELETE /me/resumes/:resumeId

import "server-only";

import type { Resume } from "./resume-state";
import {
  RESUME_FILE_TYPES,
  RESUME_VALIDATION_MESSAGES,
  type ResumeErrorCode,
  type ResumeExtension,
} from "./resume-validation";

type Failure = "unauthenticated" | "unavailable";

export type LoadResumesResult =
  | { ok: true; resumes: Resume[] }
  | { ok: false; reason: Failure };

export type UploadResumeResult =
  | { ok: true; resume: Resume }
  | { ok: false; reason: Failure }
  | { ok: false; reason: "invalid"; code: ResumeErrorCode; message: string };

export type RemoveResumeResult =
  | { ok: true }
  | { ok: false; reason: Failure | "not_found" };

export type ResumeFileResult =
  | { ok: true; body: ReadableStream<Uint8Array> | Uint8Array; headers: Headers }
  | { ok: false; reason: Failure | "not_found" };

export function isMockMode(): boolean {
  return process.env.USE_MOCK_DATA === "true";
}

// Mock mode supports multiple saved resumes as well.
type MockResume = {
  resume: Resume;
  bytes: Uint8Array;
};

const mockGlobal = globalThis as typeof globalThis & {
  __mockResumeStore?: MockResume[];
};

function getMockStore(): MockResume[] {
  return mockGlobal.__mockResumeStore ?? [];
}

function setMockStore(store: MockResume[]): void {
  mockGlobal.__mockResumeStore = store;
}

export function resetMockResume(): void {
  setMockStore([]);
}

async function request(
  path: string,
  init: RequestInit & { idToken: string }
): Promise<Response | null> {
  const base = process.env.BACKEND_URL;

  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return null;
  }

  const { idToken, headers, ...rest } = init;

  try {
    return await fetch(`${base}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error(`${init.method ?? "GET"} ${path} failed:`, error);
    return null;
  }
}

function isAuthFailure(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function isResume(value: unknown): value is Resume {
  const resume = value as Resume | null;

  return Boolean(
    resume &&
      typeof resume.id === "string" &&
      typeof resume.fileName === "string" &&
      typeof resume.contentType === "string" &&
      typeof resume.sizeBytes === "number" &&
      typeof resume.uploadedAt === "string"
  );
}

export async function loadResumes(idToken: string): Promise<LoadResumesResult> {
  if (isMockMode()) {
    return {
      ok: true,
      resumes: getMockStore().map((item) => item.resume),
    };
  }

  const response = await request("/me/resumes", {
    method: "GET",
    idToken,
  });

  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };

  if (!response.ok) {
    console.error(`Loading resumes failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const data = (await response.json().catch(() => null)) as {
    resumes?: unknown;
  } | null;

  if (!data || !Array.isArray(data.resumes)) {
    return { ok: false, reason: "unavailable" };
  }

  return {
    ok: true,
    resumes: data.resumes.filter(isResume),
  };
}

export async function uploadResume(
  idToken: string,
  file: {
    fileName: string;
    extension: ResumeExtension;
    bytes: Uint8Array;
  }
): Promise<UploadResumeResult> {
  if (isMockMode()) {
    const resume: Resume = {
      id: crypto.randomUUID(),
      fileName: file.fileName,
      contentType: RESUME_FILE_TYPES[file.extension],
      sizeBytes: file.bytes.length,
      uploadedAt: new Date().toISOString(),
    };

    setMockStore([
      {
        resume,
        bytes: file.bytes,
      },
      ...getMockStore(),
    ]);

    return { ok: true, resume };
  }

  const response = await request("/me/resumes", {
    method: "POST",
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
    const data = (await response.json().catch(() => ({}))) as {
      code?: string;
    };

    const code = (
      data.code && data.code in RESUME_VALIDATION_MESSAGES
        ? data.code
        : "unreadable_file"
    ) as ResumeErrorCode;

    return {
      ok: false,
      reason: "invalid",
      code,
      message: RESUME_VALIDATION_MESSAGES[code],
    };
  }

  if (!response.ok) {
    console.error(`Uploading resume failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  const data = (await response.json().catch(() => null)) as {
    resume?: unknown;
  } | null;

  return data && isResume(data.resume)
    ? { ok: true, resume: data.resume }
    : { ok: false, reason: "unavailable" };
}

export async function removeResume(
  idToken: string,
  resumeId: string
): Promise<RemoveResumeResult> {
  if (isMockMode()) {
    const before = getMockStore();
    const after = before.filter((item) => item.resume.id !== resumeId);

    if (after.length === before.length) {
      return { ok: false, reason: "not_found" };
    }

    setMockStore(after);
    return { ok: true };
  }

  const response = await request(`/me/resumes/${encodeURIComponent(resumeId)}`, {
    method: "DELETE",
    idToken,
  });

  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (response.status === 404) return { ok: false, reason: "not_found" };

  if (!response.ok) {
    console.error(`Removing resume failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true };
}

export async function fetchResumeFile(
  idToken: string,
  resumeId: string,
  download: boolean
): Promise<ResumeFileResult> {
  if (isMockMode()) {
    const item = getMockStore().find(
      (entry) => entry.resume.id === resumeId
    );

    if (!item) return { ok: false, reason: "not_found" };

    return {
      ok: true,
      body: item.bytes,
      headers: new Headers({
        "Content-Type": item.resume.contentType,
        "Content-Disposition":
          `${download ? "attachment" : "inline"}; ` +
          `filename*=UTF-8''${encodeURIComponent(item.resume.fileName)}`,
      }),
    };
  }

  const path =
    `/me/resumes/${encodeURIComponent(resumeId)}/file` +
    (download ? "?download=1" : "");

  const response = await request(path, {
    method: "GET",
    idToken,
  });

  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (response.status === 404) return { ok: false, reason: "not_found" };

  if (!response.ok || !response.body) {
    return { ok: false, reason: "unavailable" };
  }

  const headers = new Headers();

  for (const name of [
    "Content-Type",
    "Content-Length",
    "Content-Disposition",
  ]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  return {
    ok: true,
    body: response.body,
    headers,
  };
}
