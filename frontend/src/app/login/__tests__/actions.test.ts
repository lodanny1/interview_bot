import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { signIn, type SignInFailureReason } from "@/lib/auth/cognito";
import { createSession } from "@/lib/auth/session-cookie";
import { LOGIN_VALIDATION_MESSAGES } from "@/lib/auth/login-validation";
import {
  INITIAL_LOGIN_FORM_STATE,
  LOGIN_ERROR_MESSAGES,
  POST_LOGIN_REDIRECT,
} from "@/lib/auth/login-form-state";
import { loginAction } from "@/app/login/actions";

vi.mock("@/lib/auth/cognito", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => ({ createSession: vi.fn() }));
// The real redirect() throws to abort rendering; mirror that.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const EMAIL = "user@example.com";
const PASSWORD = "correct horse battery staple";
const TOKENS = { idToken: "id-token", expiresInSeconds: 3600 };

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("loginAction", () => {
  beforeEach(() => {
    vi.mocked(signIn).mockReset();
    vi.mocked(createSession).mockReset();
    vi.mocked(redirect).mockClear();
  });

  describe("successful sign in", () => {
    it("signs in, creates the session, then redirects to the dashboard", async () => {
      vi.mocked(signIn).mockResolvedValue({ ok: true, tokens: TOKENS });

      await expect(
        loginAction(
          INITIAL_LOGIN_FORM_STATE,
          formData({ email: EMAIL, password: PASSWORD })
        )
      ).rejects.toThrow("NEXT_REDIRECT");

      expect(signIn).toHaveBeenCalledWith(EMAIL, PASSWORD);
      expect(createSession).toHaveBeenCalledWith(TOKENS);
      expect(redirect).toHaveBeenCalledWith(POST_LOGIN_REDIRECT);
      expect(POST_LOGIN_REDIRECT).toBe("/");

      const signInOrder = vi.mocked(signIn).mock.invocationCallOrder[0];
      const sessionOrder = vi.mocked(createSession).mock.invocationCallOrder[0];
      const redirectOrder = vi.mocked(redirect).mock.invocationCallOrder[0];
      expect(signInOrder).toBeLessThan(sessionOrder);
      expect(sessionOrder).toBeLessThan(redirectOrder);
    });

    it("does not redirect if the session cannot be created", async () => {
      vi.mocked(signIn).mockResolvedValue({ ok: true, tokens: TOKENS });
      vi.mocked(createSession).mockRejectedValue(new Error("cookie failure"));

      await expect(
        loginAction(
          INITIAL_LOGIN_FORM_STATE,
          formData({ email: EMAIL, password: PASSWORD })
        )
      ).resolves.toEqual({ formError: LOGIN_ERROR_MESSAGES.service_unavailable });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("authentication failures", () => {
    it.each<[SignInFailureReason, string]>([
      ["invalid_credentials", "Incorrect email or password."],
      [
        "account_action_required",
        "This account cannot sign in yet. Please contact support or complete the required account action.",
      ],
      [
        "service_unavailable",
        "We couldn't complete sign in right now. Please try again.",
      ],
    ])(
      "returns the %s message without creating a session",
      async (reason, message) => {
        vi.mocked(signIn).mockResolvedValue({ ok: false, reason });

        const state = await loginAction(
          INITIAL_LOGIN_FORM_STATE,
          formData({ email: EMAIL, password: PASSWORD })
        );

        expect(state).toEqual({ formError: message });
        expect(createSession).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
      }
    );
  });

  describe("required fields", () => {
    it("returns field errors without calling Cognito", async () => {
      const state = await loginAction(INITIAL_LOGIN_FORM_STATE, new FormData());

      expect(state).toEqual({
        fieldErrors: {
          email: LOGIN_VALIDATION_MESSAGES.emailRequired,
          password: LOGIN_VALIDATION_MESSAGES.passwordRequired,
        },
      });
      expect(signIn).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("rejects a missing password", async () => {
      const state = await loginAction(
        INITIAL_LOGIN_FORM_STATE,
        formData({ email: EMAIL, password: "" })
      );

      expect(state).toEqual({
        fieldErrors: { password: LOGIN_VALIDATION_MESSAGES.passwordRequired },
      });
      expect(signIn).not.toHaveBeenCalled();
    });
  });

  describe("password handling", () => {
    it.each<[string, () => void]>([
      ["validation error", () => {}],
      [
        "authentication failure",
        () =>
          vi
            .mocked(signIn)
            .mockResolvedValue({ ok: false, reason: "invalid_credentials" }),
      ],
      [
        "service failure",
        () =>
          vi
            .mocked(signIn)
            .mockResolvedValue({ ok: false, reason: "service_unavailable" }),
      ],
    ])("never returns or logs the password (%s)", async (label, arrange) => {
      arrange();
      const logSpies = (["log", "info", "warn", "error"] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => {})
      );
      const values =
        label === "validation error"
          ? { email: "", password: PASSWORD }
          : { email: EMAIL, password: PASSWORD };

      const state = await loginAction(INITIAL_LOGIN_FORM_STATE, formData(values));

      expect(JSON.stringify(state)).not.toContain(PASSWORD);
      expect(state).not.toHaveProperty("password");
      const logged = logSpies.flatMap((spy) => spy.mock.calls.flat()).join(" ");
      expect(logged).not.toContain(PASSWORD);
    });
  });
});
