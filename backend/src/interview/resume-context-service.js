const resumeReviewRepository = require("../resumes/resume-review-repository");
const resumeExtractionService = require("../resumes/resume-extraction-service");

// Takes the parser's output structure. A reviewed copy (Issue #08) has the
// same structure, so either can be passed in.
function buildInterviewResumeContext(parsedJson) {
  if (!parsedJson || typeof parsedJson !== "object") {
    return null;
  }

  const context = {
    summary:
      typeof parsedJson.summary === "string"
        ? parsedJson.summary
        : null,

    skills: Array.isArray(parsedJson.skills)
      ? parsedJson.skills
      : [],

    education: Array.isArray(parsedJson.education)
      ? parsedJson.education
      : [],

    experience: Array.isArray(parsedJson.experience)
      ? parsedJson.experience
      : [],

    projects: Array.isArray(parsedJson.projects)
      ? parsedJson.projects
      : [],

    certifications: Array.isArray(parsedJson.certifications)
      ? parsedJson.certifications
      : [],
  };

  return context;
}

// Uses the information the user confirmed on the review page (reviewed_json)
// when there is one, otherwise the AI extraction (parsed_json).
// With extractIfNeeded, a resume that isn't extracted yet is extracted first
// (one AI call), so starting an interview doesn't depend on the review page.
async function getResumeContext({
  userId,
  resumeId,
  extractIfNeeded = false,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  let resume =
    await resumeReviewRepository.getResumeReview(
      userId,
      resumeId
    );

  if (!resume) {
    const error = new Error("Resume not found.");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (
    resume.parse_status !== "COMPLETED" &&
    extractIfNeeded
  ) {
    await resumeExtractionService.extractAndParseResume({
      userId,
      resumeId,
    });

    resume =
      await resumeReviewRepository.getResumeReview(
        userId,
        resumeId
      );
  }

  if (!resume || resume.parse_status !== "COMPLETED") {
    const error = new Error(
      "Resume has not been successfully parsed."
    );
    error.code = "RESUME_NOT_PARSED";
    throw error;
  }

  const context = buildInterviewResumeContext(
    resume.reviewed_json || resume.parsed_json
  );

  if (!context) {
    const error = new Error(
      "Resume contains no parsed interview context."
    );
    error.code = "RESUME_CONTEXT_UNAVAILABLE";
    throw error;
  }

  return {
    resumeId: resume.id,
    context,
  };
}

module.exports = {
  buildInterviewResumeContext,
  getResumeContext,
};
