const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { fromIni } = require("@aws-sdk/credential-providers");

let client = null;

function getClient() {
  if (!client) {
    const config = { region: process.env.AWS_REGION };

    if (process.env.AWS_PROFILE) {
      config.credentials = fromIni({
        profile: process.env.AWS_PROFILE,
      });
    }

    client = new S3Client(config);
  }

  return client;
}

function getBucket() {
  const name = process.env.INTERVIEW_AUDIO_BUCKET;

  if (!name) {
    throw new Error("INTERVIEW_AUDIO_BUCKET is not configured.");
  }

  return name;
}

async function putInterviewAudio({ key, body, contentType }) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }),
  );
}

async function deleteInterviewAudio(key) {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}

module.exports = {
  putInterviewAudio,
  deleteInterviewAudio,
};