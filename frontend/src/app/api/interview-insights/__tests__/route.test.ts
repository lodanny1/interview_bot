import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadInterviewInsights } from "@/lib/insights/insights-api";
import { insightsSessionToken } from "@/lib/insights/insights-session";
import { INSIGHTS_MESSAGES } from "@/lib/insights/insights-state";
import { GET } from "@/app/api/interview-insights/route";

vi.mock("@/lib/insights/insights-session", () => ({ insightsSessionToken: vi.fn() }));
vi.mock("@/lib/insights/insights-api", () => ({ loadInterviewInsights: vi.fn() }));

describe("GET /api/interview-insights", () => {
  beforeEach(() => {
    vi.mocked(insightsSessionToken).mockResolvedValue("id-token");
  });

  it("returns 401 without a session and doesn't call the backend", async () => {
    vi.mocked(insightsSessionToken).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      status: "error",
      code: "unauthenticated",
      error: INSIGHTS_MESSAGES.unauthenticated,
    });
    expect(loadInterviewInsights).not.toHaveBeenCalled();
  });

  it("returns the insights for the session's user, privately and uncached", async () => {
    vi.mocked(loadInterviewInsights).mockResolvedValue({ ok: true, response: { status: "no_target_job" } });

    const response = await GET();

    expect(loadInterviewInsights).toHaveBeenCalledWith("id-token");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ status: "no_target_job" });
  });

  it("returns 401 when the backend rejects the session", async () => {
    vi.mocked(loadInterviewInsights).mockResolvedValue({ ok: false, reason: "unauthenticated" });

    expect((await GET()).status).toBe(401);
  });

  it("returns 503 with a retryable error when the backend or database is unavailable", async () => {
    vi.mocked(loadInterviewInsights).mockResolvedValue({ ok: false, reason: "unavailable" });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      status: "error",
      code: "service_unavailable",
      error: INSIGHTS_MESSAGES.serviceUnavailable,
    });
  });
});
