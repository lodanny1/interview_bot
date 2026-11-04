import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadInterviewInsights } from "@/lib/insights/insights-api";
import { resetMockTargetJob, saveTargetJob } from "@/lib/target-job/target-job-api";
import backend from "./backend-insights.json";

function mockFetch(response: { status: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("interview insights API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubEnv("USE_MOCK_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads GET /me/interview-insights with the user's token and no caching", async () => {
    const fetchMock = mockFetch({ status: 200, body: backend.ready });

    const result = await loadInterviewInsights("id-token");

    expect(result.ok && result.response.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/interview-insights",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer id-token" },
        cache: "no-store",
      })
    );
  });

  it("passes through partial, no target job and unavailable responses", async () => {
    mockFetch({ status: 200, body: backend.partial });
    expect((await loadInterviewInsights("t")).ok).toBe(true);

    mockFetch({ status: 200, body: backend.noTargetJob });
    expect(await loadInterviewInsights("t")).toEqual({ ok: true, response: { status: "no_target_job" } });

    mockFetch({ status: 200, body: { status: "unavailable", targetJob: { jobTitle: "Nurse", company: null } } });
    expect(await loadInterviewInsights("t")).toEqual({
      ok: true,
      response: { status: "unavailable", targetJob: { jobTitle: "Nurse", company: null } },
    });
  });

  it("maps 401 and 403 to unauthenticated", async () => {
    mockFetch({ status: 401 });
    expect(await loadInterviewInsights("t")).toEqual({ ok: false, reason: "unauthenticated" });

    mockFetch({ status: 403 });
    expect(await loadInterviewInsights("t")).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("maps a database failure, a network failure and a malformed body to unavailable", async () => {
    mockFetch({ status: 503, body: { status: "error", code: "target_job_unavailable" } });
    expect(await loadInterviewInsights("t")).toEqual({ ok: false, reason: "unavailable" });

    mockFetch(new Error("ECONNREFUSED"));
    expect(await loadInterviewInsights("t")).toEqual({ ok: false, reason: "unavailable" });

    mockFetch({ status: 200, body: { status: "ready" } });
    expect(await loadInterviewInsights("t")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const fetchMock = mockFetch({ status: 200, body: backend.ready });

    expect(await loadInterviewInsights("t")).toEqual({ ok: false, reason: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("in mock mode follows the mock target job without calling the backend", async () => {
    vi.stubEnv("USE_MOCK_DATA", "true");
    resetMockTargetJob();
    const fetchMock = mockFetch({ status: 500 });

    expect(await loadInterviewInsights("mock-token")).toEqual({ ok: true, response: { status: "no_target_job" } });

    await saveTargetJob("mock-token", { jobTitle: "Software Engineer", company: "Amazon", description: "d" });
    const covered = await loadInterviewInsights("mock-token");

    expect(covered.ok && covered.response.status === "partial" && covered.response.insights.coverage.company.status).toBe(
      "matched"
    );
    expect(fetchMock).not.toHaveBeenCalled();
    resetMockTargetJob();
  });
});
