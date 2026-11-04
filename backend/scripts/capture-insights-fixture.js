// Role & Company Knowledge Retrieval (Issue #16). Regenerates the frontend's
// copy of real GET /me/interview-insights responses, used by the frontend
// parser tests:
//
//   node scripts/capture-insights-fixture.js
//
// Runs the real router with fake auth and fake target jobs, so no database or
// credentials are needed. knowledge-routes.test.js fails when the response
// shape no longer matches the committed file.
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const { createKnowledgeRouter } = require("../src/knowledge/knowledge-routes");

const OUTPUT = path.join(__dirname, "../../frontend/src/lib/insights/__tests__/backend-insights.json");

const JOBS = {
  covered: {
    job_title: "Software Development Engineer Intern",
    company: "Amazon",
    description: "Write Java code and debug issues with a mentor on an internship project.",
    updated_at: "2026-11-01T10:00:00.000Z",
  },
  uncovered: {
    job_title: "Data Analyst",
    company: "Riverbend Credit Union",
    description: "Write SQL, build Tableau dashboards and analyze experiments for the lending team.",
    updated_at: "2026-11-01T11:00:00.000Z",
  },
};

async function captureInsights() {
  const app = express();

  app.use(
    createKnowledgeRouter({
      requireActiveUser: async (req) => ({ ok: true, user: { id: req.headers["x-user"] } }),
      getTargetJob: async (userId) => JOBS[userId] || null,
    })
  );

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });

  try {
    const url = `http://127.0.0.1:${server.address().port}/me/interview-insights`;
    const get = async (user) => (await fetch(url, { headers: { "x-user": user } })).json();

    return {
      note: "Captured from backend/src/knowledge/knowledge-routes.js by backend/scripts/capture-insights-fixture.js.",
      ready: await get("covered"),
      partial: await get("uncovered"),
      noTargetJob: await get("nobody"),
    };
  } finally {
    server.close();
  }
}

if (require.main === module) {
  captureInsights().then((output) => {
    fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`);
  });
}

module.exports = { OUTPUT, captureInsights };
