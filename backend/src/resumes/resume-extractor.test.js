const assert = require("node:assert/strict");
const test = require("node:test");
const { Readable } = require("node:stream");

const {
  streamToBuffer,
  extractResumeText,
} = require("./resume-extractor");

test("streamToBuffer converts a readable stream into a Buffer", async () => {
  const stream = Readable.from([
    Buffer.from("Hello "),
    Buffer.from("resume"),
  ]);

  const result = await streamToBuffer(stream);

  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.toString("utf8"), "Hello resume");
});

test("streamToBuffer rejects when no stream is provided", async () => {
  await assert.rejects(
    () => streamToBuffer(null),
    /Resume file stream is required/
  );
});

test("extractResumeText rejects an empty file", async () => {
  const stream = Readable.from([]);

  await assert.rejects(
    () =>
      extractResumeText({
        body: stream,
        contentType: "application/pdf",
      }),
    /Resume file is empty/
  );
});

test("extractResumeText rejects unsupported file types", async () => {
  const stream = Readable.from([
    Buffer.from("plain text resume"),
  ]);

  await assert.rejects(
    () =>
      extractResumeText({
        body: stream,
        contentType: "text/plain",
      }),
    /Unsupported resume content type/
  );
});