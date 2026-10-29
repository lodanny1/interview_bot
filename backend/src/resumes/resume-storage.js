// Upload Resume (Issue #06). Stores resume files in a private S3 bucket.
// Needs RESUME_BUCKET and AWS_REGION. Credentials work like the database:
// the local SSO profile when AWS_PROFILE is set, otherwise the ECS task role.
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { fromIni } = require("@aws-sdk/credential-providers");

let client = null;

function getClient() {
  if (!client) {
    const config = { region: process.env.AWS_REGION };

    if (process.env.AWS_PROFILE) {
      config.credentials = fromIni({ profile: process.env.AWS_PROFILE });
    }

    client = new S3Client(config);
  }

  return client;
}

function bucket() {
  const name = process.env.RESUME_BUCKET;

  if (!name) {
    throw new Error("RESUME_BUCKET is not configured.");
  }

  return name;
}

async function putResumeObject({ key, body, contentType }) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  );
}

// Returns { body, contentType, contentLength }. body is a Node.js stream.
async function getResumeObject(key) {
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key })
  );

  return {
    body: result.Body,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}

async function deleteResumeObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = {
  putResumeObject,
  getResumeObject,
  deleteResumeObject,
};
