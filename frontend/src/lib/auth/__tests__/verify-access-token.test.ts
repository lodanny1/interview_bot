import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerify, mockGetCognitoConfig } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockGetCognitoConfig: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: vi.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

vi.mock("../cognito-config", () => ({
  getCognitoConfig: mockGetCognitoConfig,
}));

import { verifyAccessToken } from "../verify-access-token";

describe("verifyAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCognitoConfig.mockReturnValue({
      region: "us-east-2",
      userPoolId: "us-east-2_testPool",
      clientId: "test-client-id",
    });
  });

  it("returns verified claims for a valid access token", async () => {
    mockVerify.mockResolvedValue({
      sub: "user-123",
      client_id: "test-client-id",
      scope: "openid email",
    });

    const result = await verifyAccessToken("valid-token");

    expect(result).toEqual({
      sub: "user-123",
      clientId: "test-client-id",
      scope: "openid email",
    });
  });

  it("rejects an invalid token", async () => {
    mockVerify.mockRejectedValue(new Error("Invalid token"));

    const result = await verifyAccessToken("invalid-token");

    expect(result).toBeNull();
  });

  it("rejects an expired token", async () => {
    mockVerify.mockRejectedValue(new Error("Token expired"));

    const result = await verifyAccessToken("expired-token");

    expect(result).toBeNull();
  });

  it("rejects a missing token", async () => {
    const result = await verifyAccessToken("");

    expect(result).toBeNull();
  });

  it("rejects a token with missing user identifier", async () => {
    mockVerify.mockResolvedValue({
      client_id: "test-client-id",
    });

    const result = await verifyAccessToken("missing-sub");

    expect(result).toBeNull();
  });

  it("rejects a token with an invalid client ID claim", async () => {
    mockVerify.mockResolvedValue({
      sub: "user-123",
      client_id: null,
    });

    const result = await verifyAccessToken("invalid-client");

    expect(result).toBeNull();
  });

  it("rejects tokens when Cognito is not configured", async () => {
    mockGetCognitoConfig.mockReturnValue(null);

    const result = await verifyAccessToken("valid-token");

    expect(result).toBeNull();
  });
});