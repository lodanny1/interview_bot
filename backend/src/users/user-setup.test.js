const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { validateUserSetup, isSetupComplete } = require("./user-setup");

const VALID = {
  targetRole: "  Software Engineer ",
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
      focusAreas: "BEHAVIORAL,TECHNICAL",
      targetCompany: null,
      bio: "Career switcher",
    });
  });

  it("reports every missing required field", () => {
    const result = validateUserSetup({});

    assert.equal(result.ok, false);
    assert.deepEqual(Object.keys(result.fieldErrors).sort(), ["focusAreas", "targetRole"]);
  });

  it("no longer asks for an experience level", () => {
    const result = validateUserSetup({ ...VALID, experienceLevel: "WIZARD" });

    assert.equal(result.ok, true);
    assert.equal("experienceLevel" in result.data, false);
  });

  it("rejects unknown focus areas and over-long text", () => {
    const result = validateUserSetup({
      ...VALID,
      focusAreas: ["TECHNICAL", "JUGGLING"],
      bio: "x".repeat(10001),
    });

    assert.equal(result.ok, false);
    assert.ok(result.fieldErrors.focusAreas);
    assert.match(result.fieldErrors.bio, /10,000 characters/);
  });

  it("allows a bio up to 10,000 characters", () => {
    assert.equal(validateUserSetup({ ...VALID, bio: "x".repeat(10000) }).ok, true);
  });

  it("handles a missing body", () => {
    assert.equal(validateUserSetup(undefined).ok, false);
  });
});

describe("isSetupComplete", () => {
  it("needs a target role and focus areas", () => {
    assert.equal(isSetupComplete(null), false);
    assert.equal(isSetupComplete({ target_role: "SWE" }), false);
    assert.equal(
      isSetupComplete({ target_role: "SWE", focus_areas: "TECHNICAL" }),
      true
    );
  });

  it("doesn't need an experience level", () => {
    assert.equal(
      isSetupComplete({ target_role: "SWE", focus_areas: "TECHNICAL", experience_level: null }),
      true
    );
  });
});
