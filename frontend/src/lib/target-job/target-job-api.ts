// Server-side calls to the backend for Add Target Job Description (Issue #09).
//   GET    /me/target-job -> load the saved target job
//   PUT    /me/target-job -> save (create or replace) it
//   DELETE /me/target-job -> remove it
// With USE_MOCK_DATA=true (local frontend development), an in-memory store is
// used instead of the backend.
import "server-only";

import type { TargetJob } from "./target-job-form-state";
import type { TargetJobFieldErrors, TargetJobInput } from "./target-job-validation";

type Failure = "unauthenticated" | "unavailable";

export type LoadTargetJobResult =
  | { ok: true; targetJob: TargetJob | null }
  | { ok: false; reason: Failure };

export type SaveTargetJobResult =
  | { ok: true; targetJob: TargetJob }
  | { ok: false; reason: Failure | "invalid"; fieldErrors?: TargetJobFieldErrors };

export type RemoveTargetJobResult = { ok: true } | { ok: false; reason: Failure };

// Row shape returned by the backend.
interface TargetJobRow {
  job_title: string;
  company: string | null;
  description: string;
  updated_at: string;
}

function toTargetJob(row: TargetJobRow): TargetJob {
  return {
    jobTitle: row.job_title,
    company: row.company,
    description: row.description,
    updatedAt: row.updated_at,
  };
}

export function isMockMode(): boolean {
  return process.env.USE_MOCK_DATA === "true";
}

// Mock mode only: survives between requests while the dev server runs. Kept on
// globalThis because Next bundles pages, server actions and route handlers
// separately; a module-level variable would give each its own copy, and the
// interview insights route wouldn't see a job saved from the page.
const MOCK_TARGET_JOB = Symbol.for("interview-bot.mock-target-job");
const mockStore = globalThis as unknown as Record<symbol, TargetJob | null | undefined>;

function getMockStoreJob(): TargetJob | null {
  return mockStore[MOCK_TARGET_JOB] ?? null;
}

function setMockStoreJob(targetJob: TargetJob | null): void {
  mockStore[MOCK_TARGET_JOB] = targetJob;
}

async function request(
  method: "GET" | "PUT" | "DELETE",
  idToken: string,
  body?: TargetJobInput
): Promise<Response | null> {
  const base = process.env.BACKEND_URL;
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return null;
  }

  try {
    return await fetch(`${base}/me/target-job`, {
      method,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    // Network failure or the backend is down.
    console.error(`${method} /me/target-job failed:`, error);
    return null;
  }
}

function isAuthFailure(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

export async function loadTargetJob(idToken: string): Promise<LoadTargetJobResult> {
  if (isMockMode()) {
    return { ok: true, targetJob: getMockStoreJob() };
  }

  const response = await request("GET", idToken);
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (!response.ok) {
    console.error(`Loading target job failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  try {
    const data = (await response.json()) as { targetJob?: TargetJobRow | null };
    return { ok: true, targetJob: data.targetJob ? toTargetJob(data.targetJob) : null };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function saveTargetJob(
  idToken: string,
  input: TargetJobInput
): Promise<SaveTargetJobResult> {
  if (isMockMode()) {
    const targetJob: TargetJob = {
      jobTitle: input.jobTitle,
      company: input.company || null,
      description: input.description,
      updatedAt: new Date().toISOString(),
    };
    setMockStoreJob(targetJob);
    return { ok: true, targetJob };
  }

  const response = await request("PUT", idToken, input);
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };

  if (response.status === 400) {
    const data = (await response.json().catch(() => ({}))) as {
      fieldErrors?: TargetJobFieldErrors;
    };
    return { ok: false, reason: "invalid", fieldErrors: data.fieldErrors };
  }

  if (!response.ok) {
    console.error(`Saving target job failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  try {
    const data = (await response.json()) as { targetJob?: TargetJobRow };
    if (!data.targetJob) return { ok: false, reason: "unavailable" };
    return { ok: true, targetJob: toTargetJob(data.targetJob) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function removeTargetJob(idToken: string): Promise<RemoveTargetJobResult> {
  if (isMockMode()) {
    setMockStoreJob(null);
    return { ok: true };
  }

  const response = await request("DELETE", idToken);
  if (!response) return { ok: false, reason: "unavailable" };
  if (isAuthFailure(response)) return { ok: false, reason: "unauthenticated" };
  if (!response.ok) {
    console.error(`Removing target job failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true };
}

// Mock mode only: lets the interview insights mock follow the saved job.
export function getMockTargetJob(): TargetJob | null {
  return getMockStoreJob();
}

// Tests only.
export function resetMockTargetJob(): void {
  setMockStoreJob(null);
}
