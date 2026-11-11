// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FEEDBACK_COPY, FeedbackReportPanel } from "@/components/feedback/FeedbackReportPanel";
import { FEEDBACK_MESSAGES } from "@/lib/feedback/feedback-state";

afterEach(cleanup);

const report = {
  overallScore: 74,
  summary: "You gave clear answers with concrete results.",
  categories: [{ key: "relevance", label: "Relevance", score: 80, comment: "On topic." }],
  strengths: [{ point: "Quantified your impact.", questionNumbers: [1] }],
  improvements: [{ point: "Explain your reasoning.", suggestion: "Say why.", questionNumbers: [2] }],
  questionsAnswered: 2,
};

function feedback(status: string, extra: Record<string, unknown> = {}) {
  return { feedback: { sessionId: "session-1", status, reason: null, report: null, ...extra } };
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

// Each call takes the next response from the list.
function stubFetch(...responses: Array<Response | Error>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function methodOf(call: unknown[]) {
  return (call[1] as RequestInit | undefined)?.method ?? "GET";
}

describe("FeedbackReportPanel", () => {
  it("shows a saved report without generating it again", async () => {
    const fetchMock = stubFetch(reply(200, feedback("ready", { report })));

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="COMPLETED" />);

    expect(await screen.findByText(report.summary)).toBeTruthy();
    expect(screen.getByLabelText("Overall score 74 out of 100")).toBeTruthy();
    expect(screen.getByText("Quantified your impact.")).toBeTruthy();
    expect(screen.getByText("Q1")).toBeTruthy();
    expect(screen.getByText("Try: Say why.")).toBeTruthy();
    expect(screen.getByText(/Based on 2 answered questions/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(methodOf(fetchMock.mock.calls[0])).toBe("GET");
  });

  it("generates the report the first time a finished interview is opened", async () => {
    const fetchMock = stubFetch(
      reply(200, feedback("not_generated")),
      reply(200, feedback("ready", { report }))
    );

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="COMPLETED" />);

    expect(await screen.findByText(report.summary)).toBeTruthy();
    expect(fetchMock.mock.calls.map(methodOf)).toEqual(["GET", "POST"]);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      sessionId: "session-1",
    });
  });

  it("waits while another request is generating, then shows the report", async () => {
    stubFetch(reply(202, feedback("generating")), reply(200, feedback("ready", { report })));

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="COMPLETED" pollIntervalMs={5} />);

    expect(await screen.findByText(FEEDBACK_COPY.generating)).toBeTruthy();
    expect(await screen.findByText(report.summary)).toBeTruthy();
  });

  it("explains why there's no report instead of showing a made-up one", async () => {
    stubFetch(reply(200, feedback("unavailable", { reason: "no_answers" })));

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="COMPLETED" />);

    expect(await screen.findByText(FEEDBACK_MESSAGES.no_answers)).toBeTruthy();
    expect(screen.queryByLabelText(/Overall score/)).toBeNull();
  });

  it("lets the user retry a failed report", async () => {
    const fetchMock = stubFetch(
      reply(200, feedback("failed", { reason: "ai_unavailable" })),
      reply(200, feedback("ready", { report }))
    );

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="COMPLETED" />);

    expect(await screen.findByText(FEEDBACK_MESSAGES.failed)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: FEEDBACK_COPY.retry }));

    expect(await screen.findByText(report.summary)).toBeTruthy();
    expect(methodOf(fetchMock.mock.calls[1])).toBe("POST");
  });

  it("shows an error with retry when loading fails, without crashing", async () => {
    stubFetch(new Error("network down"), reply(200, feedback("ready", { report })));

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="COMPLETED" />);

    expect(await screen.findByText(FEEDBACK_MESSAGES.loadError)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: FEEDBACK_COPY.retry }));
    expect(await screen.findByText(report.summary)).toBeTruthy();
  });

  it("doesn't request anything for an active interview", async () => {
    const fetchMock = stubFetch();

    render(<FeedbackReportPanel sessionId="session-1" sessionStatus="ACTIVE" />);

    expect(screen.getByText(FEEDBACK_MESSAGES.notCompleted)).toBeTruthy();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
