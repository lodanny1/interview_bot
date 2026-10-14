import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCognitoConfig } from "@/lib/auth/cognito-config";

// Placeholder values only; no real AWS identifiers belong in tests.
function stubRequiredEnv() {
  vi.stubEnv("COGNITO_REGION", "test-region-1");
  vi.stubEnv("COGNITO_USER_POOL_ID", "test-region-1_TESTPOOL");
  vi.stubEnv("COGNITO_CLIENT_ID", "test-client-id");
  vi.stubEnv("COGNITO_CLIENT_SECRET", "");
}

describe("getCognitoConfig", () => {
  beforeEach(stubRequiredEnv);

  it("returns the config when required variables are set", () => {
    expect(getCognitoConfig()).toEqual({
      region: "test-region-1",
      userPoolId: "test-region-1_TESTPOOL",
      clientId: "test-client-id",
    });
  });

  it("includes the client secret when configured", () => {
    vi.stubEnv("COGNITO_CLIENT_SECRET", "test-client-secret");
    expect(getCognitoConfig()?.clientSecret).toBe("test-client-secret");
  });

  it.each(["COGNITO_REGION", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"])(
    "returns null when %s is missing",
    (name) => {
      vi.stubEnv(name, "");
      expect(getCognitoConfig()).toBeNull();
    }
  );

  it("returns null when a required variable is whitespace", () => {
    vi.stubEnv("COGNITO_CLIENT_ID", "   ");
    expect(getCognitoConfig()).toBeNull();
  });
});
