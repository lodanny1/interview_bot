const { createPool } = require("../db/postgres");

const COLUMNS = `
  id,
  user_id,
  job_title,
  company,
  description,
  created_at,
  updated_at
`;

async function listTargetJobs(userId) {
  if (!userId) throw new Error("userId is required");

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT ${COLUMNS}
        FROM target_jobs
        WHERE user_id = $1
        ORDER BY updated_at DESC
      `,
      [userId]
    );

    return result.rows;
  } finally {
    await pool.end();
  }
}

async function getTargetJob(userId) {
  const jobs = await listTargetJobs(userId);
  return jobs[0] || null;
}

async function getTargetJobById(userId, targetJobId) {
  if (!userId) throw new Error("userId is required");
  if (!targetJobId) throw new Error("targetJobId is required");

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT ${COLUMNS}
        FROM target_jobs
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [targetJobId, userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function createTargetJob({
  userId,
  jobTitle,
  company = null,
  description,
}) {
  if (!userId) throw new Error("userId is required");

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO target_jobs (
          user_id,
          job_title,
          company,
          description
        )
        VALUES ($1, $2, $3, $4)
        RETURNING ${COLUMNS}
      `,
      [userId, jobTitle, company, description]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function updateTargetJobById({ userId, targetJobId, jobTitle, company = null, description }) {
  if (!userId || !targetJobId) throw new Error("userId and targetJobId are required");
  const pool = await createPool();
  try {
    const result = await pool.query(
      `UPDATE target_jobs
       SET job_title = $3, company = $4, description = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING ${COLUMNS}`,
      [targetJobId, userId, jobTitle, company, description]
    );
    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function deleteTargetJobById(userId, targetJobId) {
  if (!userId) throw new Error("userId is required");
  if (!targetJobId) throw new Error("targetJobId is required");

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        DELETE FROM target_jobs
        WHERE id = $1
          AND user_id = $2
      `,
      [targetJobId, userId]
    );

    return result.rowCount > 0;
  } finally {
    await pool.end();
  }
}

// Legacy compatibility.
const upsertTargetJob = createTargetJob;

async function deleteTargetJob(userId) {
  if (!userId) throw new Error("userId is required");

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
  listTargetJobs,
  getTargetJob,
  getTargetJobById,
  createTargetJob,
  updateTargetJobById,
  deleteTargetJobById,

  // Legacy exports
  upsertTargetJob,
  deleteTargetJob,
};
