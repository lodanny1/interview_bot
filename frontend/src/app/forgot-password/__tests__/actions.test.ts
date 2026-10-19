import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/lib/auth/cognito-password-reset";
import { SIGNUP_VALIDATION_MESSAGES } from "@/lib/auth/signup-validation";
import {
  INITIAL_RESET_FORM_STATE,
  POST_RESET_REDIRECT,
  RESET_ERROR_MESSAGES,
  RESET_NOTICES,
} from "@/lib/auth/password-reset-form-state";
import { resetPasswordAction } from "@/app/forgot-password/actions";

vi.mock("@/lib/auth/cognito-password-reset", () => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
// The real redirect() throws to abort rendering; mirror that.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const EMAIL = "alex@example.com";
const CODE = "123456";
const PASSWORD = "NewPassword1!";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

function run(values: Record<string, string>) {
  return resetPasswordAction(INITIAL_RESET_FORM_STATE, formData(values));
}

describe("resetPasswordAction", () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset();
    vi.mocked(confirmPasswordReset).mockReset();
    vi.mocked(redirect).mockClear();
  });

  describe("request step", () => {
    it("sends a code and moves to the confirm step", async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });

      await expect(run({ intent: "request", email: " Alex@Example.com " })).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        notice: RESET_NOTICES.codeSent,
      });
      expect(requestPasswordReset).toHaveBeenCalledWith(EMAIL);
    });

    it("re-validates the email and never calls Cognito when invalid", async () => {
      await expect(run({ intent: "request", email: "nope" })).resolves.toEqual({
        step: "request",
        fieldErrors: { email: SIGNUP_VALIDATION_MESSAGES.emailInvalid },
      });
      expect(requestPasswordReset).not.toHaveBeenCalled();
    });

    it("shows a retryable error when the service is down", async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue({
        ok: false,
        reason: "service_unavailable",
      });

      await expect(run({ intent: "request", email: EMAIL })).resolves.toEqual({
        step: "request",
        email: EMAIL,
        formError: RESET_ERROR_MESSAGES.request_unavailable,
      });
    });

    it("resends a code while staying on the confirm step", async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });

      await expect(run({ intent: "resend", email: EMAIL })).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        notice: RESET_NOTICES.codeResent,
      });
    });

    it("keeps the confirm step when a resend fails", async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue({
        ok: false,
        reason: "too_many_attempts",
      });

      await expect(run({ intent: "resend", email: EMAIL })).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        formError: RESET_ERROR_MESSAGES.too_many_attempts,
      });
    });
  });

  describe("confirm step", () => {
    const confirm = (overrides: Record<string, string> = {}) =>
      run({ intent: "confirm", email: EMAIL, code: CODE, password: PASSWORD, ...overrides });

    it("resets the password, then redirects to login", async () => {
      vi.mocked(confirmPasswordReset).mockResolvedValue({ ok: true });

      await expect(confirm()).rejects.toThrow("NEXT_REDIRECT");

      expect(confirmPasswordReset).toHaveBeenCalledWith(EMAIL, CODE, PASSWORD);
      expect(redirect).toHaveBeenCalledWith(POST_RESET_REDIRECT);
      expect(POST_RESET_REDIRECT).toBe("/login?reset=success");
    });

    it("rejects a weak password without calling Cognito", async () => {
      await expect(confirm({ password: "weak" })).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        fieldErrors: { password: SIGNUP_VALIDATION_MESSAGES.passwordWeak },
      });
      expect(confirmPasswordReset).not.toHaveBeenCalled();
    });

    it.each(["invalid_code", "expired_code"] as const)(
      "shows %s on the code field and does not redirect",
      async (reason) => {
        vi.mocked(confirmPasswordReset).mockResolvedValue({ ok: false, reason });

        await expect(confirm()).resolves.toEqual({
          step: "confirm",
          email: EMAIL,
          fieldErrors: { code: RESET_ERROR_MESSAGES[reason] },
        });
        expect(redirect).not.toHaveBeenCalled();
      }
    );

    it("shows Cognito's password rejection on the password field", async () => {
      vi.mocked(confirmPasswordReset).mockResolvedValue({
        ok: false,
        reason: "invalid_password",
      });

      await expect(confirm()).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        fieldErrors: { password: RESET_ERROR_MESSAGES.invalid_password },
      });
    });

    it("shows a retryable error when the service is down", async () => {
      vi.mocked(confirmPasswordReset).mockResolvedValue({
        ok: false,
        reason: "service_unavailable",
      });

      await expect(confirm()).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        formError: RESET_ERROR_MESSAGES.confirm_unavailable,
      });
    });

    it("never returns the password to the browser", async () => {
      vi.mocked(confirmPasswordReset).mockResolvedValue({
        ok: false,
        reason: "invalid_password",
      });

      expect(JSON.stringify(await confirm())).not.toContain(PASSWORD);
    });
  });
});
