const {
  getResume,
  markResumeProcessing,
  saveResumeExtraction,
  markResumeExtractionFailed,
} = require("./resume-repository");

const {
  getResumeObject,
} = require("./resume-storage");

const {
  extractResumeText,
} = require("./resume-extractor");

const {
  parseResume,
} = require("./resume-parser");

const {
  hasResumeContent,
  normalizeResumeData,
} = require("./resume-review-validation");

async function extractAndParseResume({
  userId,
  resumeId,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  const resume = await getResume(
    userId,
    resumeId
  );

  if (!resume) {
    const error = new Error(
      "Resume not found."
    );

    error.code = "NOT_FOUND";

    throw error;
  }

  await markResumeProcessing(
    userId,
    resumeId
  );

  try {
    const object =
      await getResumeObject(
        resume.s3_key
      );

    const parsedText =
      await extractResumeText({
        body: object.body,
        contentType:
          resume.content_type ||
          object.contentType,
      });

    const {
      parsedJson,
      usage,
    } = await parseResume(
      parsedText
    );

    // Issue #08: output with no usable resume content (e.g. {} or the
    // prompt's all-null example) is recorded as FAILED, not COMPLETED.
    if (
      !hasResumeContent(
        normalizeResumeData(parsedJson)
      )
    ) {
      const error = new Error(
        "No usable resume information was found."
      );

      error.code = "UNUSABLE_RESUME_DATA";

      throw error;
    }

    const updatedResume =
      await saveResumeExtraction({
        userId,
        resumeId,
        parsedText,
        parsedJson,
      });

    return {
      resume: updatedResume,
      usage,
    };
  } catch (error) {
    try {
      await markResumeExtractionFailed({
        userId,
        resumeId,
        errorMessage:
          error?.message ||
          "Resume extraction failed.",
      });
    } catch (repositoryError) {
      console.error(
        "Failed to record resume extraction failure:",
        repositoryError
      );
    }

    throw error;
  }
}

module.exports = {
  extractAndParseResume,
};