const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { validateUserSetup, isSetupComplete } = require("./user-setup");

const VALID = {
  targetRole: "  Software Engineer ",
  experienceLevel: "ENTRY",
  focusAreas: ["BEHAVIORAL", "TECHNICAL", "BEHAVIORAL"],
  targetCompany: "",
  bio: " Career switcher ",
};

describe("validateUserSetup", () => {
  it("accepts valid input and normalizes it", () => {
    const result = validateUserSetup(VALID);

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, {
      targetRole: "Software Engineer",
      experienceLevel: "ENTRY",
      focusAreas: "BEHAVIORAL,TECHNICAL",
      targetCompany: null,
      bio: "Career switcher",
    });
  });

  it("reports every missing required field", () => {
    const result = validateUserSetup({});

    assert.equal(result.ok, false);
    assert.deepEqual(Object.keys(result.fieldErrors).sort(), [
      "experienceLevel",
      "focusAreas",
      "targetRole",
    ]);
  });

  it("rejects unknown options and over-long text", () => {
    const result = validateUserSetup({
      ...VALID,
      experienceLevel: "WIZARD",
      focusAreas: ["TECHNICAL", "JUGGLING"],
      bio: "x".repeat(501),
    });

    assert.equal(result.ok, false);
    assert.ok(result.fieldErrors.experienceLevel);
    assert.ok(result.fieldErrors.focusAreas);
    assert.ok(result.fieldErrors.bio);
  });

  it("handles a missing body", () => {
    assert.equal(validateUserSetup(undefined).ok, false);
  });
});

describe("isSetupComplete", () => {
  it("needs every required field", () => {
    assert.equal(isSetupComplete(null), false);
    assert.equal(isSetupComplete({ target_role: "SWE" }), false);
    assert.equal(
      isSetupComplete({
        target_role: "SWE",
        experience_level: "ENTRY",
        focus_areas: "TECHNICAL",
      }),
      true
    );
  });
});
