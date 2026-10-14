require("dotenv").config();

const { CognitoJwtVerifier } = require("aws-jwt-verify");

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID,
});

async function verifyIdToken(token) {
  if (!token) {
    throw new Error("ID token is required");
  }

  const payload = await verifier.verify(token);

  return payload;
}

module.exports = {
  verifyIdToken,
};
