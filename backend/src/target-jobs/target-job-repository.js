// Add Target Job Description (Issue #09). Database access for target_jobs.
// The table is created by backend/sql/001_create_target_jobs.sql.
const { createPool } = require("../db/postgres");

const COLUMNS = `
  user_id,
  job_title,
  company,
  description,
  created_at,
  updated_at
`;

async function getTargetJob(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM target_jobs WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function upsertTargetJob({ userId, jobTitle, company = null, description }) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO target_jobs (user_id, job_title, company, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          job_title = EXCLUDED.job_title,
          company = EXCLUDED.company,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP
        RETURNING ${COLUMNS}
      `,
      [userId, jobTitle, company, description]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

// Returns true if a row was removed.
async function deleteTargetJob(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      "DELETE FROM target_jobs WHERE user_id = $1",
      [userId]
    );

    return result.rowCount > 0;
  } finally {
    await pool.end();
  }
}

module.exports = {
  getTargetJob,
  upsertTargetJob,
  deleteTargetJob,
};
