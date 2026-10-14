const { createPool } = require("../db/postgres");

async function getUserProfile(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        SELECT
          user_id,
          target_role,
          target_company,
          experience_level,
          focus_areas,
          bio,
          updated_at
        FROM user_profiles
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function upsertUserProfile({
  userId,
  targetRole = null,
  targetCompany = null,
  experienceLevel = null,
  focusAreas = null,
  bio = null,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const pool = await createPool();

  try {
    const result = await pool.query(
      `
        INSERT INTO user_profiles (
          user_id,
          target_role,
          target_company,
          experience_level,
          focus_areas,
          bio,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
          target_role = EXCLUDED.target_role,
          target_company = EXCLUDED.target_company,
          experience_level = EXCLUDED.experience_level,
          focus_areas = EXCLUDED.focus_areas,
          bio = EXCLUDED.bio,
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          user_id,
          target_role,
          target_company,
          experience_level,
          focus_areas,
          bio,
          updated_at
      `,
      [
        userId,
        targetRole,
        targetCompany,
        experienceLevel,
        focusAreas,
        bio,
      ]
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

module.exports = {
  getUserProfile,
  upsertUserProfile,
};