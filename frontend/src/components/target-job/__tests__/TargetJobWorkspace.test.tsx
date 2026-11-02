// @vitest-environment jsdom
// The target job form and the interview insights panel together (Issues #09
// and #16): insights reload after a save or removal, and an insights failure
// never affects the form.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TargetJobWorkspace } from "@/components/target-job/TargetJobWorkspace";
import { INSIGHTS_COPY } from "@/components/insights/InterviewInsightsPanel";
import { INSIGHTS_MESSAGES } from "@/lib/insights/insights-state";
import {
  TARGET_JOB_ERROR_MESSAGES,
  TARGET_JOB_NOTICES,
  type TargetJob,
  type TargetJobAction,
} from "@/lib/target-job/target-job-form-state";
import backend from "@/lib/insights/__tests__/backend-insights.json";

afterEach(cleanup);

const DESCRIPTION =
  "We are hiring a software development engineer intern to build and test features. " +
  "You will write Java code, review code with your mentor and debug issues with the team.";

const SAVED: TargetJob = {
  jobTitle: "Software Development Engineer Intern",
  company: "Amazon",
  description: DESCRIPTION,
  updatedAt: "2026-11-01T10:00:00.000Z",
};

function stubInsights(...bodies: Array<{ status: number; body: unknown }>) {
  const fetchMock = vi.fn(async () => {
    const next = bodies.shift();
    if (!next) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(next.body), { status: next.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderWorkspace({
  saveAction = vi.fn<TargetJobAction>(async () => ({})),
  removeAction = vi.fn<TargetJobAction>(async () => ({})),
  initialTargetJob = null as TargetJob | null,
} = {}) {
  const user = userEvent.setup();
  render(
    <TargetJobWorkspace saveAction={saveAction} removeAction={removeAction} initialTargetJob={initialTargetJob} />
  );

  async function fillAndSave() {
    await user.type(screen.getByLabelText("Job title"), SAVED.jobTitle);
    await user.type(screen.getByLabelText(/Company/), "Amazon");
    await user.click(screen.getByLabelText("Job description"));
    await user.paste(DESCRIPTION);
    await user.click(screen.getByRole("button", { name: /Save job description|Saving/ }));
  }

  return { user, fillAndSave };
}

describe("TargetJobWorkspace", () => {
  it("loads insights for a returning user's saved job", async () => {
    const fetchMock = stubInsights({ status: 200, body: backend.ready });
    renderWorkspace({ initialTargetJob: SAVED });

    expect(screen.getByRole("heading", { name: SAVED.jobTitle })).toBeTruthy();
    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reloads insights after a successful save", async () => {
    const fetchMock = stubInsights(
      { status: 200, body: backend.noTargetJob },
      { status: 200, body: backend.ready }
    );
    const saveAction = vi.fn<TargetJobAction>(async () => ({ targetJob: SAVED, notice: TARGET_JOB_NOTICES.saved }));
    const { fillAndSave } = renderWorkspace({ saveAction });

    expect(await screen.findByText(INSIGHTS_COPY.noTargetJob)).toBeTruthy();
    await fillAndSave();

    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reload insights when saving fails, and keeps the typed text", async () => {
    const fetchMock = stubInsights({ status: 200, body: backend.noTargetJob });
    const saveAction = vi.fn<TargetJobAction>(async () => ({ formError: TARGET_JOB_ERROR_MESSAGES.saveUnavailable }));
    const { fillAndSave } = renderWorkspace({ saveAction });

    expect(await screen.findByText(INSIGHTS_COPY.noTargetJob)).toBeTruthy();
    await fillAndSave();

    expect(await screen.findByText(TARGET_JOB_ERROR_MESSAGES.saveUnavailable)).toBeTruthy();
    expect((screen.getByLabelText("Job description") as HTMLTextAreaElement).value).toBe(DESCRIPTION);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reloads insights after the job is removed", async () => {
    const fetchMock = stubInsights({ status: 200, body: backend.ready }, { status: 200, body: backend.noTargetJob });
    const removeAction = vi.fn<TargetJobAction>(async () => ({ targetJob: null, notice: TARGET_JOB_NOTICES.removed }));
    const { user } = renderWorkspace({ initialTargetJob: SAVED, removeAction });

    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));

    expect(await screen.findByText(INSIGHTS_COPY.noTargetJob)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the form working when insights can't load", async () => {
    stubInsights(
      { status: 503, body: { status: "error", code: "service_unavailable", error: "x" } },
      { status: 200, body: backend.ready }
    );
    const saveAction = vi.fn<TargetJobAction>(async () => ({ targetJob: SAVED, notice: TARGET_JOB_NOTICES.saved }));
    const { fillAndSave } = renderWorkspace({ saveAction });

    expect(await screen.findByText(INSIGHTS_MESSAGES.serviceUnavailable)).toBeTruthy();
    await fillAndSave();

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(TARGET_JOB_NOTICES.saved)).toBeTruthy();
    expect(await screen.findByText("Verified notes for Amazon.")).toBeTruthy();
  });
});
