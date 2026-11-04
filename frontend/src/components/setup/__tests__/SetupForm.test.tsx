// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupForm } from "@/components/setup/SetupForm";
import { SETUP_VALIDATION_MESSAGES as MSG } from "@/lib/setup/setup-validation";
import {
  EMPTY_SETUP_VALUES,
  SETUP_ERROR_MESSAGES,
  type SetupAction,
  type SetupInitialValues,
} from "@/lib/setup/setup-form-state";

afterEach(cleanup);

function setup(action: SetupAction, initialValues: SetupInitialValues = EMPTY_SETUP_VALUES) {
  const user = userEvent.setup();
  render(<SetupForm action={action} initialValues={initialValues} />);
  const submit = () =>
    screen.getByRole("button", { name: /Finish setup|Saving/ }) as HTMLButtonElement;

  async function fillRequired() {
    await user.type(screen.getByLabelText("Job title"), "Software Engineer");
    await user.click(screen.getByLabelText("Behavioral"));
    await user.click(screen.getByLabelText("Technical"));
  }

  return { user, submit, fillRequired };
}

describe("SetupForm", () => {
  it("shows validation messages and does not submit when required info is missing", async () => {
    const action = vi.fn<SetupAction>();
    const { user, submit } = setup(action);

    await user.click(submit());

    expect(screen.getByText(MSG.targetRoleRequired)).toBeTruthy();
    expect(screen.getByText(MSG.focusAreasRequired)).toBeTruthy();
    expect(screen.getByLabelText("Job title").getAttribute("aria-invalid")).toBe("true");
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the completed form to the action", async () => {
    const action = vi.fn<SetupAction>(async () => ({}));
    const { user, submit, fillRequired } = setup(action);

    await fillRequired();
    await user.type(screen.getByLabelText(/^Company/), "Acme");
    await user.click(submit());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("targetRole")).toBe("Software Engineer");
    expect(formData.has("experienceLevel")).toBe(false);
    expect(formData.getAll("focusAreas")).toEqual(["BEHAVIORAL", "TECHNICAL"]);
    expect(formData.get("targetCompany")).toBe("Acme");
  });

  it("keeps the user's answers and allows a retry after a save failure", async () => {
    const action = vi
      .fn<SetupAction>()
      .mockResolvedValueOnce({ formError: SETUP_ERROR_MESSAGES.unavailable })
      .mockResolvedValueOnce({});
    const { user, submit, fillRequired } = setup(action);

    await fillRequired();
    await user.click(submit());

    expect((await screen.findByRole("alert")).textContent).toContain(
      SETUP_ERROR_MESSAGES.unavailable
    );
    expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(
      "Software Engineer"
    );
    expect(submit().disabled).toBe(false);

    await user.click(submit());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it("offers a Sign In link when the session expired", async () => {
    const action = vi.fn<SetupAction>(async () => ({
      formError: SETUP_ERROR_MESSAGES.unauthenticated,
      signInAgain: true,
    }));
    const { user, submit, fillRequired } = setup(action);

    await fillRequired();
    await user.click(submit());

    const link = await screen.findByRole("link", { name: "Go to Sign In" });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("pre-fills saved setup info for returning users", () => {
    setup(vi.fn<SetupAction>(), {
      targetRole: "Data Analyst",
      focusAreas: ["TECHNICAL"],
      targetCompany: "Acme",
      bio: "Prefers short answers",
      jobDescription: "A saved job description.",
    });

    expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe("Data Analyst");
    expect((screen.getByLabelText("Technical") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Behavioral") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Anything else/) as HTMLTextAreaElement).value).toBe(
      "Prefers short answers"
    );
    expect((screen.getByLabelText(/Job description/) as HTMLTextAreaElement).value).toBe(
      "A saved job description."
    );
  });
});

describe("SetupForm fields", () => {
  it("doesn't ask for an experience level", () => {
    render(<SetupForm action={vi.fn<SetupAction>()} initialValues={EMPTY_SETUP_VALUES} />);

    expect(screen.queryByText("Experience level")).toBeNull();
    expect(screen.queryByLabelText(/Entry level/)).toBeNull();
  });

  it("shows a 10,000-character limit on the extra context box", () => {
    render(<SetupForm action={vi.fn<SetupAction>()} initialValues={EMPTY_SETUP_VALUES} />);

    expect(screen.getByText("0/10,000")).toBeTruthy();
    expect((screen.getByLabelText(/Anything else/) as HTMLTextAreaElement).maxLength).toBe(10000);
  });
});

describe("SetupForm target job section", () => {
  const DESCRIPTION =
    "We are hiring a junior software engineer to build and maintain web features. " +
    "You will work with React and Node.js, write tests, and review code with the team.";

  it("has the same fields as the Target Jobs page", () => {
    render(<SetupForm action={vi.fn<SetupAction>()} initialValues={EMPTY_SETUP_VALUES} />);

    expect(screen.getByRole("group", { name: "Target job" })).toBeTruthy();
    expect(screen.getByLabelText("Job title")).toBeTruthy();
    expect(screen.getByLabelText(/^Company/)).toBeTruthy();
    expect(screen.getByLabelText(/Job description/)).toBeTruthy();
    expect(screen.getByText("0 words · 0/10,000")).toBeTruthy();
  });

  it("sends the job description so it's saved as a target job", async () => {
    const action = vi.fn<SetupAction>(async () => ({}));
    const user = userEvent.setup();
    render(<SetupForm action={action} initialValues={EMPTY_SETUP_VALUES} />);

    await user.type(screen.getByLabelText("Job title"), "Software Engineer");
    await user.click(screen.getByLabelText("Technical"));
    await user.click(screen.getByLabelText(/Job description/));
    await user.paste(DESCRIPTION);
    await user.click(screen.getByRole("button", { name: /Finish setup/ }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("jobDescription")).toBe(DESCRIPTION);
  });

  it("checks the job description with the Target Jobs page's rules", async () => {
    const action = vi.fn<SetupAction>();
    const user = userEvent.setup();
    render(<SetupForm action={action} initialValues={EMPTY_SETUP_VALUES} />);

    await user.type(screen.getByLabelText("Job title"), "Software Engineer");
    await user.click(screen.getByLabelText("Technical"));
    await user.type(screen.getByLabelText(/Job description/), "https://jobs.example.com/123");
    await user.click(screen.getByRole("button", { name: /Finish setup/ }));

    expect(screen.getByText(/That looks like a link/)).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("lets setup finish without a job description", async () => {
    const action = vi.fn<SetupAction>(async () => ({}));
    const user = userEvent.setup();
    render(<SetupForm action={action} initialValues={EMPTY_SETUP_VALUES} />);

    await user.type(screen.getByLabelText("Job title"), "Software Engineer");
    await user.click(screen.getByLabelText("Technical"));
    await user.click(screen.getByRole("button", { name: /Finish setup/ }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("jobDescription")).toBe("");
  });
});
