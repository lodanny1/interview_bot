// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { INSIGHTS_COPY, InterviewInsightsPanel } from "@/components/insights/InterviewInsightsPanel";
import { INSIGHTS_API_URL, INSIGHTS_MESSAGES } from "@/lib/insights/insights-state";
import backend from "@/lib/insights/__tests__/backend-insights.json";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

// Each call takes the next response from the list.
function stubFetch(...responses: Array<Response | Error | Promise<Response>>) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("InterviewInsightsPanel", () => {
  it("shows loading, then coverage, notes and sources with review dates", async () => {
    const fetchMock = stubFetch(reply(200, backend.ready));
    render(<InterviewInsightsPanel />);

    expect(screen.getByText(INSIGHTS_COPY.loading)).toBeTruthy();
    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith(INSIGHTS_API_URL, expect.objectContaining({ cache: "no-store" }));
    expect(screen.getByText(INSIGHTS_COPY.intro)).toBeTruthy();
    expect(screen.getByText("Notes for Software engineering roles.")).toBeTruthy();
    expect(screen.getByText("Technology industry (from the company)")).toBeTruthy();
    expect(screen.getByText("Mixed interviews (mixed focus)")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Leadership Principles" })).toBeTruthy();
    expect(screen.getByText(/Customer Obsession/)).toBeTruthy();

    // Each source link names its page, not just the site.
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    expect(new Set(links.map((link) => link.textContent)).size).toBe(links.length);

    const principles = screen.getByRole("link", { name: /Amazon: amazon\.jobs\/en\/principles/ }) as HTMLAnchorElement;
    expect(principles.getAttribute("href")).toBe("https://www.amazon.jobs/en/principles");
    expect(principles.getAttribute("target")).toBe("_blank");
    expect(principles.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getAllByText("Reviewed Nov 1, 2026").length).toBe(backend.ready.insights.sources.length);
  });

  it("explains an uncovered company without promising company notes", async () => {
    stubFetch(reply(200, backend.partial));
    render(<InterviewInsightsPanel />);

    expect(
      await screen.findByText(
        "We don't have verified notes for Riverbend Credit Union yet. Practice questions will use the role and general guidance, and won't state facts about this company."
      )
    ).toBeTruthy();
    expect(screen.getByText("Notes for Data analytics and data science roles.")).toBeTruthy();
    expect(screen.queryByText(/^Company: /)).toBeNull();
  });

  it("does not claim role notes for an uncovered title", async () => {
    const body = structuredClone(backend.partial);
    body.insights.coverage.role = { status: "not_found", name: "Personal Banker", title: null, matchedBy: null, reason: "below_threshold" } as never;
    body.insights.groups = body.insights.groups.filter((group) => group.kind !== "role");
    stubFetch(reply(200, body));
    render(<InterviewInsightsPanel />);

    expect(
      await screen.findByText('No notes for "Personal Banker" yet. Practice questions will use general interview guidance.')
    ).toBeTruthy();
    expect(screen.queryByText(/^Role: /)).toBeNull();
  });

  it("asks for a target job when none is saved", async () => {
    stubFetch(reply(200, backend.noTargetJob));
    render(<InterviewInsightsPanel />);

    expect(await screen.findByText(INSIGHTS_COPY.noTargetJob)).toBeTruthy();
  });

  it("shows unavailable knowledge separately from errors, with a retry", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(
      reply(200, { status: "unavailable", targetJob: { jobTitle: "Data Analyst", company: "Acme" } }),
      reply(200, backend.ready)
    );
    render(<InterviewInsightsPanel />);

    expect(await screen.findByText(INSIGHTS_COPY.unavailable)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: INSIGHTS_COPY.retry }));

    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from a service error or network failure with Try again", async () => {
    const user = userEvent.setup();
    stubFetch(
      reply(503, { status: "error", code: "service_unavailable", error: "x" }),
      new Error("offline"),
      reply(200, backend.partial)
    );
    render(<InterviewInsightsPanel />);

    expect(await screen.findByText(INSIGHTS_MESSAGES.serviceUnavailable)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: INSIGHTS_COPY.retry }));
    await waitFor(() => expect(screen.getByRole("button", { name: INSIGHTS_COPY.retry })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: INSIGHTS_COPY.retry }));

    expect(await screen.findByText(/Riverbend Credit Union/)).toBeTruthy();
    expect(screen.queryByText(INSIGHTS_MESSAGES.serviceUnavailable)).toBeNull();
  });

  it("treats a malformed success body as a service error", async () => {
    stubFetch(reply(200, { status: "ready" }));
    render(<InterviewInsightsPanel />);

    expect(await screen.findByText(INSIGHTS_MESSAGES.serviceUnavailable)).toBeTruthy();
  });

  it("asks the user to sign in again when the session expired", async () => {
    stubFetch(reply(401, { status: "error", code: "unauthenticated", error: "x" }));
    render(<InterviewInsightsPanel />);

    expect(await screen.findByText(INSIGHTS_MESSAGES.unauthenticated)).toBeTruthy();
    expect(screen.getByRole("link", { name: INSIGHTS_COPY.signIn }).getAttribute("href")).toBe("/login");
  });

  it("reloads when refreshKey changes", async () => {
    const fetchMock = stubFetch(reply(200, backend.noTargetJob), reply(200, backend.ready));
    const { rerender } = render(<InterviewInsightsPanel refreshKey={0} />);

    expect(await screen.findByText(INSIGHTS_COPY.noTargetJob)).toBeTruthy();
    rerender(<InterviewInsightsPanel refreshKey={1} />);

    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never lets an older, slower response overwrite a newer one", async () => {
    const slow = deferred();
    const fetchMock = stubFetch(slow.promise, reply(200, backend.partial));
    const { rerender } = render(<InterviewInsightsPanel refreshKey={0} />);

    rerender(<InterviewInsightsPanel refreshKey={1} />);
    expect(await screen.findByText(/Riverbend Credit Union/)).toBeTruthy();

    // The first request finishes last, with different data.
    slow.resolve(reply(200, backend.ready));
    await new Promise((done) => setTimeout(done, 20));

    expect(screen.queryByText("Verified notes for Amazon.")).toBeNull();
    expect(screen.getByText(/Riverbend Credit Union/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The first request was aborted when the key changed.
    const firstSignal = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
  });

  it("keeps showing the last result while an update is loading", async () => {
    const slow = deferred();
    stubFetch(reply(200, backend.partial), slow.promise);
    const { rerender } = render(<InterviewInsightsPanel refreshKey={0} />);

    expect(await screen.findByText(/Riverbend Credit Union/)).toBeTruthy();
    rerender(<InterviewInsightsPanel refreshKey={1} />);

    const panel = screen.getByRole("region", { name: INSIGHTS_COPY.heading });
    expect(within(panel).getByText(INSIGHTS_COPY.updating)).toBeTruthy();
    expect(screen.getByText(/Riverbend Credit Union/)).toBeTruthy();

    slow.resolve(reply(200, backend.ready));
    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
    expect(screen.queryByText(INSIGHTS_COPY.updating)).toBeNull();
  });
});
