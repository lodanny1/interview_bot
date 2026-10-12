import { beforeEach, describe, expect, it, vi } from "vitest";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import {
  SESSION_COOKIE_NAME,
  createSession,
  readSession,
} from "@/lib/auth/session-cookie";

const { cookieStore, mockVerify } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  mockVerify: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: { create: vi.fn(() => ({ verify: mockVerify })) },
}));

describe("session cookie", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    mockVerify.mockReset();
    vi.stubEnv("COGNITO_REGION", "test-region-1");
    vi.stubEnv("COGNITO_USER_POOL_ID", "test-region-1_TESTPOOL");
    vi.stubEnv("COGNITO_CLIENT_ID", "test-client-id");
  });

  describe("createSession", () => {
    it("stores the ID token in an httpOnly cookie that expires with the token", async () => {
      await createSession({ idToken: "id-token", expiresInSeconds: 3600 });

      expect(cookieStore.set).toHaveBeenCalledWith(SESSION_COOKIE_NAME, "id-token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
    });

    it("marks the cookie secure in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      await createSession({ idToken: "id-token", expiresInSeconds: 3600 });

      expect(cookieStore.set.mock.calls[0][2]).toMatchObject({ secure: true });
    });

    it.each([
      ["empty token", { idToken: "", expiresInSeconds: 3600 }],
      ["zero expiry", { idToken: "id-token", expiresInSeconds: 0 }],
      ["negative expiry", { idToken: "id-token", expiresInSeconds: -5 }],
      ["NaN expiry", { idToken: "id-token", expiresInSeconds: NaN }],
    ])("refuses incomplete token data (%s)", async (_label, tokens) => {
      await expect(createSession(tokens)).rejects.toThrow();
      expect(cookieStore.set).not.toHaveBeenCalled();
    });
  });

  describe("readSession", () => {
    it("returns verified identity claims", async () => {
      cookieStore.get.mockReturnValue({ value: "id-token" });
      mockVerify.mockResolvedValue({
        sub: "user-sub",
        email: "user@example.com",
        name: "Test User",
      });

      await expect(readSession()).resolves.toEqual({
        sub: "user-sub",
        email: "user@example.com",
        name: "Test User",
      });
      expect(cookieStore.get).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
      expect(mockVerify).toHaveBeenCalledWith("id-token");
    });

    it("verifies ID tokens for the configured pool and client", async () => {
      cookieStore.get.mockReturnValue({ value: "id-token" });
      mockVerify.mockResolvedValue({ sub: "user-sub", email: "user@example.com" });

      await readSession();

      expect(CognitoJwtVerifier.create).toHaveBeenCalledWith({
        userPoolId: "test-region-1_TESTPOOL",
        clientId: "test-client-id",
        tokenUse: "id",
      });
    });

    it("omits name when the token has none", async () => {
      cookieStore.get.mockReturnValue({ value: "id-token" });
      mockVerify.mockResolvedValue({ sub: "user-sub", email: "user@example.com" });

      await expect(readSession()).resolves.toEqual({
        sub: "user-sub",
        email: "user@example.com",
      });
    });

    it("returns null when there is no cookie", async () => {
      cookieStore.get.mockReturnValue(undefined);

      await expect(readSession()).resolves.toBeNull();
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it("returns null when verification fails (invalid or expired token)", async () => {
      cookieStore.get.mockReturnValue({ value: "tampered" });
      mockVerify.mockRejectedValue(new Error("Token expired"));

      await expect(readSession()).resolves.toBeNull();
    });

    it("returns null when the token has no email claim", async () => {
      cookieStore.get.mockReturnValue({ value: "id-token" });
      mockVerify.mockResolvedValue({ sub: "user-sub" });

      await expect(readSession()).resolves.toBeNull();
    });

    it("returns null when Cognito config is missing", async () => {
      vi.stubEnv("COGNITO_USER_POOL_ID", "");
      cookieStore.get.mockReturnValue({ value: "id-token" });

      await expect(readSession()).resolves.toBeNull();
      expect(mockVerify).not.toHaveBeenCalled();
    });
  });
});
