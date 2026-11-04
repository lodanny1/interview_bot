import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadSetupJobDescription,
  loadUserSetup,
  saveUserSetup,
} from "@/lib/setup/user-setup-api";

const INPUT = {
  targetRole: "Software Engineer",
  focusAreas: ["TECHNICAL" as const],
  targetCompany: "",
  bio: "",
  jobDescription: "",
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

describe("loadSetupJobDescription", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const JOBS = {
    targetJobs: [
      { job_title: "Data Analyst", company: null, description: "Other job" },
      { job_title: "Software Engineer", company: "Acme", description: "Saved from setup" },
    ],
  };

  it("finds the target job saved from setup by title and company", async () => {
    const fetchMock = mockFetch({ status: 200, body: JOBS });

    await expect(
      loadSetupJobDescription("id-token", { jobTitle: " software engineer", company: "ACME" })
    ).resolves.toBe("Saved from setup");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/target-jobs",
      expect.objectContaining({ headers: { Authorization: "Bearer id-token" } })
    );
  });

  it("returns an empty string when nothing matches or loading fails", async () => {
    mockFetch({ status: 200, body: JOBS });
    await expect(loadSetupJobDescription("t", { jobTitle: "Designer", company: "" })).resolves.toBe("");

    mockFetch({ status: 500 });
    await expect(loadSetupJobDescription("t", { jobTitle: "Data Analyst", company: "" })).resolves.toBe("");

    mockFetch(new TypeError("fetch failed"));
    await expect(loadSetupJobDescription("t", { jobTitle: "Data Analyst", company: "" })).resolves.toBe("");
  });
});
