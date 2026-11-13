import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateFeedbackReport, loadFeedbackReport } from "@/lib/feedback/feedback-api";
import {
  FEEDBACK_MESSAGES,
  parseFeedbackResponse,
  unavailableMessage,
} from "@/lib/feedback/feedback-state";

const readyFeedback = {
  feedback: {
    sessionId: "session-1",
    status: "ready",
    reason: null,
    generatedAt: "2026-11-11T20:00:00.000Z",
    report: {
      version: 1,
      overallScore: 74,
      summary: "You gave clear answers with concrete results.",
      categories: [
        { key: "relevance", label: "Relevance", score: 80, comment: "On topic." },
        { key: "examples", label: "Specific examples", score: 72, comment: "" },
      ],
      strengths: [{ point: "Quantified your impact.", questionNumbers: [1] }],
      improvements: [
        { point: "Explain your reasoning.", suggestion: "Say why.", questionNumbers: [2] },
      ],
      questionsAnswered: 2,
    },
  },
};

describe("parseFeedbackResponse", () => {
  it("parses a ready report", () => {
    const parsed = parseFeedbackResponse(readyFeedback);

    expect(parsed?.status).toBe("ready");
    expect(parsed?.report?.overallScore).toBe(74);
    expect(parsed?.report?.categories).toHaveLength(2);
    expect(parsed?.report?.improvements[0].suggestion).toBe("Say why.");
  });

  it("rejects a ready status without a valid report instead of inventing one", () => {
    expect(
      parseFeedbackResponse({ feedback: { sessionId: "s", status: "ready", report: null } })
    ).toBeNull();
    expect(
      parseFeedbackResponse({
        feedback: { sessionId: "s", status: "ready", report: { overallScore: 300, summary: "x" } },
      })
    ).toBeNull();
  });

  it("keeps unavailable reasons and drops any report on non-ready statuses", () => {
    const parsed = parseFeedbackResponse({
      feedback: {
        sessionId: "s",
        status: "unavailable",
        reason: "no_answers",
        report: readyFeedback.feedback.report,
      },
    });

    expect(parsed).toMatchObject({ status: "unavailable", reason: "no_answers", report: null });
  });

  it("rejects unknown statuses and junk", () => {
    expect(parseFeedbackResponse({ feedback: { sessionId: "s", status: "done" } })).toBeNull();
    expect(parseFeedbackResponse(null)).toBeNull();
    expect(parseFeedbackResponse("nope")).toBeNull();
  });

  it("drops malformed list items", () => {
    const parsed = parseFeedbackResponse({
      feedback: {
        ...readyFeedback.feedback,
        report: {
          ...readyFeedback.feedback.report,
          strengths: [{ point: "" }, null, { point: "Good", questionNumbers: [1, "x", -2] }],
        },
      },
    });

    expect(parsed?.report?.strengths).toEqual([{ point: "Good", questionNumbers: [1] }]);
  });
});

describe("unavailableMessage", () => {
  it("explains each known reason and falls back for unknown ones", () => {
    expect(unavailableMessage("no_answers")).toBe(FEEDBACK_MESSAGES.no_answers);
    expect(unavailableMessage("not_enough_detail")).toBe(FEEDBACK_MESSAGES.not_enough_detail);
    expect(unavailableMessage("weird")).toBe(FEEDBACK_MESSAGES.unavailable);
  });
});

function mockFetch(response: { status: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("feedback API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("GETs the saved report with the user's token and no caching", async () => {
    const fetchMock = mockFetch({ status: 200, body: readyFeedback });

    const result = await loadFeedbackReport("id-token", "session-1");

    expect(result.ok && result.feedback.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/interviews/session-1/feedback",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer id-token" },
        cache: "no-store",
      })
    );
  });

  it("POSTs to generate and passes a 202 generating response through", async () => {
    const fetchMock = mockFetch({
      status: 202,
      body: { feedback: { sessionId: "session-1", status: "generating" } },
    });

    const result = await generateFeedbackReport("id-token", "session-1");

    expect(result).toMatchObject({ ok: true, status: 202, feedback: { status: "generating" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/interviews/session-1/feedback",
      expect.objectContaining({ method: "POST" })
    );
  });

  it.each([
    [401, "unauthenticated"],
    [403, "unauthenticated"],
    [404, "not-found"],
    [409, "not-completed"],
    [500, "unavailable"],
  ])("maps status %i to %s", async (status, reason) => {
    mockFetch({ status, body: {} });
    expect(await loadFeedbackReport("t", "s")).toEqual({ ok: false, reason });
  });

  it("treats a malformed 200 body or a network error as unavailable", async () => {
    mockFetch({ status: 200, body: { feedback: { status: "ready" } } });
    expect(await loadFeedbackReport("t", "s")).toEqual({ ok: false, reason: "unavailable" });

    mockFetch(new Error("network down"));
    expect(await generateFeedbackReport("t", "s")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("is unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");
    expect(await loadFeedbackReport("t", "s")).toEqual({ ok: false, reason: "unavailable" });
  });
});
