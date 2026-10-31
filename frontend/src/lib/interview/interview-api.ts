// Server-side calls to the backend for Start Interview Session (Issue #51).
//   POST /interviews      -> start a session from the setup config
//   GET  /interviews/:id  -> load a session (config + transcript so far)
//
// The routes and response shape below are a GUESS until the backend contract is confirmed.
// Everything you might need to change is marked "CONTRACT".
import "server-only";

import type {
  ActiveInterviewSession,
  InterviewMessage,
  InterviewMode,
  StartInterviewInput,
} from "@/types/interview";
import { INTERVIEW_MODES } from "./interview-options";
import { createMockSession, getMockSession } from "./interview-mock";
import type { InterviewFieldErrors } from "./interview-validation";

export type StartInterviewResult =
  | { ok: true; session: ActiveInterviewSession }
  | {
      ok: false;
      reason: "unauthenticated" | "invalid" | "unavailable";
      fieldErrors?: InterviewFieldErrors;
    };

export type LoadInterviewResult =
  | { ok: true; session: ActiveInterviewSession }
  | { ok: false; reason: "unauthenticated" | "not-found" | "unavailable" };

function backendUrl(): string | null {
  return process.env.BACKEND_URL || null;
}

// Local development only: USE_MOCK_DATA=true skips the backend entirely.
// Never active in production builds.
export function isInterviewMockMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.USE_MOCK_DATA === "true";
}

// CONTRACT: the JSON body sent to POST /interviews.
// If the backend wants different enum values or field names, map them here.
function toRequestBody(input: StartInterviewInput): unknown {
  return input;
}

function isInterviewMode(value: unknown): value is InterviewMode {
  return typeof value === "string" && (INTERVIEW_MODES as string[]).includes(value);
}

function parseMessage(raw: unknown): InterviewMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.role !== "interviewer" && m.role !== "candidate") return null;
  if (typeof m.content !== "string") return null;
  if (typeof m.id !== "string" && typeof m.id !== "number") return null;

  const parsed = new Date(m.timestamp as string | number);
  return {
    id: String(m.id),
    role: m.role,
    content: m.content,
    timestamp: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
  };
}

// CONTRACT: accepts either { session: {...} } or the session object itself.
// Returns null for a malformed body so a bad 200 becomes "unavailable" instead of a crash.
function parseSession(raw: unknown): ActiveInterviewSession | null {
  if (!raw || typeof raw !== "object") return null;
  const wrapper = raw as Record<string, unknown>;
  const body = (wrapper.session ?? wrapper) as Record<string, unknown>;
  if (!body || typeof body !== "object") return null;

  if (typeof body.id !== "string" || !body.id) return null;
  if (!isInterviewMode(body.mode)) return null;

  const messages = Array.isArray(body.messages)
    ? body.messages.map(parseMessage).filter((m): m is InterviewMessage => m !== null)
    : [];

  const session: ActiveInterviewSession = {
    id: body.id,
    title: typeof body.title === "string" && body.title ? body.title : "Interview",
    mode: body.mode,
    focusArea: optionalString(body.focusArea) ?? "",
    messages,
  };

  const industry = optionalString(body.industry);
  if (industry) session.industry = industry;
  const roleLevel = optionalString(body.roleLevel);
  if (roleLevel) session.roleLevel = roleLevel;
  const experienceLevel = optionalString(body.experienceLevel);
  if (experienceLevel) session.experienceLevel = experienceLevel;

  if (typeof body.totalQuestions === "number" && body.totalQuestions > 0) {
    session.totalQuestions = Math.floor(body.totalQuestions);
  }
  if (typeof body.estimatedMinutesRemaining === "number" && body.estimatedMinutesRemaining >= 0) {
    session.estimatedMinutesRemaining = Math.ceil(body.estimatedMinutesRemaining);
  }

  return session;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function startInterviewSession(
  idToken: string,
  input: StartInterviewInput
): Promise<StartInterviewResult> {
  if (isInterviewMockMode()) {
    return { ok: true, session: createMockSession(input) };
  }

  const base = backendUrl();
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await fetch(`${base}/interviews`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toRequestBody(input)),
      cache: "no-store",
    });

    if (response.ok) {
      const session = parseSession(await response.json().catch(() => null));
      if (!session) {
        console.error("Starting interview returned an unexpected response body.");
        return { ok: false, reason: "unavailable" };
      }
      return { ok: true, session };
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthenticated" };
    }

    if (response.status === 400 || response.status === 422) {
      const data = (await response.json().catch(() => ({}))) as {
        fieldErrors?: InterviewFieldErrors;
      };
      return { ok: false, reason: "invalid", fieldErrors: data.fieldErrors };
    }

    console.error(`Starting interview failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  } catch (error) {
    // Network failure or the backend is down.
    console.error("Starting interview failed:", error);
    return { ok: false, reason: "unavailable" };
  }
}

export async function loadInterviewSession(
  idToken: string,
  id: string
): Promise<LoadInterviewResult> {
  if (isInterviewMockMode()) {
    const session = getMockSession(id);
    return session ? { ok: true, session } : { ok: false, reason: "not-found" };
  }

  const base = backendUrl();
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await fetch(`${base}/interviews/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthenticated" };
    }
    if (response.status === 404) {
      return { ok: false, reason: "not-found" };
    }
    if (!response.ok) {
      console.error(`Loading interview failed with status ${response.status}`);
      return { ok: false, reason: "unavailable" };
    }

    const session = parseSession(await response.json().catch(() => null));
    if (!session) {
      console.error("Loading interview returned an unexpected response body.");
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, session };
  } catch (error) {
    console.error("Loading interview failed:", error);
    return { ok: false, reason: "unavailable" };
  }
}
