import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInterviewSession, startInterviewSession } from "@/lib/interview/interview-api";
import type { StartInterviewInput } from "@/types/interview";

const INPUT: StartInterviewInput = {
  goal: "general",
  title: "Mock round",
  focusArea: "behavioral",
  mode: "text",
};

const SESSION_BODY = {
  id: "abc123",
  title: "Mock round",
  mode: "text",
  focusArea: "technical",
  industry: "tech",
  roleLevel: "senior",
  totalQuestions: 5,
  estimatedMinutesRemaining: 15,
  messages: [
    {
      id: "m1",
      role: "interviewer",
      content: "Tell me about yourself.",
      timestamp: "2026-10-30T21:00:00.000Z",
    },
  ],
};

function mockFetch(response: { status: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("interview API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubEnv("USE_MOCK_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("startInterviewSession", () => {
    it("POSTs the config to /interviews with the user's token and returns the session (Scenario 1)", async () => {
      const fetchMock = mockFetch({ status: 201, body: { session: SESSION_BODY } });

      const result = await startInterviewSession("id-token", INPUT);

      expect(result).toEqual({
        ok: true,
        session: {
          id: "abc123",
          title: "Mock round",
          mode: "text",
          focusArea: "technical",
          industry: "tech",
          roleLevel: "senior",
          totalQuestions: 5,
          estimatedMinutesRemaining: 15,
          messages: [
            {
              id: "m1",
              role: "interviewer",
              content: "Tell me about yourself.",
              timestamp: new Date("2026-10-30T21:00:00.000Z"),
            },
          ],
        },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://backend.test/interviews",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer id-token" }),
          body: JSON.stringify(INPUT),
        })
      );
    });

    it("also accepts the session object without a wrapper", async () => {
      mockFetch({ status: 200, body: SESSION_BODY });
      const result = await startInterviewSession("t", INPUT);
      expect(result.ok && result.session.id).toBe("abc123");
    });

    it("leaves out optional header fields the backend doesn't send", async () => {
      mockFetch({ status: 200, body: { id: "x", mode: "text", focusArea: "mixed" } });
      const result = await startInterviewSession("t", INPUT);
      expect(result.ok && result.session).toEqual({
        id: "x",
        title: "Interview",
        mode: "text",
        focusArea: "mixed",
        messages: [],
      });
    });

    it("maps backend responses to typed results (Scenario 2)", async () => {
      mockFetch({ status: 400, body: { fieldErrors: { title: "Required" } } });
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "invalid",
        fieldErrors: { title: "Required" },
      });

      mockFetch({ status: 401 });
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "unauthenticated",
      });

      mockFetch({ status: 500 });
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    });

    it("treats a network failure as unavailable instead of throwing (Scenario 2)", async () => {
      mockFetch(new TypeError("fetch failed"));
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    });

    it("treats a 200 with a malformed body as unavailable", async () => {
      mockFetch({ status: 200, body: { nope: true } });
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });

      mockFetch({ status: 200, body: { id: "x", mode: "hologram" } });
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    });

    it("is unavailable when BACKEND_URL is missing", async () => {
      vi.stubEnv("BACKEND_URL", "");
      const fetchMock = mockFetch({ status: 200 });
      await expect(startInterviewSession("t", INPUT)).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns a mock session without calling the backend in mock mode", async () => {
      vi.stubEnv("USE_MOCK_DATA", "true");
      const fetchMock = mockFetch({ status: 500 });

      const result = await startInterviewSession("t", INPUT);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.session.title).toBe("Mock round");
        expect(result.session.mode).toBe("text");
        expect(result.session.focusArea).toBe("behavioral");
        expect(result.session.messages[0].role).toBe("interviewer");
      }
    });
  });

  describe("loadInterviewSession", () => {
    it("GETs /interviews/:id so the session survives a refresh (Scenario 3)", async () => {
      const fetchMock = mockFetch({ status: 200, body: { session: SESSION_BODY } });

      const result = await loadInterviewSession("id-token", "abc 123");

      expect(result.ok && result.session.id).toBe("abc123");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://backend.test/interviews/abc%20123",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer id-token" }),
        })
      );
    });

    it("maps 401, 404 and 500 to typed failures", async () => {
      mockFetch({ status: 401 });
      await expect(loadInterviewSession("t", "x")).resolves.toEqual({
        ok: false,
        reason: "unauthenticated",
      });

      mockFetch({ status: 404 });
      await expect(loadInterviewSession("t", "x")).resolves.toEqual({
        ok: false,
        reason: "not-found",
      });

      mockFetch({ status: 500 });
      await expect(loadInterviewSession("t", "x")).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    });

    it("treats a network failure as unavailable", async () => {
      mockFetch(new TypeError("fetch failed"));
      await expect(loadInterviewSession("t", "x")).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    });

    it("loads a session created in mock mode", async () => {
      vi.stubEnv("USE_MOCK_DATA", "true");
      const started = await startInterviewSession("t", INPUT);
      if (!started.ok) throw new Error("expected mock start to succeed");

      const loaded = await loadInterviewSession("t", started.session.id);
      expect(loaded).toEqual({ ok: true, session: started.session });

      await expect(loadInterviewSession("t", "not-a-mock-id")).resolves.toEqual({
        ok: false,
        reason: "not-found",
      });
    });
  });
});
