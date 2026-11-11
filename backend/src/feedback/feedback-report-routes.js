// Generate Feedback Report (Issue #30).
//
// Routes:
//   GET  /interviews/:id/feedback  -> the saved report state (never calls the AI)
//   POST /interviews/:id/feedback  -> generate the report if it doesn't exist yet,
//                                     or retry one that failed
//
// Response: { feedback: { sessionId, status, reason, report, generatedAt } }
// feedback.status is one of:
//   not_completed  the interview is still active; no report yet
//   not_generated  the interview is finished but no report was requested yet
//   generating     another request is building the report
//   ready          report holds the feedback
//   unavailable    not enough interview material to analyze (reason says why)
//   failed         generation failed; POST again to retry
//
// Dependencies are injected so these routes can be tested without a database.

const express = require("express");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_FROM_ROW = {
  GENERATING: "generating",
  READY: "ready",
  UNAVAILABLE: "unavailable",
  FAILED: "failed",
};

const STATUS_TO_ROW = {
  ready: "READY",
  unavailable: "UNAVAILABLE",
  failed: "FAILED",
};

function toFeedbackResponse(sessionId, row) {
  if (!row) {
    return {
      sessionId,
      status: "not_generated",
      reason: null,
      report: null,
      generatedAt: null,
    };
  }

  const status = STATUS_FROM_ROW[row.status] || "failed";

  return {
    sessionId,
    status,
    reason: status === "ready" ? null : row.unavailable_reason || null,
    report: status === "ready" ? row.report : null,
    generatedAt: status === "ready" ? row.generated_at : null,
  };
}

function notCompletedResponse(sessionId) {
  return {
    sessionId,
    status: "not_completed",
    reason: null,
    report: null,
    generatedAt: null,
  };
}

function createFeedbackReportRouter({
  requireActiveUser,
  interviewRepository,
  feedbackRepository,
  feedbackService,
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

  function notFound(res) {
    return res.status(404).json({
      error: "Interview session not found",
      code: "not_found",
    });
  }

  router.get("/interviews/:id/feedback", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const sessionId = req.params.id;
    if (!UUID_PATTERN.test(sessionId)) return notFound(res);

    try {
      const session = await interviewRepository.getInterviewSession(user.id, sessionId);
      if (!session) return notFound(res);

      if (session.status === "ACTIVE") {
        return res.status(200).json({ feedback: notCompletedResponse(sessionId) });
      }

      const row = await feedbackRepository.getFeedbackReport(user.id, sessionId);

      return res.status(200).json({ feedback: toFeedbackResponse(sessionId, row) });
    } catch (error) {
      logger.error("GET /interviews/:id/feedback failed:", error);

      return res.status(500).json({
        error: "Unable to load feedback report",
        code: "unavailable",
      });
    }
  });

  router.post("/interviews/:id/feedback", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const sessionId = req.params.id;
    if (!UUID_PATTERN.test(sessionId)) return notFound(res);

    let claimed = false;

    try {
      const session = await interviewRepository.getInterviewSession(user.id, sessionId);
      if (!session) return notFound(res);

      if (session.status === "ACTIVE") {
        return res.status(409).json({
          error: "Finish the interview before generating feedback",
          code: "not_completed",
        });
      }

      const claim = await feedbackRepository.claimFeedbackReport({
        userId: user.id,
        sessionId,
      });

      if (!claim) {
        // Already finished, or another request is generating it right now.
        const existing = await feedbackRepository.getFeedbackReport(user.id, sessionId);
        const feedback = toFeedbackResponse(sessionId, existing);

        return res
          .status(feedback.status === "generating" ? 202 : 200)
          .json({ feedback });
      }

      claimed = true;

      const messages = await interviewRepository.getInterviewMessages(sessionId);
      const result = await feedbackService.generateFeedbackReport({ session, messages });

      const saved = await feedbackRepository.saveFeedbackResult({
        userId: user.id,
        sessionId,
        status: STATUS_TO_ROW[result.status] || "FAILED",
        report: result.report || null,
        reason: result.reason || null,
      });

      return res.status(200).json({ feedback: toFeedbackResponse(sessionId, saved) });
    } catch (error) {
      logger.error("POST /interviews/:id/feedback failed:", error);

      // Don't leave the report stuck in GENERATING; FAILED can be retried.
      if (claimed) {
        try {
          await feedbackRepository.saveFeedbackResult({
            userId: user.id,
            sessionId,
            status: "FAILED",
            reason: "server_error",
          });
        } catch (saveError) {
          logger.error("Saving failed feedback state failed:", saveError);
        }
      }

      return res.status(500).json({
        error: "Unable to generate feedback report",
        code: "unavailable",
      });
    }
  });

  return router;
}

module.exports = {
  createFeedbackReportRouter,
  toFeedbackResponse,
};
