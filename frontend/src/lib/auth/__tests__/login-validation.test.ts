import { describe, expect, it } from "vitest";
import {
  LOGIN_VALIDATION_MESSAGES,
  validateLogin,
} from "@/lib/auth/login-validation";

describe("validateLogin", () => {
  it("accepts a present email and password", () => {
    expect(
      validateLogin({ email: "user@example.com", password: "secret" })
    ).toEqual({
      ok: true,
      data: { email: "user@example.com", password: "secret" },
    });
  });

  it("reports both fields when both are missing", () => {
    expect(validateLogin({})).toEqual({
      ok: false,
      fieldErrors: {
        email: LOGIN_VALIDATION_MESSAGES.emailRequired,
        password: LOGIN_VALIDATION_MESSAGES.passwordRequired,
      },
    });
  });

  it("reports a missing email", () => {
    expect(validateLogin({ email: "", password: "secret" })).toEqual({
      ok: false,
      fieldErrors: { email: LOGIN_VALIDATION_MESSAGES.emailRequired },
    });
  });

  it("reports a missing password", () => {
    expect(validateLogin({ email: "user@example.com", password: "" })).toEqual({
      ok: false,
      fieldErrors: { password: LOGIN_VALIDATION_MESSAGES.passwordRequired },
    });
  });

  it("treats whitespace-only values as missing", () => {
    expect(validateLogin({ email: "   ", password: "  " })).toEqual({
      ok: false,
      fieldErrors: {
        email: LOGIN_VALIDATION_MESSAGES.emailRequired,
        password: LOGIN_VALIDATION_MESSAGES.passwordRequired,
      },
    });
  });

  it("treats non-string values as missing", () => {
    expect(validateLogin({ email: 42, password: null })).toEqual({
      ok: false,
      fieldErrors: {
        email: LOGIN_VALIDATION_MESSAGES.emailRequired,
        password: LOGIN_VALIDATION_MESSAGES.passwordRequired,
      },
    });
  });

  it("trims the email but passes the password through unchanged", () => {
    expect(
      validateLogin({ email: "  user@example.com ", password: " pass word " })
    ).toEqual({
      ok: true,
      data: { email: "user@example.com", password: " pass word " },
    });
  });

  it("does not validate email format", () => {
    expect(validateLogin({ email: "not-an-email", password: "x" }).ok).toBe(
      true
    );
  });
});
