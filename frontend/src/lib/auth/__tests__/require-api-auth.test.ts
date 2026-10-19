
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("../verify-access-token", () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

import { requireApiAuth } from "../require-api-auth";

describe("requireApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid Bearer token", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-123",
      clientId: "test-client-id",
      scope: "openid email",
    });

    const result = await requireApiAuth("Bearer valid-token");

    expect(mockVerifyAccessToken).toHaveBeenCalledWith("valid-token");

    expect(result).toEqual({
      sub: "user-123",
      clientId: "test-client-id",
      scope: "openid email",
    });
  });

  it("rejects a missing authorization header", async () => {
    const result = await requireApiAuth(null);

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects an empty authorization header", async () => {
    const result = await requireApiAuth("");

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects an authorization header without Bearer", async () => {
    const result = await requireApiAuth("valid-token");

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects a malformed Bearer token", async () => {
    const result = await requireApiAuth("Bearer ");

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    mockVerifyAccessToken.mockResolvedValue(null);

    const result = await requireApiAuth("Bearer invalid-token");

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("invalid-token");
  });

  it("rejects an expired token", async () => {
    mockVerifyAccessToken.mockResolvedValue(null);

    const result = await requireApiAuth("Bearer expired-token");

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("expired-token");
  });

  it("rejects unsupported authentication schemes", async () => {
    const result = await requireApiAuth("Basic credentials");

    expect(result).toBeNull();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });
});
