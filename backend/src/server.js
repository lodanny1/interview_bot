require("dotenv").config();

const { createPool } = require("./db/postgres");
const express = require("express");

const { verifyIdToken } = require("./auth/verify-id-token");
const { getOrCreateUser } = require("./users/user-repository");
const {
  getUserProfile,
  upsertUserProfile,
} = require("./users/user-profile-repository");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "interview-bot-backend",
  });
});

app.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.substring("Bearer ".length);

    const payload = await verifyIdToken(token);

    const user = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
    });

    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: "Account is not active",
      });
    }

    const profile = await getUserProfile(user.id);

    return res.status(200).json({
      user,
      profile,
    });
  } catch (error) {
    console.error("GET /me failed:", error);

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
});

app.post("/auth/sync-user", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.substring("Bearer ".length);

    const payload = await verifyIdToken(token);

    const user = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
  });

  if (user.account_status !== "ACTIVE") {
    return res.status(403).json({
      error: "Account is disabled",
    });
  }

  let profile = await getUserProfile(user.id);

    if (req.body?.targetRole) {
      profile = await upsertUserProfile({
        userId: user.id,
        targetRole: req.body.targetRole,
        targetCompany: profile?.target_company ?? null,
        experienceLevel: profile?.experience_level ?? null,
        focusAreas: profile?.focus_areas ?? null,
        bio: profile?.bio ?? null,
      });
    }

    return res.status(200).json({
      user,
      profile,
    });
  } catch (error) {
    console.error("sync-user failed:", error);

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
});

app.get("/admin/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.substring("Bearer ".length);
    const payload = await verifyIdToken(token);

    const currentUser = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
    });

    if (currentUser.role !== "ADMIN") {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    const pool = await createPool();

    try {
      const result = await pool.query(`
        SELECT
          id,
          email,
          display_name,
          role,
          account_status,
          access_tier,
          created_at
        FROM users
        ORDER BY created_at DESC
      `);

      return res.status(200).json({
        users: result.rows,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("GET /admin/users failed:", error);

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
});

app.patch("/admin/users/:id/status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.substring("Bearer ".length);
    const payload = await verifyIdToken(token);

    const currentUser = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
    });

    if (currentUser.role !== "ADMIN") {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    const { status } = req.body;

    if (!["ACTIVE", "DISABLED"].includes(status)) {
      return res.status(400).json({
        error: "Status must be ACTIVE or DISABLED",
      });
    }

    if (currentUser.id === req.params.id && status === "DISABLED") {
      return res.status(400).json({
        error: "Administrators cannot disable their own account",
      });
    }

    const pool = await createPool();

    try {
      const result = await pool.query(
        `
          UPDATE users
          SET account_status = $1
          WHERE id = $2
          RETURNING
            id,
            email,
            display_name,
            role,
            account_status,
            access_tier,
            created_at
        `,
        [status, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      return res.status(200).json({
        user: result.rows[0],
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("PATCH /admin/users/:id/status failed:", error);

    return res.status(500).json({
      error: "Unable to update account status",
    });
  }
});

app.patch("/admin/users/:id/tier", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.substring("Bearer ".length);
    const payload = await verifyIdToken(token);

    const currentUser = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
    });

    if (currentUser.role !== "ADMIN") {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    const { tier } = req.body;

    if (!["BASIC", "PREMIUM"].includes(tier)) {
      return res.status(400).json({
        error: "Tier must be BASIC or PREMIUM",
      });
    }

    const pool = await createPool();

    try {
      const result = await pool.query(
        `
          UPDATE users
          SET access_tier = $1
          WHERE id = $2
          RETURNING
            id,
            email,
            display_name,
            role,
            account_status,
            access_tier,
            created_at
        `,
        [tier, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      return res.status(200).json({
        user: result.rows[0],
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("PATCH /admin/users/:id/tier failed:", error);

    return res.status(500).json({
      error: "Unable to update access tier",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});