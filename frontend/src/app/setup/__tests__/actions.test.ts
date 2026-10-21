import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { saveUserSetup } from "@/lib/setup/user-setup-api";
import { SETUP_VALIDATION_MESSAGES as MSG } from "@/lib/setup/setup-validation";
import {
  INITIAL_SETUP_FORM_STATE,
  POST_SETUP_REDIRECT,
  SETUP_ERROR_MESSAGES,
} from "@/lib/setup/setup-form-state";
import { completeSetupAction } from "@/app/setup/actions";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/setup/user-setup-api", () => ({
  saveUserSetup: vi.fn(),
}));

// The real redirect() throws to abort rendering; mirror that.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

function mockSessionCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn(() => (value ? { name: "ib_session", value } : undefined)),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function setupForm(overrides: Record<string, string | string[]> = {}) {
  const values: Record<string, string | string[]> = {
    targetRole: "Software Engineer",
    experienceLevel: "ENTRY",
    focusAreas: ["BEHAVIORAL", "TECHNICAL"],
    targetCompany: "",
    bio: "",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}

const run = (data: FormData) => completeSetupAction(INITIAL_SETUP_FORM_STATE, data);

describe("completeSetupAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCookie("id-token");
  });

  it("saves the setup info and redirects to the dashboard (Scenario 1)", async () => {
    vi.mocked(saveUserSetup).mockResolvedValue({ ok: true });

    await expect(run(setupForm({ targetCompany: " Acme " }))).rejects.toThrow("NEXT_REDIRECT");

    expect(saveUserSetup).toHaveBeenCalledWith("id-token", {
      targetRole: "Software Engineer",
      experienceLevel: "ENTRY",
      focusAreas: ["BEHAVIORAL", "TECHNICAL"],
      targetCompany: "Acme",
      bio: "",
    });
    expect(redirect).toHaveBeenCalledWith(POST_SETUP_REDIRECT);
  });

  it("does not submit when required info is missing (Scenario 2)", async () => {
    const data = setupForm({ targetRole: "", experienceLevel: "", focusAreas: [] });

    await expect(run(data)).resolves.toEqual({
      fieldErrors: {
        targetRole: MSG.targetRoleRequired,
        experienceLevel: MSG.experienceLevelRequired,
        focusAreas: MSG.focusAreasRequired,
      },
    });
    expect(saveUserSetup).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("stays on the page with a retryable error when the service is down (Scenario 4)", async () => {
    vi.mocked(saveUserSetup).mockResolvedValue({ ok: false, reason: "unavailable" });

    await expect(run(setupForm())).resolves.toEqual({
      formError: SETUP_ERROR_MESSAGES.unavailable,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows the backend's field errors when it rejects the data", async () => {
    vi.mocked(saveUserSetup).mockResolvedValue({
      ok: false,
      reason: "invalid",
      fieldErrors: { targetRole: "Target role is required." },
    });

    await expect(run(setupForm())).resolves.toEqual({
      formError: SETUP_ERROR_MESSAGES.invalid,
      fieldErrors: { targetRole: "Target role is required." },
    });
  });

  it("asks the user to sign in again when the session is missing or expired", async () => {
    mockSessionCookie(undefined);
    await expect(run(setupForm())).resolves.toEqual({
      formError: SETUP_ERROR_MESSAGES.unauthenticated,
      signInAgain: true,
    });
    expect(saveUserSetup).not.toHaveBeenCalled();

    mockSessionCookie("expired-token");
    vi.mocked(saveUserSetup).mockResolvedValue({ ok: false, reason: "unauthenticated" });
    await expect(run(setupForm())).resolves.toEqual({
      formError: SETUP_ERROR_MESSAGES.unauthenticated,
      signInAgain: true,
    });
  });
});
