const crypto = require("crypto");
const { createPool } = require("../db/postgres");

async function getOrCreateUser({
  cognitoSub,
  email,
  displayName = null,
}) {
  if (!cognitoSub) {
    throw new Error("cognitoSub is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  const pool = await createPool();

  try {
    // First try to find an existing user by Cognito identity.
    const existingUser = await pool.query(
      `
        SELECT
          id,
          email,
          display_name,
          approval_status,
          access_tier,
          cognito_sub,
          created_at
        FROM users
        WHERE cognito_sub = $1
        LIMIT 1
      `,
      [cognitoSub]
    );

    if (existingUser.rows.length > 0) {
      return existingUser.rows[0];
    }

    // If this is the user's first authenticated visit,
    // create their application-level user record.
    const userId = crypto.randomUUID();

    const newUser = await pool.query(
      `
        INSERT INTO users (
          id,
          email,
          display_name,
          cognito_sub
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          email,
          display_name,
          approval_status,
          access_tier,
          cognito_sub,
          created_at
      `,
      [userId, email, displayName, cognitoSub]
    );

    return newUser.rows[0];
  } finally {
    await pool.end();
  }
}

module.exports = {
  getOrCreateUser,
};
