// Tests the resume routes over real HTTP with fake auth, storage and database.
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const express = require("express");

const { createResumeRouter } = require("./resume-routes");
const { MAX_RESUME_BYTES } = require("./resume-validation");

const PDF = Buffer.from("%PDF-1.7\n% test resume\n");
const USER = { id: "user-1" };

function fakeRepository() {
  const rows = new Map();
  return {
    rows,
    failUpsert: false,
    async getResume(userId) {
      return rows.get(userId) || null;
    },
    async upsertResume({ userId, s3Key, fileName, contentType, sizeBytes }) {
      if (this.failUpsert) throw new Error("db down");
      const row = {
        user_id: userId,
        s3_key: s3Key,
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_at: "2026-10-28T12:00:00.000Z",
      };
      rows.set(userId, row);
      return row;
    },
    async deleteResume(userId) {
      const row = rows.get(userId) || null;
      rows.delete(userId);
      return row;
    },
  };
}

function fakeStorage() {
  const objects = new Map();
  return {
    objects,
    failPut: false,
    async putResumeObject({ key, body, contentType }) {
      if (this.failPut) throw new Error("s3 down");
      objects.set(key, { body: Buffer.from(body), contentType });
    },
    async getResumeObject(key) {
      const object = objects.get(key);
      if (!object) {
        const error = new Error("missing");
        error.name = "NoSuchKey";
        throw error;
      }
      return {
        body: Readable.from([object.body]),
        contentType: object.contentType,
        contentLength: object.body.length,
      };
    },
    async deleteResumeObject(key) {
      objects.delete(key);
    },
  };
}

describe("resume routes", () => {
  let server;
  let baseUrl;
  let repository;
  let storage;
  let signedIn;

  before(async () => {
    const app = express();
    app.use(
      createResumeRouter({
        requireActiveUser: async () =>
          signedIn ? { ok: true, user: USER } : { ok: false, status: 401, error: "Authentication failed" },
        repository: {
          getResume: (...a) => repository.getResume(...a),
          upsertResume: (...a) => repository.upsertResume(...a),
          deleteResume: (...a) => repository.deleteResume(...a),
        },
        storage: {
          putResumeObject: (...a) => storage.putResumeObject(...a),
          getResumeObject: (...a) => storage.getResumeObject(...a),
          deleteResumeObject: (...a) => storage.deleteResumeObject(...a),
        },
        logger: { error() {} },
      })
    );
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    repository = fakeRepository();
    storage = fakeStorage();
    signedIn = true;
  });

  const upload = (body, fileName = "My Resume.pdf") =>
    fetch(`${baseUrl}/me/resume`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(fileName),
      },
      body,
    });

  it("uploads a resume, stores the file in S3 and saves its details (Scenario 1)", async () => {
    const response = await upload(PDF);
    assert.equal(response.status, 200);

    const { resume } = await response.json();
    assert.deepEqual(resume, {
      fileName: "My Resume.pdf",
      contentType: "application/pdf",
      sizeBytes: PDF.length,
      uploadedAt: "2026-10-28T12:00:00.000Z",
    });

    const row = repository.rows.get(USER.id);
    assert.match(row.s3_key, /^resumes\/user-1\/[0-9a-f-]{36}\.pdf$/);
    assert.deepEqual(storage.objects.get(row.s3_key).body, PDF);
  });

  it("returns the saved resume later, and the file itself (Scenario 4)", async () => {
    await upload(PDF);

    const details = await (await fetch(`${baseUrl}/me/resume`)).json();
    assert.equal(details.resume.fileName, "My Resume.pdf");

    const file = await fetch(`${baseUrl}/me/resume/file?download=1`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "application/pdf");
    assert.match(file.headers.get("content-disposition"), /^attachment; filename="My Resume.pdf"/);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), PDF);
  });

  it("returns null when there is no resume", async () => {
    const details = await (await fetch(`${baseUrl}/me/resume`)).json();
    assert.deepEqual(details, { resume: null });

    const file = await fetch(`${baseUrl}/me/resume/file`);
    assert.equal(file.status, 404);
  });

  it("rejects invalid files without storing anything (Scenarios 2 and 3)", async () => {
    const wrongType = await upload(PDF, "resume.png");
    assert.equal(wrongType.status, 400);
    assert.equal((await wrongType.json()).code, "unsupported_type");

    const fake = await upload(Buffer.from("not a pdf"), "resume.pdf");
    assert.equal(fake.status, 400);
    assert.equal((await fake.json()).code, "unreadable_file");

    assert.equal(storage.objects.size, 0);
    assert.equal(repository.rows.size, 0);
  });

  it("rejects files over 5 MB with a clear error", async () => {
    const response = await upload(Buffer.concat([PDF, Buffer.alloc(MAX_RESUME_BYTES + 2048)]));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "too_large");
  });

  it("replaces an earlier resume and deletes the old file", async () => {
    await upload(PDF, "old.pdf");
    const oldKey = repository.rows.get(USER.id).s3_key;

    await upload(PDF, "new.pdf");
    const newKey = repository.rows.get(USER.id).s3_key;

    assert.notEqual(newKey, oldKey);
    assert.equal(storage.objects.has(oldKey), false);
    assert.equal(storage.objects.has(newKey), true);
  });

  it("reports storage failures without saving a record", async () => {
    storage.failPut = true;
    const response = await upload(PDF);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, "storage_unavailable");
    assert.equal(repository.rows.size, 0);
  });

  it("removes the uploaded file if saving the record fails", async () => {
    repository.failUpsert = true;
    const response = await upload(PDF);
    assert.equal(response.status, 500);
    assert.equal(storage.objects.size, 0);
  });

  it("removes the resume and its file", async () => {
    await upload(PDF);
    const response = await fetch(`${baseUrl}/me/resume`, { method: "DELETE" });
    assert.equal(response.status, 204);
    assert.equal(repository.rows.size, 0);
    assert.equal(storage.objects.size, 0);
  });

  it("requires sign-in", async () => {
    signedIn = false;
    assert.equal((await fetch(`${baseUrl}/me/resume`)).status, 401);
    assert.equal((await upload(PDF)).status, 401);
    assert.equal(storage.objects.size, 0);
  });
});
