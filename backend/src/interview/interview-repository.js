const { createPool } = require("../db/postgres");

const SESSION_COLUMNS = `
  id,
  user_id,
  resume_id,
  goal,
  title,
  focus_area,
  mode,
  industry,
  role_level,
  experience_level,
  job_description,
  status,
  created_at,
  updated_at,
  completed_at
`;

async function createInterviewSession({
  userId,
  resumeId = null,
  goal,
  title,
  focusArea,
  mode,
  industry = null,
  roleLevel = null,
  experienceLevel = null,
  jobDescription = null,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!goal) {
    throw new Error("goal is required");
  }

  if (!title) {
    throw new Error("title is required");
  }

  if (!focusArea) {
    throw new Error("focusArea is required");
  }

  if (!mode) {
    throw new Error("mode is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO interview_sessions (
          user_id,
          resume_id,
          goal,
          title,
          focus_area,
          mode,
          industry,
          role_level,
          experience_level,
          job_description
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10
        )
        RETURNING ${SESSION_COLUMNS}
      `,
      [
        userId,
        resumeId,
        goal,
        title,
        focusArea,
        mode,
        industry,
        roleLevel,
        experienceLevel,
        jobDescription,
      ]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function getInterviewSession(userId, sessionId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM interview_sessions
        WHERE id = $1
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

async function addInterviewMessage({
  sessionId,
  role,
  content,
}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  if (role !== "interviewer" && role !== "candidate") {
    throw new Error("role must be interviewer or candidate");
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("content is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO interview_messages (
          session_id,
          role,
          content
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          session_id,
          role,
          content,
          created_at
      `,
      [
        sessionId,
        role,
        content.trim(),
      ]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function getInterviewMessages(sessionId) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          session_id,
          role,
          content,
          created_at
        FROM interview_messages
        WHERE session_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [sessionId]
    );

    return result.rows;
  } finally {
    await pool.end();
  }
}

module.exports = {
  createInterviewSession,
  getInterviewSession,
  addInterviewMessage,
  getInterviewMessages,
  completeInterviewSession,
  getInterviewTimeState,
  listInterviewSessions,
};

async function completeInterviewSession({
  userId,
  sessionId,
  reason,
}) {
  if (!userId || !sessionId || !reason) {
    throw new Error(
      "userId, sessionId, and reason are required"
    );
  }

  const allowedReasons = new Set([
    "USER_ENDED",
    "TIME_LIMIT",
    "ABANDONED",
  ]);

  if (!allowedReasons.has(reason)) {
    throw new Error(
      "Invalid interview completion reason"
    );
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        UPDATE interview_sessions
        SET
          status = $1,
          completion_reason = $2,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
          AND user_id = $4
          AND status = 'ACTIVE'
        RETURNING *
      `,
      [
        reason === "ABANDONED"
          ? "ABANDONED"
          : "COMPLETED",
        reason,
        sessionId,
        userId,
      ]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function getInterviewTimeState(
  userId,
  sessionId
) {
  if (!userId || !sessionId) {
    throw new Error(
      "userId and sessionId are required"
    );
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          status,
          started_at,
          ends_at,
          duration_minutes,
          completion_reason,
          CURRENT_TIMESTAMP >= ends_at AS expired
        FROM interview_sessions
        WHERE id = $1
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

async function listInterviewSessions(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          mode,
          industry,
          role_level,
          status,
          duration_minutes,
          started_at,
          completed_at,
          completion_reason
        FROM interview_sessions
        WHERE user_id = $1
        ORDER BY started_at DESC
      `,
      [userId]
    );

    return result.rows;
  } finally {
    await pool.end();
  }
}
