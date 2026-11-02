const { converse } = require("../ai/ai-service");

function buildResumeParserPrompt(resumeText) {
  if (typeof resumeText !== "string" || !resumeText.trim()) {
    throw new Error("resumeText is required");
  }

  return `
Extract structured information from the resume below.

Return ONLY valid JSON.

Use this exact structure:

{
  "name": null,
  "email": null,
  "phone": null,
  "location": null,
  "summary": null,
  "skills": [],
  "education": [
    {
      "institution": null,
      "degree": null,
      "field": null,
      "startDate": null,
      "endDate": null
    }
  ],
  "experience": [
    {
      "company": null,
      "role": null,
      "startDate": null,
      "endDate": null,
      "description": []
    }
  ],
  "projects": [
    {
      "name": null,
      "description": [],
      "technologies": []
    }
  ],
  "certifications": []
}

Rules:
- Do not invent information.
- Use null when a scalar value is not present.
- Use [] when a list has no entries.
- Preserve meaningful wording from the resume.
- Do not include markdown fences.
- Do not include commentary before or after the JSON.

Resume:
${resumeText.trim()}
`.trim();
}

function parseJsonResponse(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("AI parser returned an empty response.");
  }

  let cleaned = text.trim();

  // Claude may occasionally wrap otherwise valid JSON in markdown fences.
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();

  // If commentary appears around the JSON, extract the outermost object.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI parser returned invalid JSON.");
  }
}

async function parseResume(resumeText) {
  const prompt = buildResumeParserPrompt(resumeText);

  const response = await converse({
    systemPrompt:
      "You extract factual structured data from resumes. Never infer or invent missing information.",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    maxTokens: 2000,
  });

  const parsedJson = parseJsonResponse(response.text);

  return {
    parsedJson,
    usage: response.usage ?? null,
  };
}

module.exports = {
  buildResumeParserPrompt,
  parseJsonResponse,
  parseResume,
};