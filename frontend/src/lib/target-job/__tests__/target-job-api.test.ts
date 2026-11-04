import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadTargetJob,
  loadTargetJobDefaults,
  removeTargetJob,
  resetMockTargetJob,
  saveTargetJob,
} from "@/lib/target-job/target-job-api";

const INPUT = {
  jobTitle: "Junior Software Engineer",
  company: "Acme",
  description: "A full job description.",
};

const ROW = {
  user_id: "user-id",
  job_title: "Junior Software Engineer",
  company: "Acme",
  description: "A full job description.",
  created_at: "2026-10-26T00:00:00.000Z",
  updated_at: "2026-10-26T00:00:00.000Z",
};

const TARGET_JOB = {
  jobTitle: "Junior Software Engineer",
  company: "Acme",
  description: "A full job description.",
  updatedAt: "2026-10-26T00:00:00.000Z",
};

function mockFetch(response: { status: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    const body = response.status === 204 ? null : JSON.stringify(response.body ?? {});
    return new Response(body, { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("target job API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubEnv("USE_MOCK_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saves with PUT /me/target-job and returns the saved job (Scenario 1)", async () => {
    const fetchMock = mockFetch({ status: 200, body: { targetJob: ROW } });

    await expect(saveTargetJob("id-token", INPUT)).resolves.toEqual({
      ok: true,
      targetJob: TARGET_JOB,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/target-job",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ Authorization: "Bearer id-token" }),
        body: JSON.stringify(INPUT),
      })
    );
  });

  it("maps backend errors to typed results", async () => {
    mockFetch({ status: 400, body: { fieldErrors: { description: "Too short" } } });
    await expect(saveTargetJob("t", INPUT)).resolves.toEqual({
      ok: false,
      reason: "invalid",
      fieldErrors: { description: "Too short" },
    });

    mockFetch({ status: 401 });
    await expect(saveTargetJob("t", INPUT)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });

    mockFetch({ status: 500 });
    await expect(saveTargetJob("t", INPUT)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("treats a network failure as unavailable instead of throwing (Scenario 2)", async () => {
    mockFetch(new TypeError("fetch failed"));
    await expect(saveTargetJob("t", INPUT)).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(loadTargetJob("t")).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(removeTargetJob("t")).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("is unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const fetchMock = mockFetch({ status: 200 });
    await expect(loadTargetJob("t")).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the saved job, or null when there isn't one", async () => {
    mockFetch({ status: 200, body: { targetJob: ROW } });
    await expect(loadTargetJob("t")).resolves.toEqual({ ok: true, targetJob: TARGET_JOB });

    mockFetch({ status: 200, body: { targetJob: null } });
    await expect(loadTargetJob("t")).resolves.toEqual({ ok: true, targetJob: null });
  });

  it("removes with DELETE /me/target-job", async () => {
    const fetchMock = mockFetch({ status: 204 });
    await expect(removeTargetJob("t")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/target-job",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("uses an in-memory store in mock mode without calling the backend", async () => {
    vi.stubEnv("USE_MOCK_DATA", "true");
    resetMockTargetJob();
    const fetchMock = mockFetch({ status: 500 });

    await expect(loadTargetJob("t")).resolves.toEqual({ ok: true, targetJob: null });
    const saved = await saveTargetJob("t", { ...INPUT, company: "" });
    expect(saved).toMatchObject({ ok: true, targetJob: { jobTitle: INPUT.jobTitle, company: null } });
    await expect(loadTargetJob("t")).resolves.toMatchObject({
      ok: true,
      targetJob: { jobTitle: INPUT.jobTitle },
    });
    await expect(removeTargetJob("t")).resolves.toEqual({ ok: true });
    await expect(loadTargetJob("t")).resolves.toEqual({ ok: true, targetJob: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares the mock store between separate copies of the module", async () => {
    // Next bundles pages and route handlers separately, so each gets its own
    // copy of this module; the mock job must still be the same.
    vi.stubEnv("USE_MOCK_DATA", "true");
    resetMockTargetJob();
    await saveTargetJob("t", INPUT);

    vi.resetModules();
    const otherCopy = await import("@/lib/target-job/target-job-api");

    expect(otherCopy.getMockTargetJob()).toMatchObject({ jobTitle: INPUT.jobTitle, company: "Acme" });
    otherCopy.resetMockTargetJob();
    await expect(loadTargetJob("t")).resolves.toEqual({ ok: true, targetJob: null });
  });
});

describe("loadTargetJobDefaults", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubEnv("USE_MOCK_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function mockMe(response: { status: number; body?: unknown } | Error) {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify(response.body ?? {}), { status: response.status });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("uses the target role and company from Complete User Setup", async () => {
    const fetchMock = mockMe({
      status: 200,
      body: { user: {}, profile: { target_role: " Data Analyst ", target_company: "Acme" } },
    });

    await expect(loadTargetJobDefaults("id-token")).resolves.toEqual({
      jobTitle: "Data Analyst",
      company: "Acme",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me",
      expect.objectContaining({ headers: { Authorization: "Bearer id-token" } })
    );
  });

  it("fills just the role when no company was entered", async () => {
    mockMe({ status: 200, body: { profile: { target_role: "Data Analyst", target_company: null } } });
    await expect(loadTargetJobDefaults("t")).resolves.toEqual({ jobTitle: "Data Analyst", company: "" });
  });

  it("returns null when there's nothing to fill or the profile can't load", async () => {
    mockMe({ status: 200, body: { profile: null } });
    await expect(loadTargetJobDefaults("t")).resolves.toBeNull();

    mockMe({ status: 500 });
    await expect(loadTargetJobDefaults("t")).resolves.toBeNull();

    mockMe(new TypeError("fetch failed"));
    await expect(loadTargetJobDefaults("t")).resolves.toBeNull();
  });
});
