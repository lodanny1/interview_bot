// Tests the resume review routes over real HTTP with fake auth and database.

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { createResumeReviewRouter } = require("./resume-review-routes");

const USER = { id: "user-1" };
const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USERS_RESUME_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "sk-ant-internal-detail";

const EXTRACTED = {
  name: "Jordan Lee",
  email: null,
  skills: ["Python", "AWS"],
  education: [
    { institution: null, degree: null, field: null, startDate: null, endDate: null },
  ],
  experience: [
    {
      company: "Acme",
      role: "Software Intern",
      startDate: "2023",
      endDate: "2024",
      description: ["Built REST APIs"],
    },
  ],
  projects: [],
  certifications: [],
};

const REVIEWED = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "",
  location: "",
  summary: "",
  skills: ["Python", "AWS", "Docker"],
  certifications: [],
  education: [],
  experience: [
    {
      company: "Acme",
      role: "Software Engineering Intern",
      startDate: "2023",
      endDate: "2024",
      description: ["Built REST APIs"],
    },
  ],
  projects: [],
};

function resumeRow(overrides = {}) {
  return {
    id: RESUME_ID,
    user_id: USER.id,
    file_name: "My Resume.pdf",
    parse_status: "COMPLETED",
    parsed_json: EXTRACTED,
    parsed_text: `Resume text ${SECRET}`,
    parse_error: null,
    reviewed_json: null,
    reviewed_at: null,
    ...overrides,
  };
}

function fakeRepository() {
  const rows = new Map();

  return {
    rows,
    fail: false,

    async getResumeReview(userId, resumeId) {
      if (this.fail) throw new Error(`db down ${SECRET}`);

      const row = rows.get(resumeId);
      return row && row.user_id === userId ? row : null;
    },

    async saveResumeReview({ userId, resumeId, reviewedJson }) {
      if (this.fail) throw new Error(`db down ${SECRET}`);

      const row = rows.get(resumeId);

      if (!row || row.user_id !== userId || row.parse_status !== "COMPLETED") {
        return null;
      }

      row.reviewed_json = reviewedJson;
      row.reviewed_at = "2026-11-02T10:00:00.000Z";

      return row;
    },
  };
}

describe("resume review routes", () => {
  let server;
  let baseUrl;
  let repository;
  let signedIn;

  before(async () => {
    const app = express();
    app.use(express.json());

    app.use(
      createResumeReviewRouter({
        requireActiveUser: async () =>
          signedIn
            ? { ok: true, user: USER }
            : { ok: false, status: 401, error: "Authentication failed" },

        repository: {
          getResumeReview: (...args) => repository.getResumeReview(...args),
          saveResumeReview: (...args) => repository.saveResumeReview(...args),
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
    repository.rows.set(RESUME_ID, resumeRow());

    repository.rows.set(
      OTHER_USERS_RESUME_ID,
      resumeRow({ id: OTHER_USERS_RESUME_ID, user_id: "user-2" })
    );

    signedIn = true;
  });

  const getReview = (id = RESUME_ID) =>
    fetch(`${baseUrl}/me/resumes/${id}/review`);

  const putReview = (body, id = RESUME_ID) =>
    fetch(`${baseUrl}/me/resumes/${id}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  function setRow(overrides) {
    repository.rows.set(RESUME_ID, resumeRow(overrides));
  }

  it("returns extracted information that is ready to review", async () => {
    const response = await getReview();

    assert.equal(response.status, 200);

    const { review } = await response.json();

    assert.equal(review.resumeId, RESUME_ID);
    assert.equal(review.fileName, "My Resume.pdf");
    assert.equal(review.status, "ready");
    assert.equal(review.reviewedAt, null);
    assert.deepEqual(review.data.skills, ["Python", "AWS"]);

    // The AI's all-null example entry is not shown as an entry to review.
    assert.deepEqual(review.data.education, []);
  });

  it("reports each extraction state without data to review", async () => {
    for (const [overrides, status] of [
      [{ parse_status: "PENDING", parsed_json: null }, "not_extracted"],
      [{ parse_status: "PROCESSING", parsed_json: null }, "processing"],
      [{ parse_status: "FAILED", parsed_json: null }, "failed"],
    ]) {
      setRow(overrides);

      const { review } = await (await getReview()).json();

      assert.equal(review.status, status);
      assert.equal(review.data, null);
    }
  });

  it("does not treat completed but unusable output as ready", async () => {
    for (const parsedJson of [{}, [], null, { name: "Jordan Lee" }]) {
      setRow({ parsed_json: parsedJson });

      const { review } = await (await getReview()).json();

      assert.equal(review.status, "failed");
      assert.equal(review.data, null);
    }
  });

  it("never sends parse errors, extracted text or raw failure details", async () => {
    setRow({
      parse_status: "FAILED",
      parse_error: `Anthropic request failed: ${SECRET}`,
    });

    const failed = await getReview();
    const text = await failed.text();

    assert.equal(failed.status, 200);
    assert.doesNotMatch(text, new RegExp(SECRET));
    assert.doesNotMatch(text, /parse_?[eE]rror|parsed_?[tT]ext/);

    repository.fail = true;

    const unavailable = await getReview();

    assert.equal(unavailable.status, 500);
    assert.equal((await unavailable.json()).code, "unavailable");
  });

  it("returns the reviewed information once confirmed", async () => {
    setRow({
      reviewed_json: { ...REVIEWED, phone: "555-123-4567" },
      reviewed_at: "2026-11-02T10:00:00.000Z",
    });

    const { review } = await (await getReview()).json();

    assert.equal(review.status, "reviewed");
    assert.equal(review.reviewedAt, "2026-11-02T10:00:00.000Z");
    assert.equal(review.data.phone, "555-123-4567");
  });

  it("returns 404 for a missing, malformed or other user's resume", async () => {
    for (const id of [
      "33333333-3333-4333-8333-333333333333",
      "not-a-uuid",
      OTHER_USERS_RESUME_ID,
    ]) {
      const response = await getReview(id);

      assert.equal(response.status, 404);
      assert.equal((await response.json()).code, "not_found");
      assert.equal((await putReview(REVIEWED, id)).status, 404);
    }
  });

  it("saves confirmed information without changing the extraction", async () => {
    const response = await putReview(REVIEWED);

    assert.equal(response.status, 200);

    const { review } = await response.json();

    assert.equal(review.status, "reviewed");
    assert.equal(review.reviewedAt, "2026-11-02T10:00:00.000Z");
    assert.equal(review.data.experience[0].role, "Software Engineering Intern");

    const row = repository.rows.get(RESUME_ID);

    assert.equal(row.reviewed_json.phone, null);
    assert.deepEqual(row.reviewed_json.skills, ["Python", "AWS", "Docker"]);
    assert.deepEqual(row.parsed_json, EXTRACTED);
  });

  it("rejects missing or invalid information without saving", async () => {
    const response = await putReview({
      ...REVIEWED,
      name: "",
      email: "jordan@",
      experience: [{ company: "Acme", role: "" }],
    });

    assert.equal(response.status, 400);

    const body = await response.json();

    assert.equal(body.code, "invalid");
    assert.ok(body.fieldErrors.name);
    assert.ok(body.fieldErrors.email);
    assert.ok(body.fieldErrors["experience.0.role"]);
    assert.equal(repository.rows.get(RESUME_ID).reviewed_json, null);
  });

  it("only saves a review for a successfully extracted resume", async () => {
    for (const parseStatus of ["PENDING", "PROCESSING", "FAILED"]) {
      setRow({ parse_status: parseStatus });

      const response = await putReview(REVIEWED);

      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "not_extracted");
      assert.equal(repository.rows.get(RESUME_ID).reviewed_json, null);
    }
  });

  it("reports a database failure without details", async () => {
    repository.fail = true;

    const response = await putReview(REVIEWED);
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.match(text, /"code":"unavailable"/);
    assert.doesNotMatch(text, new RegExp(SECRET));
  });

  it("requires sign-in", async () => {
    signedIn = false;

    assert.equal((await getReview()).status, 401);
    assert.equal((await putReview(REVIEWED)).status, 401);
    assert.equal(repository.rows.get(RESUME_ID).reviewed_json, null);
  });
});
