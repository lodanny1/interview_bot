// Server-side calls to the backend for Complete User Setup (Issue #05).
//   GET /me        -> load saved setup info and whether setup is complete
//   PUT /me/setup  -> save setup info
import "server-only";

import type { SetupFieldErrors, SetupInput } from "./setup-validation";

export interface UserProfile {
  user_id: string;
  target_role: string | null;
  target_company: string | null;
  experience_level: string | null;
  focus_areas: string | null;
  bio: string | null;
  updated_at: string;
}

export interface UserSetupStatus {
  profile: UserProfile | null;
  // undefined when the backend is older than this feature.
  setupCompleted?: boolean;
}

export type LoadSetupResult =
  | { ok: true; status: UserSetupStatus }
  | { ok: false; reason: "unauthenticated" | "unavailable" };

export type SaveSetupResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "invalid" | "unavailable";
      fieldErrors?: SetupFieldErrors;
    };

function backendUrl(): string | null {
  return process.env.BACKEND_URL || null;
}

export async function loadUserSetup(idToken: string): Promise<LoadSetupResult> {
  const base = backendUrl();
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await fetch(`${base}/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthenticated" };
    }
    if (!response.ok) {
      console.error(`Loading user setup failed with status ${response.status}`);
      return { ok: false, reason: "unavailable" };
    }

    const data = (await response.json()) as {
      profile?: UserProfile | null;
      setupCompleted?: boolean;
    };

    return {
      ok: true,
      status: {
        profile: data.profile ?? null,
        setupCompleted: data.setupCompleted,
      },
    };
  } catch (error) {
    console.error("Loading user setup failed:", error);
    return { ok: false, reason: "unavailable" };
  }
}

export async function saveUserSetup(
  idToken: string,
  input: SetupInput
): Promise<SaveSetupResult> {
  const base = backendUrl();
  if (!base) {
    console.error("BACKEND_URL is not configured.");
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await fetch(`${base}/me/setup`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthenticated" };
    }

    if (response.status === 400) {
      const data = (await response.json().catch(() => ({}))) as {
        fieldErrors?: SetupFieldErrors;
      };
      return { ok: false, reason: "invalid", fieldErrors: data.fieldErrors };
    }

    console.error(`Saving user setup failed with status ${response.status}`);
    return { ok: false, reason: "unavailable" };
  } catch (error) {
    // Network failure or the backend is down (Scenario 4).
    console.error("Saving user setup failed:", error);
    return { ok: false, reason: "unavailable" };
  }
}
