const { createAnthropicClient } = require("./anthropic-client");

function getModelId() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("At least one conversation message is required.");
  }

  return messages.map((message) => {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new Error(
        "Each message must have a user/assistant role and non-empty content."
      );
    }

    return {
      role: message.role,
      content: message.content.trim(),
    };
  });
}

async function converse({
  messages,
  systemPrompt,
  maxTokens = 500,
}) {
  const client = createAnthropicClient();

  try {
    const response = await client.messages.create({
      model: getModelId(),
      max_tokens: maxTokens,
      system:
        typeof systemPrompt === "string" && systemPrompt.trim()
          ? systemPrompt.trim()
          : undefined,
      messages: normalizeMessages(messages),
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("AI service returned no text response.");
    }

    return {
      text,
      stopReason: response.stop_reason ?? null,
      usage: response.usage ?? null,
    };
  } catch (error) {
    console.error("Anthropic AI request failed:", error);

    throw new Error("AI service is temporarily unavailable.");
  }
}

async function generateText({
  prompt,
  systemPrompt,
  maxTokens,
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
  });
}

module.exports = {
  converse,
  generateText,
};
