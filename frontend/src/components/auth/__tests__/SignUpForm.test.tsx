// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SIGNUP_VALIDATION_MESSAGES as MSG } from "@/lib/auth/signup-validation";
import {
  SIGNUP_ERROR_MESSAGES,
  SIGNUP_NOTICES,
  type SignUpAction,
  type SignUpFormState,
} from "@/lib/auth/signup-form-state";

afterEach(cleanup);

const NAME = "Alex Rivera";
const EMAIL = "alex@example.com";
const PASSWORD = "Interview1!";
const ROLE = "Software Engineer";

function setup(action: SignUpAction) {
  const user = userEvent.setup();
  render(<SignUpForm action={action} />);
  const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
  const createButton = () =>
    screen.getByRole("button", { name: /Create Account|Creating account/ }) as HTMLButtonElement;
  const terms = () => screen.getByRole("checkbox") as HTMLInputElement;

  async function fillDetails(values: Partial<Record<string, string | boolean>> = {}) {
    const v = { name: NAME, email: EMAIL, password: PASSWORD, role: ROLE, terms: true, ...values };
    if (v.name) await user.type(field("Full name"), String(v.name));
    if (v.email) await user.type(field("Email"), String(v.email));
    if (v.password) await user.type(field("Password"), String(v.password));
    if (v.role) await user.type(field(/Target role/), String(v.role));
    if (v.terms) await user.click(terms());
  }

  return { user, field, createButton, terms, fillDetails };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const confirmState: SignUpFormState = {
  step: "confirm",
  email: EMAIL,
  notice: SIGNUP_NOTICES.codeSent,
};

describe("SignUpForm", () => {
  it("renders the design's fields, buttons and links", () => {
    const { field, createButton, terms } = setup(vi.fn());

    expect(screen.getByRole("heading", { name: "Create your free account" })).toBeTruthy();
    expect(field("Full name").type).toBe("text");
    expect(field("Email").type).toBe("email");
    expect(field("Password").type).toBe("password");
    expect(field(/Target role/).required).toBe(false);
    expect(terms().checked).toBe(false);
    expect(screen.queryByLabelText(/Confirm password/)).toBeNull();
    expect(createButton().disabled).toBe(false);
    expect(screen.getByRole("button", { name: /Google/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("link", { name: /Sign in here/ }).getAttribute("href")).toBe("/login");
  });

  it("Email button moves focus to the form", async () => {
    const { user, field } = setup(vi.fn());
    await user.click(screen.getByRole("button", { name: "Email" }));
    expect(document.activeElement).toBe(field("Full name"));
  });

  it("shows and hides the password with the eye button", async () => {
    const { user, field } = setup(vi.fn());
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field("Password").type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field("Password").type).toBe("password");
  });

  it("updates the strength label and lists what is still missing", async () => {
    const { user, field } = setup(vi.fn());

    await user.type(field("Password"), "abc");
    expect(screen.getByText("Weak")).toBeTruthy();
    expect(screen.getByText(/Still needs:/).textContent).toContain("an uppercase letter");

    await user.clear(field("Password"));
    await user.type(field("Password"), PASSWORD);
    expect(screen.getByText("Strong")).toBeTruthy();
    expect(screen.queryByText(/Still needs:/)).toBeNull();
  });

  // Scenario 2
  it("shows every required-field message and does not submit when empty", async () => {
    const action = vi.fn<SignUpAction>();
    const { user, field, terms, createButton } = setup(action);

    await user.click(createButton());

    expect(screen.getByText(MSG.nameRequired)).toBeTruthy();
    expect(screen.getByText(MSG.emailRequired)).toBeTruthy();
    expect(screen.getByText(MSG.passwordRequired)).toBeTruthy();
    expect(screen.getByText(MSG.termsRequired)).toBeTruthy();
    expect(field("Email").getAttribute("aria-invalid")).toBe("true");
    expect(terms().getAttribute("aria-invalid")).toBe("true");
    expect(action).not.toHaveBeenCalled();
  });

  // Scenario 4
  it("blocks a badly formatted email and a weak password", async () => {
    const action = vi.fn<SignUpAction>();
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails({ email: "alex@", password: "short" });
    await user.click(createButton());

    expect(screen.getByText(MSG.emailInvalid)).toBeTruthy();
    expect(screen.getByText(MSG.passwordWeak)).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("requires the terms checkbox", async () => {
    const action = vi.fn<SignUpAction>();
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails({ terms: false });
    await user.click(createButton());

    expect(screen.getByText(MSG.termsRequired)).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  // Scenario 1
  it("submits valid details, then shows the code step", async () => {
    const action = vi.fn<SignUpAction>().mockResolvedValue(confirmState);
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const sent = action.mock.calls[0][1];
    expect(sent.get("intent")).toBe("create");
    expect(sent.get("name")).toBe(NAME);
    expect(sent.get("email")).toBe(EMAIL);
    expect(sent.get("password")).toBe(PASSWORD);
    expect(sent.get("targetRole")).toBe(ROLE);
    expect(sent.get("agreeTerms")).toBe("on");

    expect(await screen.findByLabelText("Verification code")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(SIGNUP_NOTICES.codeSent);
    expect(screen.getByText(EMAIL)).toBeTruthy();
  });

  it("sends the code with the email and password to finish sign-up", async () => {
    const action = vi
      .fn<SignUpAction>()
      .mockResolvedValueOnce(confirmState)
      .mockResolvedValueOnce({ ...confirmState, notice: undefined });
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());
    const code = (await screen.findByLabelText("Verification code")) as HTMLInputElement;

    await user.type(code, "12ab3456");
    expect(code.value).toBe("123456");
    await user.click(screen.getByRole("button", { name: /Verify and continue/ }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    const sent = action.mock.calls[1][1];
    expect(sent.get("intent")).toBe("confirm");
    expect(sent.get("email")).toBe(EMAIL);
    expect(sent.get("password")).toBe(PASSWORD);
    expect(sent.get("code")).toBe("123456");
  });

  it("checks the code length before sending", async () => {
    const action = vi.fn<SignUpAction>().mockResolvedValueOnce(confirmState);
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());
    await user.type(await screen.findByLabelText("Verification code"), "123");
    await user.click(screen.getByRole("button", { name: /Verify and continue/ }));

    expect(screen.getByText(MSG.codeInvalid)).toBeTruthy();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("resends the code", async () => {
    const action = vi
      .fn<SignUpAction>()
      .mockResolvedValueOnce(confirmState)
      .mockResolvedValueOnce({ ...confirmState, notice: SIGNUP_NOTICES.codeResent });
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());
    await screen.findByLabelText("Verification code");
    await user.click(screen.getByRole("button", { name: "Resend code" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(SIGNUP_NOTICES.codeResent)
    );
    expect(action.mock.calls[1][1].get("intent")).toBe("resend");
  });

  it("lets the user go back and change their email", async () => {
    const action = vi.fn<SignUpAction>().mockResolvedValueOnce(confirmState);
    const { user, field, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());
    await screen.findByLabelText("Verification code");
    await user.click(screen.getByRole("button", { name: "Use a different email" }));

    expect(field("Email").value).toBe(EMAIL);
    expect(createButton()).toBeTruthy();
  });

  // Scenario 3
  it("shows the duplicate email error from the server and keeps the details", async () => {
    const action = vi.fn<SignUpAction>().mockResolvedValue({
      step: "details",
      fieldErrors: { email: SIGNUP_ERROR_MESSAGES.email_taken },
    });
    const { user, field, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());

    expect(await screen.findByText(SIGNUP_ERROR_MESSAGES.email_taken)).toBeTruthy();
    expect(field("Email").value).toBe(EMAIL);
    expect(field("Full name").value).toBe(NAME);
  });

  // Scenario 5
  it("shows a service error and lets the user retry", async () => {
    const action = vi.fn<SignUpAction>().mockResolvedValue({
      step: "details",
      formError: SIGNUP_ERROR_MESSAGES.service_unavailable,
    });
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(SIGNUP_ERROR_MESSAGES.service_unavailable);
    expect(createButton().disabled).toBe(false);

    await user.click(createButton());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it("links to Sign In when the account exists but auto sign-in failed", async () => {
    const action = vi.fn<SignUpAction>().mockResolvedValue({
      step: "confirm",
      email: EMAIL,
      formError: SIGNUP_ERROR_MESSAGES.sign_in_failed,
      signInInstead: true,
    });
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());

    const link = await screen.findByRole("link", { name: "Go to Sign In" });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("disables Create Account while pending and ignores double clicks", async () => {
    const pending = deferred<SignUpFormState>();
    const action = vi.fn<SignUpAction>().mockReturnValue(pending.promise);
    const { user, createButton, fillDetails } = setup(action);

    await fillDetails();
    await user.click(createButton());

    await waitFor(() => expect(createButton().disabled).toBe(true));
    expect(createButton().textContent).toBe("Creating account…");
    await user.click(createButton());
    expect(action).toHaveBeenCalledTimes(1);

    pending.resolve({ step: "details", formError: SIGNUP_ERROR_MESSAGES.service_unavailable });
    await waitFor(() => expect(createButton().disabled).toBe(false));
  });
});
