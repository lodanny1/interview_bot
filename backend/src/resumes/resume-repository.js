// Upload Resume (Issue #06). Database access for the resumes table.
// The table is created by backend/sql/002_create_resumes.sql.
const { createPool } = require("../db/postgres");

const COLUMNS = `
  user_id,
  s3_key,
  file_name,
  content_type,
  size_bytes,
  uploaded_at
`;

async function getResume(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM resumes WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function upsertResume({ userId, s3Key, fileName, contentType, sizeBytes }) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO resumes (user_id, s3_key, file_name, content_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
          s3_key = EXCLUDED.s3_key,
          file_name = EXCLUDED.file_name,
          content_type = EXCLUDED.content_type,
          size_bytes = EXCLUDED.size_bytes,
          uploaded_at = CURRENT_TIMESTAMP
        RETURNING ${COLUMNS}
      `,
      [userId, s3Key, fileName, contentType, sizeBytes]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

// Returns the removed row, or null if there was none.
async function deleteResume(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `DELETE FROM resumes WHERE user_id = $1 RETURNING ${COLUMNS}`,
      [userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

module.exports = {
  getResume,
  upsertResume,
  deleteResume,
};
