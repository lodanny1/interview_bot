// Upload Resume (Issue #06).
// Database access for a user's zero-to-many saved resumes.

const { createPool } = require("../db/postgres");

const COLUMNS = `
  id,
  user_id,
  s3_key,
  file_name,
  content_type,
  size_bytes,
  uploaded_at
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
  deleteResume,
};
