const {
  BedrockRuntimeClient,
} = require("@aws-sdk/client-bedrock-runtime");

function createBedrockClient() {
  const region =
    process.env.BEDROCK_REGION ||
    process.env.AWS_REGION ||
    "us-west-2";

  return new BedrockRuntimeClient({
    region,
  });
}

module.exports = {
  createBedrockClient,
};
