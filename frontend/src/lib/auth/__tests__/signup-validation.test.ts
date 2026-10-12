import { describe, expect, it } from "vitest";
import {
  PASSWORD_RULES,
  SIGNUP_VALIDATION_MESSAGES as MSG,
  isValidEmail,
  meetsPasswordRules,
  passwordStrength,
  validateConfirmationCode,
  validateSignUp,
} from "@/lib/auth/signup-validation";

const GOOD = {
  name: "Alex Rivera",
  email: "alex@example.com",
  password: "Interview1!",
  targetRole: "Software Engineer",
  agreeTerms: true,
};

describe("validateSignUp", () => {
  it("accepts valid details", () => {
    expect(validateSignUp(GOOD)).toEqual({ ok: true, data: GOOD });
  });

  it("trims the name and email and lowercases the email", () => {
    const result = validateSignUp({ ...GOOD, name: "  Alex  ", email: " Alex@Example.COM " });
    expect(result).toEqual({
      ok: true,
      data: { ...GOOD, name: "Alex", email: "alex@example.com" },
    });
  });

  // Scenario 2: required fields missing
  it("reports every missing field", () => {
    expect(validateSignUp({})).toEqual({
      ok: false,
      fieldErrors: {
        name: MSG.nameRequired,
        email: MSG.emailRequired,
        password: MSG.passwordRequired,
        agreeTerms: MSG.termsRequired,
      },
    });
  });

  it("treats whitespace-only and non-string values as missing", () => {
    const result = validateSignUp({ name: "   ", email: 42, password: "  ", agreeTerms: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.name).toBe(MSG.nameRequired);
      expect(result.fieldErrors.email).toBe(MSG.emailRequired);
      expect(result.fieldErrors.password).toBe(MSG.passwordRequired);
      expect(result.fieldErrors.agreeTerms).toBe(MSG.termsRequired);
    }
  });

  // Scenario 4: invalid information
  it.each(["alex", "alex@", "@example.com", "alex@example", "al ex@example.com"])(
    "rejects the badly formatted email %j",
    (email) => {
      expect(validateSignUp({ ...GOOD, email })).toEqual({
        ok: false,
        fieldErrors: { email: MSG.emailInvalid },
      });
    }
  );

  it.each([
    ["too short", "Ab1!"],
    ["no lowercase", "INTERVIEW1!"],
    ["no uppercase", "interview1!"],
    ["no number", "Interview!!"],
    ["no symbol", "Interview12"],
  ])("rejects a password with %s", (_case, password) => {
    expect(validateSignUp({ ...GOOD, password })).toEqual({
      ok: false,
      fieldErrors: { password: MSG.passwordWeak },
    });
  });

  it("requires agreeing to the terms", () => {
    expect(validateSignUp({ ...GOOD, agreeTerms: false })).toEqual({
      ok: false,
      fieldErrors: { agreeTerms: MSG.termsRequired },
    });
  });

  it('accepts the "on" value a checkbox sends', () => {
    expect(validateSignUp({ ...GOOD, agreeTerms: "on" }).ok).toBe(true);
  });

  it("treats the target role as optional and trims it", () => {
    expect(validateSignUp({ ...GOOD, targetRole: undefined })).toEqual({
      ok: true,
      data: { ...GOOD, targetRole: "" },
    });
    const trimmed = validateSignUp({ ...GOOD, targetRole: "  Nurse " });
    expect(trimmed.ok && trimmed.data.targetRole).toBe("Nurse");
  });

  it("passes passwords through unchanged", () => {
    const password = " Interview1! ";
    const result = validateSignUp({ ...GOOD, password });
    expect(result.ok && result.data.password).toBe(password);
  });
});

describe("password and email helpers", () => {
  it("has a rule for each Cognito default requirement", () => {
    expect(PASSWORD_RULES.map((rule) => rule.id)).toEqual([
      "length",
      "lower",
      "upper",
      "number",
      "symbol",
    ]);
  });

  it("meetsPasswordRules needs every rule", () => {
    expect(meetsPasswordRules("Interview1!")).toBe(true);
    expect(meetsPasswordRules("Interview1")).toBe(false);
  });

  it("passwordStrength labels how many rules are met", () => {
    expect(passwordStrength("").label).toBe("");
    expect(passwordStrength("abc").label).toBe("Weak");
    expect(passwordStrength("abcdefgh1").label).toBe("Fair");
    expect(passwordStrength("Abcdefgh1").label).toBe("Good");
    expect(passwordStrength("Abcdefgh1!")).toEqual({ met: 5, total: 5, label: "Strong" });
  });

  it("isValidEmail checks the basic shape", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("validateConfirmationCode", () => {
  it("accepts 6 digits and strips spaces", () => {
    expect(validateConfirmationCode(" 123 456 ")).toEqual({ ok: true, code: "123456" });
  });

  it("requires a code", () => {
    expect(validateConfirmationCode("")).toEqual({ ok: false, error: MSG.codeRequired });
    expect(validateConfirmationCode(undefined)).toEqual({ ok: false, error: MSG.codeRequired });
  });

  it.each(["12345", "1234567", "12a456"])("rejects %j", (code) => {
    expect(validateConfirmationCode(code)).toEqual({ ok: false, error: MSG.codeInvalid });
  });
});
