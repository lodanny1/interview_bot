import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/cognito";
import {
  confirmSignUp,
  resendConfirmationCode,
  signUp,
} from "@/lib/auth/cognito-signup";
import { createSession } from "@/lib/auth/session-cookie";
import { SIGNUP_VALIDATION_MESSAGES } from "@/lib/auth/signup-validation";
import {
  INITIAL_SIGNUP_FORM_STATE,
  POST_SIGNUP_REDIRECT,
  SIGNUP_ERROR_MESSAGES,
  SIGNUP_NOTICES,
} from "@/lib/auth/signup-form-state";
import { signUpAction } from "@/app/signup/actions";

vi.mock("@/lib/auth/cognito", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth/cognito-signup", () => ({
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendConfirmationCode: vi.fn(),
}));
vi.mock("@/lib/auth/session-cookie", () => ({ createSession: vi.fn() }));
// The real redirect() throws to abort rendering; mirror that.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const NAME = "Alex Rivera";
const EMAIL = "alex@example.com";
const PASSWORD = "Interview1!";
const TOKENS = { idToken: "id-token", expiresInSeconds: 3600 };

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const createForm = (overrides: Record<string, string> = {}) =>
  formData({
    intent: "create",
    name: NAME,
    email: EMAIL,
    password: PASSWORD,
    targetRole: "Software Engineer",
    agreeTerms: "on",
    ...overrides,
  });

const confirmForm = (code = "123456") =>
  formData({ intent: "confirm", email: EMAIL, password: PASSWORD, code });

describe("signUpAction", () => {
  beforeEach(() => {
    vi.mocked(signUp).mockReset();
    vi.mocked(confirmSignUp).mockReset();
    vi.mocked(resendConfirmationCode).mockReset();
    vi.mocked(signIn).mockReset();
    vi.mocked(createSession).mockReset();
    vi.mocked(redirect).mockClear();
  });

  describe("Scenario 1: successful account creation", () => {
    it("asks for the emailed code when the pool requires verification", async () => {
      vi.mocked(signUp).mockResolvedValue({ ok: true, confirmed: false });

      await expect(signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm())).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        notice: SIGNUP_NOTICES.codeSent,
      });
      expect(signUp).toHaveBeenCalledWith(NAME, EMAIL, PASSWORD);
      expect(signIn).not.toHaveBeenCalled();
    });

    it("confirms the code, signs in, creates the session, then redirects", async () => {
      vi.mocked(confirmSignUp).mockResolvedValue({ ok: true });
      vi.mocked(signIn).mockResolvedValue({ ok: true, tokens: TOKENS });

      await expect(
        signUpAction({ step: "confirm", email: EMAIL }, confirmForm())
      ).rejects.toThrow("NEXT_REDIRECT");

      expect(confirmSignUp).toHaveBeenCalledWith(EMAIL, "123456");
      expect(signIn).toHaveBeenCalledWith(EMAIL, PASSWORD);
      expect(createSession).toHaveBeenCalledWith(TOKENS);
      expect(redirect).toHaveBeenCalledWith(POST_SIGNUP_REDIRECT);
    });

    it("signs in right away when the pool confirms users automatically", async () => {
      vi.mocked(signUp).mockResolvedValue({ ok: true, confirmed: true });
      vi.mocked(signIn).mockResolvedValue({ ok: true, tokens: TOKENS });

      await expect(signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm())).rejects.toThrow(
        "NEXT_REDIRECT"
      );
      expect(createSession).toHaveBeenCalledWith(TOKENS);
      expect(redirect).toHaveBeenCalledWith(POST_SIGNUP_REDIRECT);
    });

    it("offers Sign In if the account exists but automatic sign-in fails", async () => {
      vi.mocked(confirmSignUp).mockResolvedValue({ ok: true });
      vi.mocked(signIn).mockResolvedValue({ ok: false, reason: "service_unavailable" });

      await expect(
        signUpAction({ step: "confirm", email: EMAIL }, confirmForm())
      ).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        formError: SIGNUP_ERROR_MESSAGES.sign_in_failed,
        signInInstead: true,
      });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("does not redirect if the session cookie cannot be created", async () => {
      vi.mocked(signUp).mockResolvedValue({ ok: true, confirmed: true });
      vi.mocked(signIn).mockResolvedValue({ ok: true, tokens: TOKENS });
      vi.mocked(createSession).mockRejectedValue(new Error("cookie failure"));

      const result = await signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm());
      expect(result).toMatchObject({ step: "details", signInInstead: true });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("Scenarios 2 and 4: missing or invalid information", () => {
    it("re-validates on the server and never calls Cognito", async () => {
      const result = await signUpAction(
        INITIAL_SIGNUP_FORM_STATE,
        createForm({ name: "", email: "not-an-email" })
      );
      expect(result).toEqual({
        step: "details",
        fieldErrors: {
          name: SIGNUP_VALIDATION_MESSAGES.nameRequired,
          email: SIGNUP_VALIDATION_MESSAGES.emailInvalid,
        },
      });
      expect(signUp).not.toHaveBeenCalled();
    });

    it("shows Cognito's password rejection on the password field", async () => {
      vi.mocked(signUp).mockResolvedValue({ ok: false, reason: "invalid_password" });
      await expect(signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm())).resolves.toEqual({
        step: "details",
        fieldErrors: { password: SIGNUP_ERROR_MESSAGES.invalid_password },
      });
    });

    it("validates the code before calling Cognito", async () => {
      await expect(
        signUpAction({ step: "confirm", email: EMAIL }, confirmForm("12"))
      ).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        codeError: SIGNUP_VALIDATION_MESSAGES.codeInvalid,
      });
      expect(confirmSignUp).not.toHaveBeenCalled();
    });

    it.each(["invalid_code", "expired_code"] as const)(
      "shows %s on the code field",
      async (reason) => {
        vi.mocked(confirmSignUp).mockResolvedValue({ ok: false, reason });
        await expect(
          signUpAction({ step: "confirm", email: EMAIL }, confirmForm())
        ).resolves.toEqual({
          step: "confirm",
          email: EMAIL,
          codeError: SIGNUP_ERROR_MESSAGES[reason],
        });
      }
    );
  });

  it("requires the terms checkbox on the server too", async () => {
    const result = await signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm({ agreeTerms: "" }));
    expect(result).toEqual({
      step: "details",
      fieldErrors: { agreeTerms: SIGNUP_VALIDATION_MESSAGES.termsRequired },
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("does not send the target role to Cognito", async () => {
    vi.mocked(signUp).mockResolvedValue({ ok: true, confirmed: false });
    await signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm());
    expect(signUp).toHaveBeenCalledWith(NAME, EMAIL, PASSWORD);
  });

  describe("Scenario 3: email already registered", () => {
    it("shows the duplicate email message on the email field", async () => {
      vi.mocked(signUp).mockResolvedValue({ ok: false, reason: "email_taken" });
      await expect(signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm())).resolves.toEqual({
        step: "details",
        fieldErrors: { email: "An account with this email already exists." },
      });
    });
  });

  describe("Scenario 5: service failure", () => {
    it("keeps the user on the form with a retryable error", async () => {
      vi.mocked(signUp).mockResolvedValue({ ok: false, reason: "service_unavailable" });
      await expect(signUpAction(INITIAL_SIGNUP_FORM_STATE, createForm())).resolves.toEqual({
        step: "details",
        formError: "We couldn't create your account right now. Please try again.",
      });
    });

    it("handles a confirmation outage", async () => {
      vi.mocked(confirmSignUp).mockResolvedValue({ ok: false, reason: "service_unavailable" });
      await expect(
        signUpAction({ step: "confirm", email: EMAIL }, confirmForm())
      ).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        formError: SIGNUP_ERROR_MESSAGES.confirm_unavailable,
      });
    });
  });

  describe("resend code", () => {
    it("sends a new code", async () => {
      vi.mocked(resendConfirmationCode).mockResolvedValue({ ok: true });
      await expect(
        signUpAction({ step: "confirm", email: EMAIL }, formData({ intent: "resend", email: EMAIL }))
      ).resolves.toEqual({ step: "confirm", email: EMAIL, notice: SIGNUP_NOTICES.codeResent });
    });

    it("reports a failed resend", async () => {
      vi.mocked(resendConfirmationCode).mockResolvedValue({
        ok: false,
        reason: "service_unavailable",
      });
      await expect(
        signUpAction({ step: "confirm", email: EMAIL }, formData({ intent: "resend", email: EMAIL }))
      ).resolves.toEqual({
        step: "confirm",
        email: EMAIL,
        formError: SIGNUP_ERROR_MESSAGES.resend_unavailable,
      });
    });
  });
});
