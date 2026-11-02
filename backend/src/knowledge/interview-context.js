// Role & Company Knowledge Retrieval (Issue #16). Turns the interview setup
// and the saved target job into the knowledge retrieval for one interview.
// No database or auth calls: the caller passes in what it already loaded.
//
// Usage from a future POST /interviews route:
//   const targetJob = await getTargetJob(user.id); // row or null
//   const { input, knowledge } = buildInterviewContext({ setup: body, targetJob });
//   // prompt: input.jobTitle, input.company, knowledge.context, knowledge.coverage
//   // persist: input, knowledge.version, knowledge.retrieverVersion,
//   //          knowledge.sections, knowledge.sources (or knowledge.context)
const {
  DEFAULT_FOCUS_AREA,
  FOCUS_AREAS,
  INDUSTRIES,
  PRACTICE_GOALS,
  ROLE_LEVELS,
} = require("./interview-options");
const { retrieveInterviewKnowledge } = require("./retrieve-knowledge");

const LIMITS = {
  jobTitle: 120,
  company: 120,
  jobDescription: 10000,
};

function cleanText(value, maxChars) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  return text ? text.slice(0, maxChars) : null;
}

// Empty is "not given" (null, no note); anything else must be a known value.
function cleanChoice(value, allowed, invalidNote, notes) {
  const text = cleanText(value, 40);

  if (!text) return null;
  if (allowed.includes(text)) return text;

  notes.push(invalidNote);

  return null;
}

// setup: the Start Interview body (frontend StartInterviewInput):
//   { goal, focusArea, industry?, roleLevel?, experienceLevel?, jobDescription? }
// targetJob: the target_jobs row ({ job_title, company, description }) or null.
//
// Precedence:
// - "general" ignores the saved target job entirely.
// - "specific" uses the saved job's title and company. Without a usable target
//   job it falls back to general practice and notes "target_job_missing".
// - A nonempty setup job description replaces the saved description; they are
//   never merged, because they may describe different postings.
// - roleLevel only comes from setup. Missing means level-neutral material;
//   experienceLevel (years) is not used to guess it.
// - focusArea defaults to "mixed".
function resolveInterviewInput({ setup, targetJob } = {}) {
  const raw = setup && typeof setup === "object" ? setup : {};
  const job = targetJob && typeof targetJob === "object" ? targetJob : null;
  const notes = [];

  const goalText = cleanText(raw.goal, 40);
  const requestedGoal = PRACTICE_GOALS.includes(goalText) ? goalText : null;

  if (!requestedGoal) notes.push(goalText ? "invalid_goal" : "missing_goal");

  const savedTitle = job ? cleanText(job.job_title, LIMITS.jobTitle) : null;
  let goal = requestedGoal || "general";

  if (goal === "specific" && !savedTitle) {
    notes.push("target_job_missing");
    goal = "general";
  } else if (goal === "general" && job) {
    notes.push("target_job_ignored");
  }

  const usesTargetJob = goal === "specific";
  const company = usesTargetJob ? cleanText(job.company, LIMITS.company) : null;
  const setupDescription = cleanText(raw.jobDescription, LIMITS.jobDescription);
  const savedDescription = usesTargetJob ? cleanText(job.description, LIMITS.jobDescription) : null;

  let jobDescription = null;
  let jobDescriptionSource = null;

  if (setupDescription) {
    jobDescription = setupDescription;
    jobDescriptionSource = "setup";

    if (savedDescription && savedDescription !== setupDescription) {
      notes.push("setup_description_replaces_saved");
    }
  } else if (savedDescription) {
    jobDescription = savedDescription;
    jobDescriptionSource = "target_job";
  }

  const industry = cleanChoice(raw.industry, INDUSTRIES, "invalid_industry", notes);
  const roleLevel = cleanChoice(raw.roleLevel, ROLE_LEVELS, "invalid_role_level", notes);
  const chosenFocus = cleanChoice(raw.focusArea, FOCUS_AREAS, "invalid_focus_area", notes);

  return {
    requestedGoal,
    goal,
    jobTitle: usesTargetJob ? savedTitle : null,
    company,
    industry,
    roleLevel,
    focusArea: chosenFocus || DEFAULT_FOCUS_AREA,
    jobDescription,
    provenance: {
      jobTitle: usesTargetJob ? "target_job" : null,
      company: company ? "target_job" : null,
      jobDescription: jobDescriptionSource,
      industry: industry ? "setup" : null,
      roleLevel: roleLevel ? "setup" : null,
      focusArea: chosenFocus ? "setup" : "default",
    },
    notes,
  };
}

// Returns { input, knowledge }:
// - input: the effective inputs from resolveInterviewInput.
// - knowledge: the retrieveInterviewKnowledge result for those inputs.
// options are passed through to retrieveInterviewKnowledge.
function buildInterviewContext({ setup, targetJob } = {}, options = {}) {
  const input = resolveInterviewInput({ setup, targetJob });
  const knowledge = retrieveInterviewKnowledge(
    {
      jobTitle: input.jobTitle,
      company: input.company,
      industry: input.industry,
      roleLevel: input.roleLevel,
      // null lets coverage report that the framework was defaulted.
      focusArea: input.provenance.focusArea === "setup" ? input.focusArea : null,
      jobDescription: input.jobDescription,
    },
    options
  );

  return { input, knowledge };
}

module.exports = {
  buildInterviewContext,
  resolveInterviewInput,
};
