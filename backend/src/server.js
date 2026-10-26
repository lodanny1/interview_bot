require("dotenv").config();

const { createPool } = require("./db/postgres");
const express = require("express");

const { verifyIdToken } = require("./auth/verify-id-token");
const { getOrCreateUser } = require("./users/user-repository");
const {
  getUserProfile,
  upsertUserProfile,
} = require("./users/user-profile-repository");
const {
  validateUserSetup,
  isSetupComplete,
} = require("./users/user-setup");
const { requireActiveUser } = require("./auth/require-active-user");
const {
  validateTargetJob,
} = require("./target-jobs/target-job-validation");
const {
  getTargetJob,
  upsertTargetJob,
  deleteTargetJob,
} = require("./target-jobs/target-job-repository");

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

app.patch("/me/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing authentication token",
      });
    }

    const idToken = authHeader.slice("Bearer ".length);

    const payload = await verifyIdToken(idToken);

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

    const {
      fullName,
      role,
    } = req.body;

    if (
      typeof fullName !== "string" ||
      !fullName.trim()
    ) {
      return res.status(400).json({
        error: "Full name is required",
      });
    }

    if (typeof role !== "string") {
      return res.status(400).json({
        error: "Role must be a string",
      });
    }

    const existingProfile =
      await getUserProfile(user.id);

    const pool = await createPool();

    try {
      await pool.query(
        `
        UPDATE public.users
        SET display_name = $1
        WHERE id = $2
        `,
        [fullName.trim(), user.id]
      );
    } finally {
      await pool.end();
    }

    const profile = await upsertUserProfile({
      userId: user.id,
      targetRole: role.trim() || null,

      targetCompany:
        existingProfile?.target_company ?? null,

      experienceLevel:
        existingProfile?.experience_level ?? null,

      focusAreas:
        existingProfile?.focus_areas ?? null,

      bio:
        existingProfile?.bio ?? null,
    });

    return res.json({
      user: {
        ...user,
        display_name: fullName.trim(),
      },
      profile,
    });
  } catch (error) {
    console.error("PATCH /me/profile failed:", error);

    return res.status(500).json({
      error: "Unable to update profile",
    });
  }
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
      setupCompleted: isSetupComplete(profile),
    });
  } catch (error) {
    console.error("GET /me failed:", error);

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
});

// Complete User Setup (Issue #05). Saves the personalization fields from the
// setup page. Required: targetRole, experienceLevel, focusAreas.
app.put("/me/setup", async (req, res) => {
  let user;

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.substring("Bearer ".length);
    const payload = await verifyIdToken(token);

    user = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
    });
  } catch (error) {
    console.error("PUT /me/setup auth failed:", error);

    return res.status(401).json({
      error: "Authentication failed",
    });
  }

  if (user.account_status !== "ACTIVE") {
    return res.status(403).json({
      error: "Account is disabled",
    });
  }

  const validation = validateUserSetup(req.body);

  if (!validation.ok) {
    return res.status(400).json({
      error: "Some setup information is missing or invalid",
      fieldErrors: validation.fieldErrors,
    });
  }

  try {
    const profile = await upsertUserProfile({
      userId: user.id,
      ...validation.data,
    });

    return res.status(200).json({
      profile,
      setupCompleted: isSetupComplete(profile),
    });
  } catch (error) {
    console.error("PUT /me/setup failed:", error);

    return res.status(500).json({
      error: "Unable to save setup information",
    });
  }
});

// Add Target Job Description (Issue #09). One target job per user.
app.get("/me/target-job", async (req, res) => {
  const auth = await requireActiveUser(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const targetJob = await getTargetJob(auth.user.id);

    return res.status(200).json({ targetJob });
  } catch (error) {
    console.error("GET /me/target-job failed:", error);

    return res.status(500).json({
      error: "Unable to load target job",
    });
  }
});

app.put("/me/target-job", async (req, res) => {
  const auth = await requireActiveUser(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const validation = validateTargetJob(req.body);

  if (!validation.ok) {
    return res.status(400).json({
      error: "Some target job information is missing or invalid",
      fieldErrors: validation.fieldErrors,
    });
  }

  try {
    const targetJob = await upsertTargetJob({
      userId: auth.user.id,
      ...validation.data,
    });

    return res.status(200).json({ targetJob });
  } catch (error) {
    console.error("PUT /me/target-job failed:", error);

    return res.status(500).json({
      error: "Unable to save target job",
    });
  }
});

app.delete("/me/target-job", async (req, res) => {
  const auth = await requireActiveUser(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    await deleteTargetJob(auth.user.id);

    return res.status(204).end();
  } catch (error) {
    console.error("DELETE /me/target-job failed:", error);

    return res.status(500).json({
      error: "Unable to remove target job",
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