// Tests GET /me/interview-insights over real HTTP with fake auth and a fake
// target job store; the knowledge base is the real committed content unless a
// test swaps it.
const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const express = require("express");

const fs = require("node:fs");

const { buildKnowledgeBase, loadKnowledgeBase } = require("./knowledge-base");
const { createKnowledgeRouter } = require("./knowledge-routes");
const { OUTPUT: FRONTEND_FIXTURE, captureInsights } = require("../../scripts/capture-insights-fixture");

const realKnowledgeBase = loadKnowledgeBase({ logger: null });

const AMAZON_JOB = {
  user_id: "user-1",
  job_title: "Software Development Engineer Intern",
  company: "Amazon",
  description: "PRIVATE-DESCRIPTION Write Java code and debug issues with a mentor on an internship project.",
  updated_at: "2026-11-01T10:00:00.000Z",
};

const UNCOVERED_JOB = {
  user_id: "user-2",
  job_title: "Data Analyst",
  company: "Riverbend Credit Union",
  description: "Write SQL, build Tableau dashboards and analyze experiments for the lending team.",
  updated_at: "2026-11-01T11:00:00.000Z",
};

describe("interview insights route", () => {
  let server;
  let baseUrl;
  let jobs;
  let auth;
  let knowledgeBase;
  let failDatabase;
  let errors;
  let requestedUserIds;

  before(async () => {
    const app = express();

    app.use(
      createKnowledgeRouter({
        requireActiveUser: async (req) => auth(req),
        getTargetJob: async (userId) => {
          requestedUserIds.push(userId);

          if (failDatabase) throw new Error("connection refused");

          return jobs.get(userId) || null;
        },
        getKnowledgeBase: () => knowledgeBase,
        logger: { error: (...args) => errors.push(args.join(" ")) },
      })
    );

    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    jobs = new Map([
      ["user-1", AMAZON_JOB],
      ["user-2", UNCOVERED_JOB],
    ]);
    // The user comes from the token, here a fake "x-user" header.
    auth = (req) =>
      req.headers["x-user"]
        ? { ok: true, user: { id: req.headers["x-user"] } }
        : { ok: false, status: 401, error: "Authentication failed" };
    knowledgeBase = realKnowledgeBase;
    failDatabase = false;
    errors = [];
    requestedUserIds = [];
  });

  async function get(user, query = "") {
    const response = await fetch(`${baseUrl}/me/interview-insights${query}`, {
      headers: user ? { "x-user": user } : {},
    });

    return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
  }

  it("requires a signed-in active user and never caches", async () => {
    const signedOut = await get(null);

    assert.equal(signedOut.status, 401);
    assert.equal(signedOut.cache, "private, no-store");
    assert.equal(requestedUserIds.length, 0);

    auth = () => ({ ok: false, status: 403, error: "Account is disabled" });
    assert.equal((await get("user-1")).status, 403);
  });

  it("returns ready insights for a covered company and role, with sources", async () => {
    const { status, cache, body } = await get("user-1");
    const { insights } = body;

    assert.equal(status, 200);
    assert.equal(cache, "private, no-store");
    assert.equal(body.status, "ready");
    assert.deepEqual(insights.basis, { focusArea: "mixed", roleLevel: null });
    assert.deepEqual(insights.targetJob, {
      jobTitle: "Software Development Engineer Intern",
      company: "Amazon",
      updatedAt: "2026-11-01T10:00:00.000Z",
    });
    assert.equal(insights.coverage.company.status, "matched");
    assert.equal(insights.coverage.company.title, "Amazon");
    assert.equal(insights.coverage.role.title, "Software engineering");
    assert.equal(insights.coverage.industry.matchedBy, "company");
    assert.deepEqual(
      insights.groups.map((group) => group.kind),
      ["company", "role", "framework", "industry"]
    );

    const amazon = insights.groups[0];
    assert.ok(amazon.notes.some((note) => note.id === "company.amazon#leadership-principles" && note.text.includes("Customer Obsession")));
    // No seniority filter: level-specific notes are left out.
    assert.ok(!amazon.notes.some((note) => note.id === "company.amazon#student-sde"));

    // Sources are exactly those of the included notes.
    const noteSources = new Set(insights.groups.flatMap((group) => group.notes.flatMap((note) => note.sources)));
    assert.deepEqual(new Set(insights.sources.map((source) => source.url)), noteSources);
    assert.ok(insights.sources.every((source) => source.reviewed === "2026-11-01"));
    assert.match(insights.version, /^kb-[0-9a-f]{12}$/);

    // The saved description is private input, not part of the response.
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE-DESCRIPTION/);
  });

  it("returns partial insights without company notes for an uncovered company", async () => {
    const { body } = await get("user-2");

    assert.equal(body.status, "partial");
    assert.equal(body.insights.coverage.company.status, "not_found");
    assert.equal(body.insights.coverage.company.name, "Riverbend Credit Union");
    assert.equal(body.insights.coverage.company.title, null);
    assert.equal(body.insights.coverage.role.title, "Data analytics and data science");
    assert.ok(body.insights.groups.every((group) => group.kind !== "company"));
  });

  it("keeps users apart: each request reads only the signed-in user's job", async () => {
    const first = await get("user-1");
    const second = await get("user-2");

    assert.deepEqual(requestedUserIds, ["user-1", "user-2"]);
    assert.equal(first.body.insights.targetJob.company, "Amazon");
    assert.equal(second.body.insights.targetJob.company, "Riverbend Credit Union");

    // A user id in the query string is ignored.
    await get("user-1", "?userId=user-2");
    assert.equal(requestedUserIds[2], "user-1");
  });

  it("reports a missing target job as no_target_job", async () => {
    const { status, body } = await get("user-3");

    assert.equal(status, 200);
    assert.deepEqual(body, { status: "no_target_job" });
  });

  it("reports a database failure as a 503 error, distinct from a missing job", async () => {
    failDatabase = true;

    const { status, cache, body } = await get("user-1");

    assert.equal(status, 503);
    assert.equal(cache, "private, no-store");
    assert.deepEqual(body, {
      status: "error",
      code: "target_job_unavailable",
      error: "Unable to load your target job",
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /connection refused/);
  });

  it("reports an unusable knowledge base as unavailable while keeping the job summary", async () => {
    knowledgeBase = buildKnowledgeBase([]);

    const { status, body } = await get("user-1");

    assert.equal(status, 200);
    assert.deepEqual(body, {
      status: "unavailable",
      targetJob: { jobTitle: "Software Development Engineer Intern", company: "Amazon" },
    });
  });

  it("gives the same insights on a return visit and new ones after the job is edited", async () => {
    const first = await get("user-1");
    const returnVisit = await get("user-1");

    assert.deepEqual(returnVisit.body, first.body);

    jobs.set("user-1", { ...AMAZON_JOB, company: "Capital One", updated_at: "2026-11-02T09:00:00.000Z" });

    const edited = await get("user-1");

    assert.equal(edited.body.insights.coverage.company.title, "Capital One");
    assert.notDeepEqual(edited.body, first.body);
  });
});

// The frontend parses a committed copy of real responses. Values may drift as
// content changes; the shape must not. Regenerate with
// `node scripts/capture-insights-fixture.js` after a deliberate change.
function shapeOf(value) {
  if (Array.isArray(value)) return value.length > 0 ? [shapeOf(value[0])] : [];
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, shapeOf(value[key])])
  );
}

it("matches the response shape the frontend tests were written against", async () => {
  const committed = JSON.parse(fs.readFileSync(FRONTEND_FIXTURE, "utf8"));
  const current = await captureInsights();

  for (const key of ["ready", "partial", "noTargetJob"]) {
    assert.deepEqual(shapeOf(current[key]), shapeOf(committed[key]), key);
  }
});
