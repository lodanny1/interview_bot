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
    await user.type(screen.getByLabelText("Target role"), "Software Engineer");
    await user.click(screen.getByLabelText(/Entry level/));
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
    expect(screen.getByText(MSG.experienceLevelRequired)).toBeTruthy();
    expect(screen.getByText(MSG.focusAreasRequired)).toBeTruthy();
    expect(screen.getByLabelText("Target role").getAttribute("aria-invalid")).toBe("true");
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the completed form to the action", async () => {
    const action = vi.fn<SetupAction>(async () => ({}));
    const { user, submit, fillRequired } = setup(action);

    await fillRequired();
    await user.type(screen.getByLabelText(/Target company/), "Acme");
    await user.click(submit());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("targetRole")).toBe("Software Engineer");
    expect(formData.get("experienceLevel")).toBe("ENTRY");
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
    expect((screen.getByLabelText("Target role") as HTMLInputElement).value).toBe(
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
      experienceLevel: "MID",
      focusAreas: ["TECHNICAL"],
      targetCompany: "Acme",
      bio: "Prefers short answers",
    });

    expect((screen.getByLabelText("Target role") as HTMLInputElement).value).toBe("Data Analyst");
    expect((screen.getByLabelText(/Mid level/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Technical") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Behavioral") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Anything else/) as HTMLTextAreaElement).value).toBe(
      "Prefers short answers"
    );
  });
});
