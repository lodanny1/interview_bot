import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmSignUp,
  resendConfirmationCode,
  signUp,
} from "@/lib/auth/cognito-signup";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

// Replace only the client so no request ever leaves the test process.
vi.mock("@aws-sdk/client-cognito-identity-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@aws-sdk/client-cognito-identity-provider")>();
  return {
    ...actual,
    CognitoIdentityProviderClient: class {
      send = mockSend;
    },
  };
});

const NAME = "Alex Rivera";
const EMAIL = "alex@example.com";
const PASSWORD = "Interview1!";

function awsError(name: string) {
  return Object.assign(new Error("mock error"), { name });
}

function sentInput() {
  return mockSend.mock.calls[0][0].input;
}

describe("Cognito sign-up", () => {
  beforeEach(() => {
    mockSend.mockReset();
    vi.stubEnv("COGNITO_REGION", "test-region-1");
    vi.stubEnv("COGNITO_USER_POOL_ID", "test-region-1_TESTPOOL");
    vi.stubEnv("COGNITO_CLIENT_ID", "test-client-id");
    vi.stubEnv("COGNITO_CLIENT_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("signUp", () => {
    it("creates the user with email and name attributes", async () => {
      mockSend.mockResolvedValue({ UserConfirmed: false });

      await expect(signUp(NAME, EMAIL, PASSWORD)).resolves.toEqual({
        ok: true,
        confirmed: false,
      });
      expect(sentInput()).toEqual({
        ClientId: "test-client-id",
        Username: EMAIL,
        Password: PASSWORD,
        UserAttributes: [
          { Name: "email", Value: EMAIL },
          { Name: "name", Value: NAME },
        ],
      });
    });

    it("reports when the pool confirms users automatically", async () => {
      mockSend.mockResolvedValue({ UserConfirmed: true });
      await expect(signUp(NAME, EMAIL, PASSWORD)).resolves.toEqual({
        ok: true,
        confirmed: true,
      });
    });

    it("sends a SecretHash when a client secret is configured", async () => {
      vi.stubEnv("COGNITO_CLIENT_SECRET", "test-client-secret");
      mockSend.mockResolvedValue({ UserConfirmed: false });

      await signUp(NAME, EMAIL, PASSWORD);

      const expected = createHmac("sha256", "test-client-secret")
        .update(EMAIL + "test-client-id")
        .digest("base64");
      expect(sentInput().SecretHash).toBe(expected);
    });

    it.each([
      ["UsernameExistsException", "email_taken"],
      ["AliasExistsException", "email_taken"],
      ["InvalidPasswordException", "invalid_password"],
      ["InvalidParameterException", "invalid_details"],
      ["TooManyRequestsException", "too_many_attempts"],
      ["LimitExceededException", "too_many_attempts"],
      ["InternalErrorException", "service_unavailable"],
    ])("maps %s to %s", async (error, reason) => {
      mockSend.mockRejectedValue(awsError(error));
      await expect(signUp(NAME, EMAIL, PASSWORD)).resolves.toEqual({ ok: false, reason });
    });

    it("never logs the password or email on failure", async () => {
      mockSend.mockRejectedValue(awsError("InternalErrorException"));
      await signUp(NAME, EMAIL, PASSWORD);
      const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
      expect(logged).not.toContain(PASSWORD);
      expect(logged).not.toContain(EMAIL);
    });

    it("returns service_unavailable without calling Cognito when config is missing", async () => {
      vi.stubEnv("COGNITO_CLIENT_ID", "");
      await expect(signUp(NAME, EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("confirmSignUp", () => {
    it("confirms with the code", async () => {
      mockSend.mockResolvedValue({});
      await expect(confirmSignUp(EMAIL, "123456")).resolves.toEqual({ ok: true });
      expect(sentInput()).toEqual({
        ClientId: "test-client-id",
        Username: EMAIL,
        ConfirmationCode: "123456",
      });
    });

    it("treats an already-confirmed account as success", async () => {
      mockSend.mockRejectedValue(awsError("NotAuthorizedException"));
      await expect(confirmSignUp(EMAIL, "123456")).resolves.toEqual({ ok: true });
    });

    it.each([
      ["CodeMismatchException", "invalid_code"],
      ["ExpiredCodeException", "expired_code"],
      ["TooManyFailedAttemptsException", "too_many_attempts"],
      ["InternalErrorException", "service_unavailable"],
    ])("maps %s to %s", async (error, reason) => {
      mockSend.mockRejectedValue(awsError(error));
      await expect(confirmSignUp(EMAIL, "123456")).resolves.toEqual({ ok: false, reason });
    });
  });

  describe("resendConfirmationCode", () => {
    it("asks Cognito to send a new code", async () => {
      mockSend.mockResolvedValue({});
      await expect(resendConfirmationCode(EMAIL)).resolves.toEqual({ ok: true });
      expect(sentInput()).toEqual({ ClientId: "test-client-id", Username: EMAIL });
    });

    it("maps rate limits and other failures", async () => {
      mockSend.mockRejectedValueOnce(awsError("LimitExceededException"));
      await expect(resendConfirmationCode(EMAIL)).resolves.toEqual({
        ok: false,
        reason: "too_many_attempts",
      });
      mockSend.mockRejectedValueOnce(awsError("InternalErrorException"));
      await expect(resendConfirmationCode(EMAIL)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
    });
  });
});
