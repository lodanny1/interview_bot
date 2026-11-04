// Review Resume Information (Issue #08).
// Database access for the reviewed copy of a resume's extracted information.
// The columns are added by backend/sql/006_add_resume_review.sql.

const { createPool } = require("../db/postgres");

const COLUMNS = `
  id,
  file_name,
  parse_status,
  parsed_json,
  reviewed_json,
  reviewed_at
`;

// Return one resume's review state only when it belongs to the user.
async function getResumeReview(userId, resumeId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT ${COLUMNS}
        FROM resumes
        WHERE user_id = $1
          AND id = $2
        LIMIT 1
      `,
      [userId, resumeId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Save the information the user confirmed. Only a successfully extracted
// resume can be reviewed; returns null otherwise. parsed_json is not changed.
async function saveResumeReview({
  userId,
  resumeId,
  reviewedJson,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  if (!reviewedJson) {
    throw new Error("reviewedJson is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        UPDATE resumes
        SET
          reviewed_json = $3,
          reviewed_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND id = $2
          AND parse_status = 'COMPLETED'
        RETURNING ${COLUMNS}
      `,
      [userId, resumeId, reviewedJson]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

module.exports = {
  getResumeReview,
  saveResumeReview,
};
