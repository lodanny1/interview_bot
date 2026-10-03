import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { signIn } from "@/lib/auth/cognito";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

// Replace only the client so no request ever leaves the test process.
vi.mock("@aws-sdk/client-cognito-identity-provider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@aws-sdk/client-cognito-identity-provider")
    >();
  return {
    ...actual,
    CognitoIdentityProviderClient: class {
      send = mockSend;
    },
  };
});

const EMAIL = "user@example.com";
const PASSWORD = "correct horse battery staple";

function awsError(name: string, message = "mock error") {
  return Object.assign(new Error(message), { name });
}

function sentCommand(): InitiateAuthCommand {
  return mockSend.mock.calls[0][0];
}

describe("signIn", () => {
  beforeEach(() => {
    mockSend.mockReset();
    vi.stubEnv("COGNITO_REGION", "test-region-1");
    vi.stubEnv("COGNITO_USER_POOL_ID", "test-region-1_TESTPOOL");
    vi.stubEnv("COGNITO_CLIENT_ID", "test-client-id");
    vi.stubEnv("COGNITO_CLIENT_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("success", () => {
    it("returns the ID token and expiry", async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: { IdToken: "id-token", ExpiresIn: 3600 },
      });

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: true,
        tokens: { idToken: "id-token", expiresInSeconds: 3600 },
      });
    });

    it("uses USER_PASSWORD_AUTH without a SECRET_HASH when no secret is set", async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: { IdToken: "id-token", ExpiresIn: 3600 },
      });

      await signIn(EMAIL, PASSWORD);

      expect(sentCommand().input).toEqual({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: "test-client-id",
        AuthParameters: { USERNAME: EMAIL, PASSWORD: PASSWORD },
      });
    });

    it("sends a SECRET_HASH when a client secret is configured", async () => {
      vi.stubEnv("COGNITO_CLIENT_SECRET", "test-client-secret");
      mockSend.mockResolvedValue({
        AuthenticationResult: { IdToken: "id-token", ExpiresIn: 3600 },
      });

      await signIn(EMAIL, PASSWORD);

      const expected = createHmac("sha256", "test-client-secret")
        .update(EMAIL + "test-client-id")
        .digest("base64");
      expect(sentCommand().input.AuthParameters?.SECRET_HASH).toBe(expected);
    });
  });

  describe("incomplete AuthenticationResult", () => {
    it.each([
      ["no AuthenticationResult", {}],
      ["missing IdToken", { AuthenticationResult: { ExpiresIn: 3600 } }],
      ["empty IdToken", { AuthenticationResult: { IdToken: "", ExpiresIn: 3600 } }],
      ["missing ExpiresIn", { AuthenticationResult: { IdToken: "id-token" } }],
      ["zero ExpiresIn", { AuthenticationResult: { IdToken: "id-token", ExpiresIn: 0 } }],
      ["negative ExpiresIn", { AuthenticationResult: { IdToken: "id-token", ExpiresIn: -1 } }],
      ["NaN ExpiresIn", { AuthenticationResult: { IdToken: "id-token", ExpiresIn: NaN } }],
    ])("returns service_unavailable for %s", async (_label, response) => {
      mockSend.mockResolvedValue(response);

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
    });
  });

  describe("invalid credentials", () => {
    it.each(["NotAuthorizedException", "UserNotFoundException"])(
      "maps %s to invalid_credentials",
      async (name) => {
        mockSend.mockRejectedValue(awsError(name));

        await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
          ok: false,
          reason: "invalid_credentials",
        });
      }
    );
  });

  describe("account action required", () => {
    it.each(["UserNotConfirmedException", "PasswordResetRequiredException"])(
      "maps %s to account_action_required",
      async (name) => {
        mockSend.mockRejectedValue(awsError(name));

        await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
          ok: false,
          reason: "account_action_required",
        });
      }
    );

    it("maps an auth challenge to account_action_required", async () => {
      mockSend.mockResolvedValue({ ChallengeName: "NEW_PASSWORD_REQUIRED" });

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "account_action_required",
      });
    });
  });

  describe("service failure", () => {
    it.each([
      "InternalErrorException",
      "TooManyRequestsException",
      "TimeoutError",
      "SomethingUnexpected",
    ])("maps %s to service_unavailable", async (name) => {
      mockSend.mockRejectedValue(awsError(name));

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
    });

    it("maps a network failure to service_unavailable", async () => {
      mockSend.mockRejectedValue(new TypeError("fetch failed"));

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
    });

    it("maps a non-Error rejection to service_unavailable", async () => {
      mockSend.mockRejectedValue("boom");

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
    });

    it("returns service_unavailable without calling Cognito when config is missing", async () => {
      vi.stubEnv("COGNITO_CLIENT_ID", "");

      await expect(signIn(EMAIL, PASSWORD)).resolves.toEqual({
        ok: false,
        reason: "service_unavailable",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("logging", () => {
    it("never logs the password, email or error message", async () => {
      mockSend.mockRejectedValue(
        awsError("InternalErrorException", `failed for ${EMAIL} / ${PASSWORD}`)
      );

      await signIn(EMAIL, PASSWORD);

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).not.toContain(PASSWORD);
      expect(logged).not.toContain(EMAIL);
    });
  });
});
