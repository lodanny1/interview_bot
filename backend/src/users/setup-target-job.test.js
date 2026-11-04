const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateSetupTargetJob,
  findMatchingTargetJob,
  saveSetupTargetJob,
} = require("./setup-target-job");
const { MESSAGES } = require("../target-jobs/target-job-validation");

const DESCRIPTION =
  "We are hiring a junior software engineer to build and maintain web features. " +
  "You will work with React and Node.js, write tests, and review code with the team.";

describe("validateSetupTargetJob", () => {
  it("turns the setup's role, company and description into a target job", () => {
    assert.deepEqual(
      validateSetupTargetJob({
        targetRole: " Software Engineer ",
        targetCompany: "Acme",
        jobDescription: `  ${DESCRIPTION}  `,
      }),
      {
        ok: true,
        job: { jobTitle: "Software Engineer", company: "Acme", description: DESCRIPTION },
      }
    );
  });

  it("saves no target job when the description is left empty", () => {
    assert.deepEqual(validateSetupTargetJob({ targetRole: "SWE", jobDescription: "  " }), {
      ok: true,
      job: null,
    });
    assert.deepEqual(validateSetupTargetJob(undefined), { ok: true, job: null });
  });

  it("uses the Target Jobs page's description rules", () => {
    assert.deepEqual(
      validateSetupTargetJob({ targetRole: "SWE", jobDescription: "https://jobs.example.com/1" }),
      { ok: false, fieldErrors: { jobDescription: MESSAGES.descriptionIsLink } }
    );
    assert.deepEqual(
      validateSetupTargetJob({ targetRole: "SWE", jobDescription: "Too short." }),
      { ok: false, fieldErrors: { jobDescription: MESSAGES.descriptionTooShort } }
    );
  });
});

describe("findMatchingTargetJob", () => {
  const jobs = [
    { id: "1", job_title: "Data Analyst", company: null },
    { id: "2", job_title: "Software Engineer", company: "Acme" },
  ];

  it("matches title and company, ignoring case and spaces", () => {
    assert.equal(findMatchingTargetJob(jobs, { jobTitle: "software engineer ", company: "ACME" }).id, "2");
    assert.equal(findMatchingTargetJob(jobs, { jobTitle: "Data Analyst", company: null }).id, "1");
  });

  it("returns null when nothing matches", () => {
    assert.equal(findMatchingTargetJob(jobs, { jobTitle: "Software Engineer", company: "Other" }), null);
    assert.equal(findMatchingTargetJob(undefined, { jobTitle: "x", company: null }), null);
  });
});

describe("saveSetupTargetJob", () => {
  function fakeRepository(existing) {
    const calls = [];
    return {
      calls,
      async listTargetJobs(userId) {
        calls.push(["list", userId]);
        return existing;
      },
      async createTargetJob(args) {
        calls.push(["create", args]);
        return { id: "new", ...args };
      },
      async updateTargetJobById(args) {
        calls.push(["update", args]);
        return { id: args.targetJobId, ...args };
      },
    };
  }

  const job = { jobTitle: "Software Engineer", company: "Acme", description: DESCRIPTION };

  it("adds a new target job the first time", async () => {
    const repository = fakeRepository([]);
    const saved = await saveSetupTargetJob({ userId: "u1", job, repository });

    assert.equal(saved.id, "new");
    assert.deepEqual(repository.calls[1], ["create", { userId: "u1", ...job }]);
  });

  it("updates the same job instead of adding a duplicate when setup is saved again", async () => {
    const repository = fakeRepository([{ id: "j9", job_title: "Software Engineer", company: "Acme" }]);
    const saved = await saveSetupTargetJob({ userId: "u1", job, repository });

    assert.equal(saved.id, "j9");
    assert.deepEqual(repository.calls[1], ["update", { userId: "u1", targetJobId: "j9", ...job }]);
    assert.equal(repository.calls.some(([name]) => name === "create"), false);
  });
});
