// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TargetJobForm } from "@/components/target-job/TargetJobForm";
import { TARGET_JOB_VALIDATION_MESSAGES as MSG } from "@/lib/target-job/target-job-validation";
import {
  TARGET_JOB_ERROR_MESSAGES,
  TARGET_JOB_NOTICES,
  type TargetJob,
  type TargetJobAction,
} from "@/lib/target-job/target-job-form-state";

afterEach(cleanup);

const DESCRIPTION =
  "We are hiring a junior software engineer to build and maintain web features. " +
  "You will work with React and Node.js, write tests, and review code with the team.";

const SAVED: TargetJob = {
  jobTitle: "Junior Software Engineer",
  company: "Acme",
  description: DESCRIPTION,
  updatedAt: "2026-10-26T12:00:00.000Z",
};

function setup({
  saveAction = vi.fn<TargetJobAction>(async () => ({})),
  removeAction = vi.fn<TargetJobAction>(async () => ({})),
  initialTargetJob = null as TargetJob | null,
  loadError = undefined as string | undefined,
} = {}) {
  const user = userEvent.setup();
  render(
    <TargetJobForm
      saveAction={saveAction}
      removeAction={removeAction}
      initialTargetJob={initialTargetJob}
      loadError={loadError}
    />
  );
  const field = (label: string | RegExp) =>
    screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
  const saveButton = () =>
    screen.getByRole("button", { name: /Save job description|Saving/ }) as HTMLButtonElement;

  async function fill(description = DESCRIPTION) {
    await user.type(field("Job title"), SAVED.jobTitle);
    await user.type(field(/Company/), "Acme");
    await user.click(field("Job description"));
    await user.paste(description);
  }

  return { user, field, saveButton, fill, saveAction, removeAction };
}

describe("TargetJobForm", () => {
  it("shows validation messages and does not save when information is missing", async () => {
    const { user, saveButton, saveAction, field } = setup();

    await user.click(saveButton());

    expect(screen.getByText(MSG.jobTitleRequired)).toBeTruthy();
    expect(screen.getByText(MSG.descriptionRequired)).toBeTruthy();
    expect(field("Job description").getAttribute("aria-invalid")).toBe("true");
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("explains how to fix a pasted link (Scenario 3)", async () => {
    const { user, fill, saveButton, saveAction } = setup();

    await fill("https://careers.example.com/jobs/123");
    await user.click(saveButton());

    expect(screen.getByText(MSG.descriptionIsLink)).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("saves, then shows the saved job in place of the form (Scenario 1)", async () => {
    const saveAction = vi.fn<TargetJobAction>(async () => ({
      targetJob: SAVED,
      notice: TARGET_JOB_NOTICES.saved,
    }));
    const { user, fill, saveButton } = setup({ saveAction });

    await fill();
    await user.click(saveButton());

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    const formData = saveAction.mock.calls[0][1];
    expect(formData.get("jobTitle")).toBe(SAVED.jobTitle);
    expect(formData.get("company")).toBe("Acme");
    expect(formData.get("description")).toBe(DESCRIPTION);

    expect(await screen.findByText(TARGET_JOB_NOTICES.saved)).toBeTruthy();
    expect(screen.getByRole("heading", { name: SAVED.jobTitle })).toBeTruthy();
    expect(screen.queryByLabelText("Job description")).toBeNull();
  });

  it("keeps the text and allows a retry when saving fails (Scenario 2)", async () => {
    const saveAction = vi
      .fn<TargetJobAction>()
      .mockResolvedValueOnce({ formError: TARGET_JOB_ERROR_MESSAGES.saveUnavailable })
      .mockResolvedValueOnce({ targetJob: SAVED, notice: TARGET_JOB_NOTICES.saved });
    const { user, fill, saveButton, field } = setup({ saveAction });

    await fill();
    await user.click(saveButton());

    expect((await screen.findByRole("alert")).textContent).toContain(
      TARGET_JOB_ERROR_MESSAGES.saveUnavailable
    );
    expect(field("Job description").value).toBe(DESCRIPTION);
    expect(saveButton().disabled).toBe(false);

    await user.click(saveButton());
    expect(await screen.findByText(TARGET_JOB_NOTICES.saved)).toBeTruthy();
  });

  it("shows a saved job, and lets the user edit it", async () => {
    const { user } = setup({ initialTargetJob: SAVED });

    expect(screen.getByRole("heading", { name: SAVED.jobTitle })).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(SAVED.jobTitle);
    expect((screen.getByLabelText("Job description") as HTMLTextAreaElement).value).toBe(
      DESCRIPTION
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Job description")).toBeNull();
  });

  it("asks for confirmation, then removes the saved job", async () => {
    const removeAction = vi.fn<TargetJobAction>(async () => ({
      targetJob: null,
      notice: TARGET_JOB_NOTICES.removed,
    }));
    const { user } = setup({ initialTargetJob: SAVED, removeAction });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));

    expect(await screen.findByText(TARGET_JOB_NOTICES.removed)).toBeTruthy();
    expect(removeAction).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe("");
  });

  it("still shows the form when the saved job couldn't be loaded", () => {
    setup({ loadError: TARGET_JOB_ERROR_MESSAGES.loadUnavailable });

    expect(screen.getByRole("status").textContent).toContain(
      TARGET_JOB_ERROR_MESSAGES.loadUnavailable
    );
    expect(screen.getByLabelText("Job description")).toBeTruthy();
  });

  it("offers a Sign In link when the session expired", async () => {
    const saveAction = vi.fn<TargetJobAction>(async () => ({
      formError: TARGET_JOB_ERROR_MESSAGES.unauthenticated,
      signInAgain: true,
    }));
    const { user, fill, saveButton } = setup({ saveAction });

    await fill();
    await user.click(saveButton());

    const link = await screen.findByRole("link", { name: "Go to Sign In" });
    expect(link.getAttribute("href")).toBe("/login");
  });
});
