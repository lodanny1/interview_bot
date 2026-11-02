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
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.USE_MOCK_DATA === "true"
  );
}

// CONTRACT: the JSON body sent to POST /interviews.
// If the backend wants different enum values or field names, map them here.
function toRequestBody(input: StartInterviewInput): unknown {
  return input;
}

function isInterviewMode(value: unknown): value is InterviewMode {
  return (
    typeof value === "string" && (INTERVIEW_MODES as string[]).includes(value)
  );
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
    ? body.messages
        .map(parseMessage)
        .filter((m): m is InterviewMessage => m !== null)
    : [];

  const session: ActiveInterviewSession = {
    id: body.id,
    title:
      typeof body.title === "string" && body.title ? body.title : "Interview",
    mode: body.mode,
    status:
      body.status === "COMPLETED" || body.status === "ABANDONED"
        ? body.status
        : "ACTIVE",
    startedAt:
      typeof body.startedAt === "string"
        ? body.startedAt
        : new Date().toISOString(),
    endsAt:
      typeof body.endsAt === "string"
        ? body.endsAt
        : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    durationMinutes:
      typeof body.durationMinutes === "number" ? body.durationMinutes : 30,
    completionReason:
      body.completionReason === "USER_ENDED" ||
      body.completionReason === "TIME_LIMIT" ||
      body.completionReason === "ABANDONED"
        ? body.completionReason
        : null,
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
  if (
    typeof body.estimatedMinutesRemaining === "number" &&
    body.estimatedMinutesRemaining >= 0
  ) {
    session.estimatedMinutesRemaining = Math.ceil(
      body.estimatedMinutesRemaining,
    );
  }

  return session;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function startInterviewSession(
  idToken: string,
  input: StartInterviewInput,
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
        console.error(
          "Starting interview returned an unexpected response body.",
        );
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
  id: string,
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
    const response = await fetch(
      `${base}/interviews/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      },
    );

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

export type SendInterviewMessageResult =
  | {
      ok: true;
      messages: InterviewMessage[];
      completed: boolean;
      completionReason: "TIME_LIMIT" | "USER_ENDED" | "ABANDONED" | null;
    }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "not-found"
        | "inactive"
        | "invalid"
        | "unavailable";
    };

export async function sendInterviewMessage(
  idToken: string,
  sessionId: string,
  content: string,
): Promise<SendInterviewMessageResult> {
  const base = backendUrl();

  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return {
      ok: false,
      reason: "unavailable",
    };
  }

  try {
    const response = await fetch(
      `${base}/interviews/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
        }),
        cache: "no-store",
      },
    );

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "unauthenticated",
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        reason: "not-found",
      };
    }

    if (response.status === 409) {
      return {
        ok: false,
        reason: "inactive",
      };
    }

    if (response.status === 400) {
      return {
        ok: false,
        reason: "invalid",
      };
    }

    if (!response.ok) {
      console.error(
        `Sending interview response failed with status ${response.status}`,
      );

      return {
        ok: false,
        reason: "unavailable",
      };
    }

    const body = (await response.json().catch(() => null)) as {
      messages?: unknown;
      completed?: unknown;
      completionReason?: unknown;
    } | null;

    if (!body || !Array.isArray(body.messages)) {
      console.error(
        "Sending interview response returned an unexpected response body.",
      );

      return {
        ok: false,
        reason: "unavailable",
      };
    }

    const messages = body.messages
      .map(parseMessage)
      .filter(
        (message: InterviewMessage | null): message is InterviewMessage =>
          message !== null,
      );

    if (messages.length !== body.messages.length) {
      console.error("Sending interview response returned malformed messages.");

      return {
        ok: false,
        reason: "unavailable",
      };
    }

    return {
      ok: true,
      messages,
      completed: body.completed === true,
      completionReason:
        body.completionReason === "TIME_LIMIT" ||
        body.completionReason === "USER_ENDED" ||
        body.completionReason === "ABANDONED"
          ? body.completionReason
          : null,
    };
  } catch (error) {
    console.error("Sending interview response failed:", error);

    return {
      ok: false,
      reason: "unavailable",
    };
  }
}

export type CompleteInterviewResult =
  | {
      ok: true;
      status: "COMPLETED" | "ABANDONED";
      completionReason: "USER_ENDED" | "TIME_LIMIT" | "ABANDONED" | null;
      messages: InterviewMessage[];
    }
  | {
      ok: false;
      reason: "unauthenticated" | "not-found" | "inactive" | "unavailable";
    };

export async function completeInterviewSession(
  idToken: string,
  sessionId: string,
  reason: "USER_ENDED" | "TIME_LIMIT" | "ABANDONED" = "USER_ENDED",
): Promise<CompleteInterviewResult> {
  const base = backendUrl();

  if (!base) {
    return {
      ok: false,
      reason: "unavailable",
    };
  }

  try {
    const response = await fetch(
      `${base}/interviews/${encodeURIComponent(sessionId)}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
        }),
        cache: "no-store",
      },
    );

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "unauthenticated",
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        reason: "not-found",
      };
    }

    if (response.status === 409) {
      return {
        ok: false,
        reason: "inactive",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: "unavailable",
      };
    }

    const body = await response.json().catch(() => null);

    const session = body?.session;

    if (!session) {
      return {
        ok: false,
        reason: "unavailable",
      };
    }

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

    const messages = rawMessages
      .map(parseMessage)
      .filter(
        (message: InterviewMessage | null): message is InterviewMessage =>
          message !== null,
      );

    return {
      ok: true,
      status: session.status === "ABANDONED" ? "ABANDONED" : "COMPLETED",
      completionReason:
        session.completionReason === "USER_ENDED" ||
        session.completionReason === "TIME_LIMIT" ||
        session.completionReason === "ABANDONED"
          ? session.completionReason
          : null,
      messages,
    };
  } catch (error) {
    console.error("Completing interview failed:", error);

    return {
      ok: false,
      reason: "unavailable",
    };
  }
}

export type InterviewHistoryItem = {
  id: string;
  title: string;
  mode: InterviewMode;
  industry: string | null;
  role: string | null;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  durationMinutes: number;
  startedAt: string;
  completedAt: string | null;
  completionReason: "USER_ENDED" | "TIME_LIMIT" | "ABANDONED" | null;
};

export type InterviewHistoryResult =
  | {
      ok: true;
      sessions: InterviewHistoryItem[];
    }
  | {
      ok: false;
      reason: "unauthenticated" | "unavailable";
    };

export async function loadInterviewHistory(
  idToken: string,
): Promise<InterviewHistoryResult> {
  const base = backendUrl();

  if (!base) {
    return {
      ok: false,
      reason: "unavailable",
    };
  }

  try {
    const response = await fetch(`${base}/interviews`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "unauthenticated",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: "unavailable",
      };
    }

    const body = await response.json().catch(() => null);

    const sessions = Array.isArray(body?.sessions) ? body.sessions : [];

    return {
      ok: true,
      sessions,
    };
  } catch (error) {
    console.error("Loading interview history failed:", error);

    return {
      ok: false,
      reason: "unavailable",
    };
  }
}
