import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/lib/auth/cognito-password-reset";

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

const EMAIL = "alex@example.com";
const CODE = "123456";
const PASSWORD = "NewPassword1!";

function awsError(name: string) {
  return Object.assign(new Error("mock error"), { name });
}

function sentInput() {
  return mockSend.mock.calls[0][0].input;
}

describe("Cognito password reset", () => {
  beforeEach(() => {
    mockSend.mockReset();
    vi.stubEnv("COGNITO_REGION", "test-region-1");
    vi.stubEnv("COGNITO_USER_POOL_ID", "test-region-1_TESTPOOL");
    vi.stubEnv("COGNITO_CLIENT_ID", "test-client-id");
    vi.stubEnv("COGNITO_CLIENT_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("requestPasswordReset", () => {
    it("asks Cognito to email a reset code", async () => {
      mockSend.mockResolvedValue({});

      await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ ok: true });
      expect(sentInput()).toEqual({ ClientId: "test-client-id", Username: EMAIL });
    });

    it("adds the secret hash when the app client has a secret", async () => {
      vi.stubEnv("COGNITO_CLIENT_SECRET", "test-secret");
      mockSend.mockResolvedValue({});

      await requestPasswordReset(EMAIL);

      const expected = createHmac("sha256", "test-secret")
        .update(EMAIL + "test-client-id")
        .digest("base64");
      expect(sentInput().SecretHash).toBe(expected);
    });

    it.each(["UserNotFoundException", "InvalidParameterException", "NotAuthorizedException"])(
      "reports success for %s so registered emails are not revealed",
      async (name) => {
        mockSend.mockRejectedValue(awsError(name));

        await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ ok: true });
      }
    );

    it("maps rate limits to too_many_attempts", async () => {
      mockSend.mockRejectedValue(awsError("LimitExceededException"));

      await expect(requestPasswordReset(EMAIL)).resolves.toEqual({
        ok: false,
        reason: "too_many_attempts",
      });
    });

    it("maps other failures to service_unavailable", async () => {
      mockSend.mockRejectedValue(awsError("CodeDeliveryFailureException"));

      await expect(requestPasswordReset(EMAIL)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
    });

    it("fails without calling Cognito when configuration is missing", async () => {
      vi.stubEnv("COGNITO_CLIENT_ID", "");

      await expect(requestPasswordReset(EMAIL)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("confirmPasswordReset", () => {
    it("sends the code and new password", async () => {
      mockSend.mockResolvedValue({});

      await expect(confirmPasswordReset(EMAIL, CODE, PASSWORD)).resolves.toEqual({
        ok: true,
      });
      expect(sentInput()).toEqual({
        ClientId: "test-client-id",
        Username: EMAIL,
        ConfirmationCode: CODE,
        Password: PASSWORD,
      });
    });

    it.each([
      ["CodeMismatchException", "invalid_code"],
      ["UserNotFoundException", "invalid_code"],
      ["ExpiredCodeException", "expired_code"],
      ["InvalidPasswordException", "invalid_password"],
      ["TooManyFailedAttemptsException", "too_many_attempts"],
      ["InternalErrorException", "service_unavailable"],
    ])("maps %s to %s", async (name, reason) => {
      mockSend.mockRejectedValue(awsError(name));

      await expect(confirmPasswordReset(EMAIL, CODE, PASSWORD)).resolves.toEqual({
        ok: false,
        reason,
      });
    });

    it("never logs the password or code", async () => {
      mockSend.mockRejectedValue(awsError("InternalErrorException"));

      await confirmPasswordReset(EMAIL, CODE, PASSWORD);

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).not.toContain(PASSWORD);
      expect(logged).not.toContain(CODE);
    });
  });
});
