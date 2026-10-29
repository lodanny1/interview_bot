const {
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const {
  createBedrockClient,
} = require("./bedrock-client");

function getModelId() {
  const modelId = process.env.BEDROCK_MODEL_ID;

  if (!modelId) {
    throw new Error(
      "BEDROCK_MODEL_ID is not configured."
    );
  }

  return modelId;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error(
      "At least one conversation message is required."
    );
  }

  return messages.map((message) => {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new Error(
        "Each message must have role user/assistant and non-empty content."
      );
    }

    return {
      role: message.role,
      content: [
        {
          text: message.content.trim(),
        },
      ],
    };
  });
}

async function converse({
  messages,
  systemPrompt,
  maxTokens = 500,
  temperature = 0.4,
}) {
  const client = createBedrockClient();

  const input = {
    modelId: getModelId(),

    messages: normalizeMessages(messages),

    inferenceConfig: {
      maxTokens,
      temperature,
    },
  };

  if (
    typeof systemPrompt === "string" &&
    systemPrompt.trim()
  ) {
    input.system = [
      {
        text: systemPrompt.trim(),
      },
    ];
  }

  try {
    const response = await client.send(
      new ConverseCommand(input)
    );

    const content =
      response.output?.message?.content ?? [];

    const text = content
      .filter((item) => typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error(
        "AI service returned no text response."
      );
    }

    return {
      text,
      stopReason: response.stopReason ?? null,
      usage: response.usage ?? null,
    };
  } catch (error) {
    console.error("Bedrock AI request failed:", error);

    throw new Error(
      "AI service is temporarily unavailable."
    );
  }
}

async function generateText({
  prompt,
  systemPrompt,
  maxTokens,
  temperature,
}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  return converse({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    systemPrompt,
    maxTokens,
    temperature,
  });
}

module.exports = {
  converse,
  generateText,
};
