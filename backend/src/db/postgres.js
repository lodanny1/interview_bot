require("dotenv").config();

const { Pool } = require("pg");
const { Signer } = require("@aws-sdk/rds-signer");
const { fromIni } = require("@aws-sdk/credential-providers");

async function createPool() {
  const signerConfig = {
    region: process.env.AWS_REGION,
    hostname: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
  };

  // Use the local SSO profile when AWS_PROFILE is set.
  // In ECS, AWS_PROFILE will not be set, so the SDK will use the task role.
  if (process.env.AWS_PROFILE) {
    signerConfig.credentials = fromIni({
      profile: process.env.AWS_PROFILE,
    });
  }

  const signer = new Signer(signerConfig);
  const token = await signer.getAuthToken();

  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: token,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 5,
  });
}

module.exports = {
  createPool,
};
