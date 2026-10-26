const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  MESSAGES,
  validateTargetJob,
} = require("./target-job-validation");

const DESCRIPTION =
  "We are hiring a junior software engineer to build and maintain web features. " +
  "You will work with React and Node.js, write tests, and review code with the team. " +
  "Qualifications: a CS degree or similar experience.";

const VALID = {
  jobTitle: "  Junior Software Engineer ",
  company: "",
  description: `  ${DESCRIPTION}\r\n\r\n\r\n\r\nBenefits: remote work. `,
};

describe("validateTargetJob", () => {
  it("accepts a full job description and normalizes it", () => {
    const result = validateTargetJob(VALID);

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, {
      jobTitle: "Junior Software Engineer",
      company: null,
      description: `${DESCRIPTION}\n\nBenefits: remote work.`,
    });
  });

  it("requires a job title and description", () => {
    const result = validateTargetJob({});

    assert.equal(result.ok, false);
    assert.equal(result.fieldErrors.jobTitle, MESSAGES.jobTitleRequired);
    assert.equal(result.fieldErrors.description, MESSAGES.descriptionRequired);
  });

  it("rejects a pasted link instead of text", () => {
    const result = validateTargetJob({
      ...VALID,
      description: "https://careers.example.com/jobs/123",
    });

    assert.equal(result.fieldErrors.description, MESSAGES.descriptionIsLink);
  });

  it("rejects a description that is too short", () => {
    const result = validateTargetJob({
      ...VALID,
      description: "Software engineer, must know React.",
    });

    assert.equal(result.fieldErrors.description, MESSAGES.descriptionTooShort);
  });

  it("rejects text that is mostly symbols or numbers", () => {
    const result = validateTargetJob({
      ...VALID,
      description: "%PDF-1.7 0 0 0 1 2 3 4 5 6 7 8 9 ### $$$ @@@ !!! ".repeat(4),
    });

    assert.equal(result.fieldErrors.description, MESSAGES.descriptionUnreadable);
  });

  it("rejects text over the length limits", () => {
    const result = validateTargetJob({
      jobTitle: "x".repeat(121),
      company: "x".repeat(121),
      description: "word ".repeat(2001),
    });

    assert.equal(result.fieldErrors.jobTitle, MESSAGES.jobTitleTooLong);
    assert.equal(result.fieldErrors.company, MESSAGES.companyTooLong);
    assert.equal(result.fieldErrors.description, MESSAGES.descriptionTooLong);
  });

  it("handles a missing body", () => {
    assert.equal(validateTargetJob(undefined).ok, false);
  });
});
