// Shared check for routes that need a signed-in, active user.
// Returns { ok: true, user } or { ok: false, status, error } for the route to send.
const { verifyIdToken } = require("./verify-id-token");
const { getOrCreateUser } = require("../users/user-repository");

async function requireActiveUser(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Missing or invalid Authorization header",
    };
  }

  let user;

  try {
    const payload = await verifyIdToken(authHeader.substring("Bearer ".length));

    user = await getOrCreateUser({
      cognitoSub: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
    });
  } catch (error) {
    console.error("Authentication failed:", error);
    return { ok: false, status: 401, error: "Authentication failed" };
  }

  if (user.account_status !== "ACTIVE") {
    return { ok: false, status: 403, error: "Account is disabled" };
  }

  return { ok: true, user };
}

module.exports = {
  requireActiveUser,
};
