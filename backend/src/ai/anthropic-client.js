const Anthropic = require("@anthropic-ai/sdk");

function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  return new Anthropic({
    apiKey,
  });
}

module.exports = {
  createAnthropicClient,
};
