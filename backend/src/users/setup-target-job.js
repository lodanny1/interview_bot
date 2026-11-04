// Complete User Setup (Issue #05) + Target Jobs. The setup page's "Target job"
// section (job title, company, job description) is saved as a real target job,
// so it shows up on the Target Jobs page and can be picked for interviews.
//
// The job title and company are the setup page's target role and company. The
// job description is optional: without one, no target job is saved, because a
// target job always needs a description.

const { validateTargetJob } = require("../target-jobs/target-job-validation");

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Returns { ok: true, job } where job is null when no description was given,
// or { ok: false, fieldErrors } using the setup form's field names.
function validateSetupTargetJob(body) {
  const input = body && typeof body === "object" ? body : {};
  const description = asTrimmedString(input.jobDescription);

  if (!description) {
    return { ok: true, job: null };
  }

  const validation = validateTargetJob({
    jobTitle: input.targetRole,
    company: input.targetCompany,
    description,
  });

  if (!validation.ok) {
    // Title and company problems are already reported by the setup checks,
    // so only the description error is added here.
    return validation.fieldErrors.description
      ? { ok: false, fieldErrors: { jobDescription: validation.fieldErrors.description } }
      : { ok: true, job: null };
  }

  return { ok: true, job: validation.data };
}

function sameText(a, b) {
  return asTrimmedString(a).toLowerCase() === asTrimmedString(b).toLowerCase();
}

// The saved target job with the same title and company, if there is one.
function findMatchingTargetJob(targetJobs, { jobTitle, company }) {
  if (!Array.isArray(targetJobs)) return null;
  return (
    targetJobs.find(
      (job) => sameText(job.job_title, jobTitle) && sameText(job.company, company)
    ) || null
  );
}

// Saves the setup page's target job. Updates the matching job if the user
// already has one with the same title and company (for example, when they
// come back to setup), otherwise adds a new one.
async function saveSetupTargetJob({ userId, job, repository }) {
  const existing = findMatchingTargetJob(await repository.listTargetJobs(userId), job);

  if (existing) {
    return repository.updateTargetJobById({
      userId,
      targetJobId: existing.id,
      ...job,
    });
  }

  return repository.createTargetJob({ userId, ...job });
}

module.exports = {
  validateSetupTargetJob,
  findMatchingTargetJob,
  saveSetupTargetJob,
};
