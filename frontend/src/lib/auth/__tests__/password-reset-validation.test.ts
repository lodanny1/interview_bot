import { describe, expect, it } from "vitest";
import {
  validateNewPassword,
  validateResetEmail,
} from "@/lib/auth/password-reset-validation";
import { SIGNUP_VALIDATION_MESSAGES } from "@/lib/auth/signup-validation";

describe("validateResetEmail", () => {
  it("trims and lowercases a valid email", () => {
    expect(validateResetEmail("  Alex@Example.com ")).toEqual({
      ok: true,
      email: "alex@example.com",
    });
  });

  it("requires an email", () => {
    expect(validateResetEmail("")).toEqual({
      ok: false,
      error: SIGNUP_VALIDATION_MESSAGES.emailRequired,
    });
  });

  it("rejects a malformed email", () => {
    expect(validateResetEmail("not-an-email")).toEqual({
      ok: false,
      error: SIGNUP_VALIDATION_MESSAGES.emailInvalid,
    });
  });
});

describe("validateNewPassword", () => {
  it("accepts a 6-digit code and a strong password", () => {
    expect(validateNewPassword({ code: "123 456", password: "NewPassword1!" })).toEqual({
      ok: true,
      data: { code: "123456", password: "NewPassword1!" },
    });
  });

  it("rejects a password that misses the requirements", () => {
    expect(validateNewPassword({ code: "123456", password: "weak" })).toEqual({
      ok: false,
      fieldErrors: { password: SIGNUP_VALIDATION_MESSAGES.passwordWeak },
    });
  });

  it("reports a missing code and password together", () => {
    expect(validateNewPassword({ code: "", password: "   " })).toEqual({
      ok: false,
      fieldErrors: {
        code: SIGNUP_VALIDATION_MESSAGES.codeRequired,
        password: SIGNUP_VALIDATION_MESSAGES.passwordRequired,
      },
    });
  });

  it("rejects a code that is not 6 digits", () => {
    const result = validateNewPassword({ code: "12ab", password: "NewPassword1!" });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { code: SIGNUP_VALIDATION_MESSAGES.codeInvalid },
    });
  });
});
