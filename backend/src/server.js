require("dotenv").config();

const express = require("express");
const { verifyIdToken } = require("./auth/verify-id-token");
const { getOrCreateUser } = require("./users/user-repository");
const { upsertUserProfile } = require("./users/user-profile-repository");

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
    let profile = null;

    if (req.body?.targetRole) {
      profile = await upsertUserProfile({
        userId: user.id,
        targetRole: req.body.targetRole,
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

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
