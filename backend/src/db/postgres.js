require("dotenv").config();

const { Pool } = require("pg");
const { Signer } = require("@aws-sdk/rds-signer");

async function createPool() {
  const signer = new Signer({
    region: process.env.AWS_REGION,
    hostname: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
  });

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
