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
  let nextId = 1;

  return {
    rows,
    failCreate: false,

    async getResumes(userId) {
      return [...rows.values()]
        .filter((row) => row.user_id === userId)
        .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    },

    async getResume(userId, resumeId) {
      const row = rows.get(resumeId);

      if (!row || row.user_id !== userId) {
        return null;
      }

      return row;
    },

    async createResume({
      userId,
      s3Key,
      fileName,
      contentType,
      sizeBytes,
    }) {
      if (this.failCreate) {
        throw new Error("db down");
      }

      const id = `resume-${nextId++}`;

      const row = {
        id,
        user_id: userId,
        s3_key: s3Key,
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_at: `2026-10-28T12:00:0${nextId}.000Z`,
      };

      rows.set(id, row);

      return row;
    },

    async deleteResume(userId, resumeId) {
      const row = rows.get(resumeId);

      if (!row || row.user_id !== userId) {
        return null;
      }

      rows.delete(resumeId);
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
      if (this.failPut) {
        throw new Error("s3 down");
      }

      objects.set(key, {
        body: Buffer.from(body),
        contentType,
      });
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
          signedIn
            ? { ok: true, user: USER }
            : {
                ok: false,
                status: 401,
                error: "Authentication failed",
              },

        repository: {
          getResumes: (...args) => repository.getResumes(...args),
          getResume: (...args) => repository.getResume(...args),
          createResume: (...args) => repository.createResume(...args),
          deleteResume: (...args) => repository.deleteResume(...args),
        },

        storage: {
          putResumeObject: (...args) => storage.putResumeObject(...args),
          getResumeObject: (...args) => storage.getResumeObject(...args),
          deleteResumeObject: (...args) => storage.deleteResumeObject(...args),
        },

        logger: {
          error() {},
        },
      })
    );

    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
      })
  );

  beforeEach(() => {
    repository = fakeRepository();
    storage = fakeStorage();
    signedIn = true;
  });

  const upload = (body, fileName = "My Resume.pdf") =>
    fetch(`${baseUrl}/me/resumes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(fileName),
      },
      body,
    });

  it("uploads a resume, stores the file in S3 and saves its details", async () => {
    const response = await upload(PDF);

    assert.equal(response.status, 201);

    const { resume } = await response.json();

    assert.equal(resume.id, "resume-1");
    assert.equal(resume.fileName, "My Resume.pdf");
    assert.equal(resume.contentType, "application/pdf");
    assert.equal(resume.sizeBytes, PDF.length);

    const row = repository.rows.get(resume.id);

    assert.match(
      row.s3_key,
      /^resumes\/user-1\/[0-9a-f-]{36}\.pdf$/
    );

    assert.deepEqual(
      storage.objects.get(row.s3_key).body,
      PDF
    );
  });

  it("returns all saved resumes", async () => {
    await upload(PDF, "first.pdf");
    await upload(PDF, "second.pdf");

    const response = await fetch(`${baseUrl}/me/resumes`);

    assert.equal(response.status, 200);

    const { resumes } = await response.json();

    assert.equal(resumes.length, 2);

    assert.deepEqual(
      resumes.map((resume) => resume.fileName),
      ["second.pdf", "first.pdf"]
    );
  });

  it("returns a saved resume file", async () => {
    const uploaded = await upload(PDF);
    const { resume } = await uploaded.json();

    const file = await fetch(
      `${baseUrl}/me/resumes/${resume.id}/file?download=1`
    );

    assert.equal(file.status, 200);

    assert.equal(
      file.headers.get("content-type"),
      "application/pdf"
    );

    assert.match(
      file.headers.get("content-disposition"),
      /^attachment; filename="My Resume.pdf"/
    );

    assert.deepEqual(
      Buffer.from(await file.arrayBuffer()),
      PDF
    );
  });

  it("returns an empty list when there are no resumes", async () => {
    const response = await fetch(`${baseUrl}/me/resumes`);

    assert.equal(response.status, 200);

    assert.deepEqual(
      await response.json(),
      { resumes: [] }
    );
  });

  it("returns 404 for a resume that does not exist", async () => {
    const response = await fetch(
      `${baseUrl}/me/resumes/resume-missing/file`
    );

    assert.equal(response.status, 404);
  });

  it("rejects invalid files without storing anything", async () => {
    const wrongType = await upload(
      PDF,
      "resume.png"
    );

    assert.equal(wrongType.status, 400);

    assert.equal(
      (await wrongType.json()).code,
      "unsupported_type"
    );

    const fake = await upload(
      Buffer.from("not a pdf"),
      "resume.pdf"
    );

    assert.equal(fake.status, 400);

    assert.equal(
      (await fake.json()).code,
      "unreadable_file"
    );

    assert.equal(storage.objects.size, 0);
    assert.equal(repository.rows.size, 0);
  });

  it("rejects files over 5 MB with a clear error", async () => {
    const response = await upload(
      Buffer.concat([
        PDF,
        Buffer.alloc(MAX_RESUME_BYTES + 2048),
      ])
    );

    assert.equal(response.status, 413);

    assert.equal(
      (await response.json()).code,
      "too_large"
    );
  });

  it("allows multiple resumes without replacing older ones", async () => {
    const firstResponse = await upload(
      PDF,
      "solutions-architect.pdf"
    );

    const first = (await firstResponse.json()).resume;

    const secondResponse = await upload(
      PDF,
      "software-developer.pdf"
    );

    const second = (await secondResponse.json()).resume;

    assert.notEqual(first.id, second.id);

    assert.equal(repository.rows.size, 2);
    assert.equal(storage.objects.size, 2);

    assert.equal(
      repository.rows.get(first.id).file_name,
      "solutions-architect.pdf"
    );

    assert.equal(
      repository.rows.get(second.id).file_name,
      "software-developer.pdf"
    );
  });

  it("reports storage failures without saving a record", async () => {
    storage.failPut = true;

    const response = await upload(PDF);

    assert.equal(response.status, 502);

    assert.equal(
      (await response.json()).code,
      "storage_unavailable"
    );

    assert.equal(repository.rows.size, 0);
  });

  it("removes the uploaded file if saving the record fails", async () => {
    repository.failCreate = true;

    const response = await upload(PDF);

    assert.equal(response.status, 500);
    assert.equal(storage.objects.size, 0);
  });

  it("removes only the requested resume and its file", async () => {
    const firstResponse = await upload(
      PDF,
      "first.pdf"
    );

    const first = (await firstResponse.json()).resume;

    const secondResponse = await upload(
      PDF,
      "second.pdf"
    );

    const second = (await secondResponse.json()).resume;

    const firstKey =
      repository.rows.get(first.id).s3_key;

    const secondKey =
      repository.rows.get(second.id).s3_key;

    const response = await fetch(
      `${baseUrl}/me/resumes/${first.id}`,
      {
        method: "DELETE",
      }
    );

    assert.equal(response.status, 204);

    assert.equal(repository.rows.has(first.id), false);
    assert.equal(repository.rows.has(second.id), true);

    assert.equal(storage.objects.has(firstKey), false);
    assert.equal(storage.objects.has(secondKey), true);
  });

  it("requires sign-in", async () => {
    signedIn = false;

    assert.equal(
      (await fetch(`${baseUrl}/me/resumes`)).status,
      401
    );

    assert.equal(
      (await upload(PDF)).status,
      401
    );

    assert.equal(storage.objects.size, 0);
  });
});