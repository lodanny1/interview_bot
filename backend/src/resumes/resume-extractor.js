const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

async function streamToBuffer(stream) {
  if (!stream) {
    throw new Error("Resume file stream is required.");
  }

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    const text = result.text?.trim();

    if (!text) {
      throw new Error("No readable text was found in the PDF.");
    }

    return text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({
    buffer,
  });

  const text = result.value?.trim();

  if (!text) {
    throw new Error("No readable text was found in the DOCX file.");
  }

  return text;
}

async function extractResumeText({
  body,
  contentType,
}) {
  const buffer = await streamToBuffer(body);

  if (!buffer.length) {
    throw new Error("Resume file is empty.");
  }

  switch (contentType) {
    case "application/pdf":
      return extractPdfText(buffer);

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocxText(buffer);

    default:
      throw new Error(
        `Unsupported resume content type: ${contentType || "unknown"}`
      );
  }
}

module.exports = {
  streamToBuffer,
  extractPdfText,
  extractDocxText,
  extractResumeText,
};