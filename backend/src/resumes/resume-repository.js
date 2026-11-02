// Upload Resume (Issue #06) + Extract Resume Information (Issue #07).
// Database access for a user's saved resumes and extraction state.

const { createPool } = require("../db/postgres");

const COLUMNS = `
  id,
  user_id,
  s3_key,
  file_name,
  content_type,
  size_bytes,
  uploaded_at,
  parse_status,
  parsed_text,
  parsed_json,
  parsed_at,
  parse_error
`;

// Return every resume owned by the user, newest first.
async function getResumes(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT ${COLUMNS}
        FROM resumes
        WHERE user_id = $1
        ORDER BY uploaded_at DESC
      `,
      [userId]
    );

    return result.rows;
  } finally {
    await pool.end();
  }
}

// Return one resume only when it belongs to the authenticated user.
async function getResume(userId, resumeId) {
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

// Store a new resume rather than replacing the user's existing resume.
async function createResume({
  userId,
  s3Key,
  fileName,
  contentType,
  sizeBytes,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO resumes (
          user_id,
          s3_key,
          file_name,
          content_type,
          size_bytes
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${COLUMNS}
      `,
      [userId, s3Key, fileName, contentType, sizeBytes]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

// Mark extraction as currently running.
// Clears any previous error so a failed resume can be retried cleanly.
async function markResumeProcessing(userId, resumeId) {
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
        UPDATE resumes
        SET
          parse_status = 'PROCESSING',
          parse_error = NULL
        WHERE user_id = $1
          AND id = $2
        RETURNING ${COLUMNS}
      `,
      [userId, resumeId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Save successful extraction results.
async function saveResumeExtraction({
  userId,
  resumeId,
  parsedText,
  parsedJson,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!resumeId) {
    throw new Error("resumeId is required");
  }

  if (typeof parsedText !== "string" || !parsedText.trim()) {
    throw new Error("parsedText is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        UPDATE resumes
        SET
          parse_status = 'COMPLETED',
          parsed_text = $3,
          parsed_json = $4,
          parsed_at = CURRENT_TIMESTAMP,
          parse_error = NULL
        WHERE user_id = $1
          AND id = $2
        RETURNING ${COLUMNS}
      `,
      [
        userId,
        resumeId,
        parsedText.trim(),
        parsedJson ?? null,
      ]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Record a failed extraction attempt without deleting the uploaded resume.
async function markResumeExtractionFailed({
  userId,
  resumeId,
  errorMessage,
}) {
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
        UPDATE resumes
        SET
          parse_status = 'FAILED',
          parse_error = $3
        WHERE user_id = $1
          AND id = $2
        RETURNING ${COLUMNS}
      `,
      [
        userId,
        resumeId,
        errorMessage || "Resume extraction failed.",
      ]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Delete only the requested resume and only if the user owns it.
async function deleteResume(userId, resumeId) {
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
        DELETE FROM resumes
        WHERE user_id = $1
          AND id = $2
        RETURNING ${COLUMNS}
      `,
      [userId, resumeId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

module.exports = {
  getResumes,
  getResume,
  createResume,
  markResumeProcessing,
  saveResumeExtraction,
  markResumeExtractionFailed,
  deleteResume,
};