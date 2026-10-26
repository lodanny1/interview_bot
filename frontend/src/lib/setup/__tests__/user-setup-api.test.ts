import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadUserSetup, saveUserSetup } from "@/lib/setup/user-setup-api";

const INPUT = {
  targetRole: "Software Engineer",
  experienceLevel: "ENTRY" as const,
  focusAreas: ["TECHNICAL" as const],
  targetCompany: "",
  bio: "",
};

const PROFILE = {
  user_id: "user-id",
  target_role: "Software Engineer",
  target_company: null,
  experience_level: "ENTRY",
  focus_areas: "TECHNICAL",
  bio: null,
  updated_at: "2026-10-21T00:00:00.000Z",
};

function mockFetch(response: { status: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("user setup API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends the setup info to PUT /me/setup with the user's token", async () => {
    const fetchMock = mockFetch({ status: 200, body: { profile: PROFILE, setupCompleted: true } });

    await expect(saveUserSetup("id-token", INPUT)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/setup",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ Authorization: "Bearer id-token" }),
        body: JSON.stringify(INPUT),
      })
    );
  });

  it("maps backend responses to typed save results", async () => {
    mockFetch({ status: 400, body: { fieldErrors: { targetRole: "Required" } } });
    await expect(saveUserSetup("t", INPUT)).resolves.toEqual({
      ok: false,
      reason: "invalid",
      fieldErrors: { targetRole: "Required" },
    });

    mockFetch({ status: 401 });
    await expect(saveUserSetup("t", INPUT)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });

    mockFetch({ status: 500 });
    await expect(saveUserSetup("t", INPUT)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("treats a network failure as unavailable instead of throwing (Scenario 4)", async () => {
    mockFetch(new TypeError("fetch failed"));
    await expect(saveUserSetup("t", INPUT)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("is unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const fetchMock = mockFetch({ status: 200 });
    await expect(saveUserSetup("t", INPUT)).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the saved profile and setup status for later sessions (Scenario 3)", async () => {
    mockFetch({ status: 200, body: { user: {}, profile: PROFILE, setupCompleted: true } });
    await expect(loadUserSetup("t")).resolves.toEqual({
      ok: true,
      status: { profile: PROFILE, setupCompleted: true },
    });

    mockFetch({ status: 401 });
    await expect(loadUserSetup("t")).resolves.toEqual({ ok: false, reason: "unauthenticated" });
  });
});
