const resumeRepository = require("../resumes/resume-repository");

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

async function getResumeContext({
  userId,
  resumeId,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  const resume = await resumeRepository.getResume(
    userId,
    resumeId
  );

  if (!resume) {
    const error = new Error("Resume not found.");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (resume.parse_status !== "COMPLETED") {
    const error = new Error(
      "Resume has not been successfully parsed."
    );
    error.code = "RESUME_NOT_PARSED";
    throw error;
  }

  const context = buildInterviewResumeContext(
    resume.parsed_json
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
