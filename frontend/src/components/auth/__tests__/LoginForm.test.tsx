// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/LoginForm";
import { LOGIN_VALIDATION_MESSAGES } from "@/lib/auth/login-validation";
import {
  LOGIN_ERROR_MESSAGES,
  type LoginAction,
  type LoginFormState,
} from "@/lib/auth/login-form-state";

afterEach(cleanup);

const EMAIL = "user@example.com";
const PASSWORD = "correct horse battery staple";

function setup(action: LoginAction) {
  const user = userEvent.setup();
  render(<LoginForm action={action} />);
  return {
    user,
    email: screen.getByLabelText("Email") as HTMLInputElement,
    password: screen.getByLabelText("Password") as HTMLInputElement,
    submit: () => screen.getByRole("button") as HTMLButtonElement,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("LoginForm", () => {
  it("renders email, password and Sign In", () => {
    const { email, password, submit } = setup(vi.fn());

    expect(email.type).toBe("email");
    expect(password.type).toBe("password");
    expect(submit().textContent).toBe("Sign In");
    expect(submit().disabled).toBe(false);
  });

  describe("required fields", () => {
    it("shows both messages and does not submit when empty", async () => {
      const action = vi.fn<LoginAction>();
      const { user, email, password, submit } = setup(action);

      await user.click(submit());

      expect(screen.getByText(LOGIN_VALIDATION_MESSAGES.emailRequired)).toBeTruthy();
      expect(screen.getByText(LOGIN_VALIDATION_MESSAGES.passwordRequired)).toBeTruthy();
      expect(email.getAttribute("aria-invalid")).toBe("true");
      expect(password.getAttribute("aria-invalid")).toBe("true");
      expect(action).not.toHaveBeenCalled();
    });

    it("does not submit when only the password is missing, and keeps the email", async () => {
      const action = vi.fn<LoginAction>();
      const { user, email, submit } = setup(action);

      await user.type(email, EMAIL);
      await user.click(submit());

      expect(screen.getByText(LOGIN_VALIDATION_MESSAGES.passwordRequired)).toBeTruthy();
      expect(screen.queryByText(LOGIN_VALIDATION_MESSAGES.emailRequired)).toBeNull();
      expect(email.value).toBe(EMAIL);
      expect(action).not.toHaveBeenCalled();
    });

    it("clears client errors and submits once the fields are filled", async () => {
      const action = vi.fn<LoginAction>().mockResolvedValue({});
      const { user, email, password, submit } = setup(action);

      await user.click(submit());
      await user.type(email, EMAIL);
      await user.type(password, PASSWORD);
      await user.click(submit());

      await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
      const formData = action.mock.calls[0][1];
      expect(formData.get("email")).toBe(EMAIL);
      expect(formData.get("password")).toBe(PASSWORD);
      expect(screen.queryByText(LOGIN_VALIDATION_MESSAGES.emailRequired)).toBeNull();
      expect(screen.queryByText(LOGIN_VALIDATION_MESSAGES.passwordRequired)).toBeNull();
    });

    it("shows field errors returned by the server", async () => {
      const action = vi.fn<LoginAction>().mockResolvedValue({
        fieldErrors: { email: LOGIN_VALIDATION_MESSAGES.emailRequired },
      });
      const { user, email, password, submit } = setup(action);

      await user.type(email, EMAIL);
      await user.type(password, PASSWORD);
      await user.click(submit());

      expect(
        await screen.findByText(LOGIN_VALIDATION_MESSAGES.emailRequired)
      ).toBeTruthy();
    });
  });

  describe("invalid credentials", () => {
    it("shows the error, keeps the email and clears the password", async () => {
      const action = vi
        .fn<LoginAction>()
        .mockResolvedValue({ formError: LOGIN_ERROR_MESSAGES.invalid_credentials });
      const { user, email, password, submit } = setup(action);

      await user.type(email, EMAIL);
      await user.type(password, PASSWORD);
      await user.click(submit());

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Incorrect email or password.");
      expect(email.value).toBe(EMAIL);
      expect(password.value).toBe("");
      expect(submit().disabled).toBe(false);
    });
  });

  describe("service failure", () => {
    it("shows the error and lets the user retry", async () => {
      const action = vi
        .fn<LoginAction>()
        .mockResolvedValue({ formError: LOGIN_ERROR_MESSAGES.service_unavailable });
      const { user, email, password, submit } = setup(action);

      await user.type(email, EMAIL);
      await user.type(password, PASSWORD);
      await user.click(submit());

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(
        "We couldn't complete sign in right now. Please try again."
      );
      expect(email.value).toBe(EMAIL);
      expect(password.value).toBe("");
      expect(submit().disabled).toBe(false);

      await user.type(password, PASSWORD);
      await user.click(submit());

      await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    });
  });

  describe("pending state", () => {
    it("disables Sign In while pending and re-enables it after a failure", async () => {
      const pendingResult = deferred<LoginFormState>();
      const action = vi.fn<LoginAction>().mockReturnValue(pendingResult.promise);
      const { user, email, password, submit } = setup(action);

      await user.type(email, EMAIL);
      await user.type(password, PASSWORD);
      await user.click(submit());

      await waitFor(() => expect(submit().disabled).toBe(true));
      expect(submit().textContent).toBe("Signing in…");

      // A second click while pending must not submit again.
      await user.click(submit());
      expect(action).toHaveBeenCalledTimes(1);

      pendingResult.resolve({ formError: LOGIN_ERROR_MESSAGES.service_unavailable });

      await waitFor(() => expect(submit().disabled).toBe(false));
      expect(submit().textContent).toBe("Sign In");
    });

    it("hides a previous error while a new attempt is pending", async () => {
      const second = deferred<LoginFormState>();
      const action = vi
        .fn<LoginAction>()
        .mockResolvedValueOnce({ formError: LOGIN_ERROR_MESSAGES.invalid_credentials })
        .mockReturnValueOnce(second.promise);
      const { user, email, password, submit } = setup(action);

      await user.type(email, EMAIL);
      await user.type(password, PASSWORD);
      await user.click(submit());
      await screen.findByRole("alert");

      await user.type(password, PASSWORD);
      await user.click(submit());

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      second.resolve({});
    });
  });
});
