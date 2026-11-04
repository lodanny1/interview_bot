// Review Resume Information (Issue #08).
//
// Routes:
//   GET /me/resumes/:resumeId/review   -> review state and the information to show
//   PUT /me/resumes/:resumeId/review   -> save the information the user confirmed
//
// review.status is one of:
//   not_extracted  the resume hasn't been extracted yet
//   processing     extraction is running (or stopped before finishing)
//   failed         extraction failed or produced nothing usable
//   ready          extracted information is ready to review
//   reviewed       the user has confirmed the information
//
// parse_error, parsed_text and raw AI output are never sent to the client.
// Dependencies are injected so these routes can be tested without a database.

const express = require("express");

const {
  hasResumeContent,
  normalizeResumeData,
  validateResumeReview,
} = require("./resume-review-validation");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reviewStatus(row) {
  switch (row.parse_status) {
    case "PENDING":
      return "not_extracted";
    case "PROCESSING":
      return "processing";
    case "COMPLETED":
      break;
    default:
      return "failed";
  }

  if (row.reviewed_at && row.reviewed_json) return "reviewed";

  // A COMPLETED row can still hold unusable output, e.g. one extracted
  // before the extraction service checked for content.
  return hasResumeContent(normalizeResumeData(row.parsed_json))
    ? "ready"
    : "failed";
}

function toReview(row) {
  const status = reviewStatus(row);

  const data =
    status === "reviewed"
      ? normalizeResumeData(row.reviewed_json)
      : status === "ready"
        ? normalizeResumeData(row.parsed_json)
        : null;

  return {
    resumeId: row.id,
    fileName: row.file_name,
    status,
    data,
    reviewedAt: status === "reviewed" ? row.reviewed_at : null,
  };
}

function createResumeReviewRouter({
  requireActiveUser,
  repository,
  logger = console,
}) {
  const router = express.Router();

  async function authenticate(req, res) {
    const auth = await requireActiveUser(req);

    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return null;
    }

    return auth.user;
  }

  // A malformed id can't match a resume, and would make Postgres reject the
  // query, so it is treated as not found.
  function notFound(res) {
    return res.status(404).json({
      error: "Resume not found",
      code: "not_found",
    });
  }

  router.get("/me/resumes/:resumeId/review", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const { resumeId } = req.params;

    if (!UUID_PATTERN.test(resumeId)) return notFound(res);

    try {
      const row = await repository.getResumeReview(user.id, resumeId);

      if (!row) return notFound(res);

      return res.status(200).json({ review: toReview(row) });
    } catch (error) {
      logger.error("GET /me/resumes/:resumeId/review failed:", error);

      return res.status(500).json({
        error: "Unable to load resume information",
        code: "unavailable",
      });
    }
  });

  router.put("/me/resumes/:resumeId/review", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const { resumeId } = req.params;

    if (!UUID_PATTERN.test(resumeId)) return notFound(res);

    const validation = validateResumeReview(req.body);

    if (!validation.ok) {
      return res.status(400).json({
        error: "Some resume information is missing or invalid",
        code: "invalid",
        fieldErrors: validation.fieldErrors,
      });
    }

    try {
      const current = await repository.getResumeReview(user.id, resumeId);

      if (!current) return notFound(res);

      const saved =
        current.parse_status === "COMPLETED"
          ? await repository.saveResumeReview({
              userId: user.id,
              resumeId,
              reviewedJson: validation.data,
            })
          : null;

      if (!saved) {
        return res.status(409).json({
          error: "Resume information has not been extracted yet",
          code: "not_extracted",
        });
      }

      return res.status(200).json({ review: toReview(saved) });
    } catch (error) {
      logger.error("PUT /me/resumes/:resumeId/review failed:", error);

      return res.status(500).json({
        error: "Unable to save resume information",
        code: "unavailable",
      });
    }
  });

  return router;
}

module.exports = {
  createResumeReviewRouter,
};
