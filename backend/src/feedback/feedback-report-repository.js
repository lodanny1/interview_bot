// Storage for interview feedback reports (Issue #30).
// Table: backend/sql/009_create_interview_feedback_reports.sql

const { createPool } = require("../db/postgres");

const REPORT_COLUMNS = `
  session_id,
  user_id,
  status,
  report,
  unavailable_reason,
  created_at,
  updated_at,
  generated_at
`;

// A GENERATING row older than this is treated as abandoned (for example, the
// server restarted mid-request) and can be claimed again.
const STALE_GENERATING_MINUTES = 3;

async function getFeedbackReport(userId, sessionId) {
  if (!userId || !sessionId) {
    throw new Error("userId and sessionId are required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT ${REPORT_COLUMNS}
        FROM interview_feedback_reports
        WHERE session_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [sessionId, userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Marks the report as GENERATING so only one request calls the AI.
// Returns the claimed row, or null when another request already owns it or a
// finished (READY / UNAVAILABLE) report exists. FAILED and stale GENERATING
// rows can be claimed again, which is how a retry works.
async function claimFeedbackReport({ userId, sessionId }) {
  if (!userId || !sessionId) {
    throw new Error("userId and sessionId are required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO interview_feedback_reports (
          session_id,
          user_id,
          status
        )
        VALUES ($1, $2, 'GENERATING')
        ON CONFLICT (session_id) DO UPDATE
        SET
          status = 'GENERATING',
          report = NULL,
          unavailable_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE interview_feedback_reports.user_id = EXCLUDED.user_id
          AND (
            interview_feedback_reports.status = 'FAILED'
            OR (
              interview_feedback_reports.status = 'GENERATING'
              AND interview_feedback_reports.updated_at
                < CURRENT_TIMESTAMP - INTERVAL '${STALE_GENERATING_MINUTES} minutes'
            )
          )
        RETURNING ${REPORT_COLUMNS}
      `,
      [sessionId, userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

const RESULT_STATUSES = new Set(["READY", "UNAVAILABLE", "FAILED"]);

async function saveFeedbackResult({
  userId,
  sessionId,
  status,
  report = null,
  reason = null,
}) {
  if (!userId || !sessionId) {
    throw new Error("userId and sessionId are required");
  }

  if (!RESULT_STATUSES.has(status)) {
    throw new Error("Invalid feedback report status");
  }

  if (status === "READY" && !report) {
    throw new Error("A READY feedback report needs report data");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        UPDATE interview_feedback_reports
        SET
          status = $1,
          report = $2,
          unavailable_reason = $3,
          generated_at =
            CASE WHEN $1 = 'READY' THEN CURRENT_TIMESTAMP ELSE NULL END,
          updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $4
          AND user_id = $5
        RETURNING ${REPORT_COLUMNS}
      `,
      [
        status,
        status === "READY" ? report : null,
        status === "READY" ? null : reason,
        sessionId,
        userId,
      ]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

module.exports = {
  STALE_GENERATING_MINUTES,
  claimFeedbackReport,
  getFeedbackReport,
  saveFeedbackResult,
};
