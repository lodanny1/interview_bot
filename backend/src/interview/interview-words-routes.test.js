// Route tests for word timing. Runs with `node --test`; no database or AI needed.
// Uses the real router with fake dependencies, on a throwaway local port.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { createInterviewRouter } = require("./interview-routes");

const words = [
  { text: "hello", start: 0.1, end: 0.4 },
  { text: "world", start: 0.5, end: 0.9 },
];

async function startServer() {
  const added = [];

  const repository = {
    getInterviewSession: async () => ({
      id: "s1",
      status: "ACTIVE",
      role_level: "Senior",
      focus_area: "Behavioral",
    }),
    addInterviewMessage: async (args) => {
      added.push(args);
      return {
        id: `m${added.length}`,
        role: args.role,
        content: args.content,
        created_at: "2026-11-15T00:00:00Z",
        ...(args.words ? { words: args.words } : {}),
      };
    },
    getInterviewMessages: async () => [
      { id: "1", role: "interviewer", content: "Q?", created_at: "2026-11-15T00:00:00Z" },
      {
        id: "2",
        role: "candidate",
        content: "A",
        created_at: "2026-11-15T00:01:00Z",
        words: [{ text: "A", start: 0, end: 0.2 }],
      },
    ],
    getInterviewTimeState: async () => ({ expired: false }),
  };

  const router = createInterviewRouter({
    requireActiveUser: async () => ({ ok: true, user: { id: "u1" } }),
    repository,
    aiService: { generateFollowUpQuestion: async () => ({ text: "Next question?" }) },
    logger: { error() {} },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  return {
    base: `http://127.0.0.1:${server.address().port}`,
    added,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}

async function postMessage(base, body) {
  const response = await fetch(`${base}/interviews/s1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

describe("interview word timing routes", () => {
  it("POST with valid words stores them and echoes them back", async () => {
    const server = await startServer();
    try {
      const { status, json } = await postMessage(server.base, {
        content: "hello world",
        words,
      });

      assert.equal(status, 201);
      assert.deepEqual(server.added[0], {
        sessionId: "s1",
        role: "candidate",
        content: "hello world",
        words,
      });
      assert.deepEqual(json.messages[0].words, words);
      assert.equal("words" in json.messages[1], false);
    } finally {
      await server.close();
    }
  });

  it("POST without words behaves exactly as before", async () => {
    const server = await startServer();
    try {
      const { status, json } = await postMessage(server.base, { content: "just text" });

      assert.equal(status, 201);
      assert.deepEqual(server.added[0], {
        sessionId: "s1",
        role: "candidate",
        content: "just text",
      });
      assert.equal("words" in json.messages[0], false);
    } finally {
      await server.close();
    }
  });

  it("POST with invalid words still saves the answer, without words", async () => {
    const server = await startServer();
    try {
      const { status } = await postMessage(server.base, {
        content: "hi",
        words: [{ text: "x", start: 5, end: 1 }],
      });

      assert.equal(status, 201);
      assert.deepEqual(server.added[0], {
        sessionId: "s1",
        role: "candidate",
        content: "hi",
      });
    } finally {
      await server.close();
    }
  });

  it("GET /interviews/:id returns words on candidate messages that have them", async () => {
    const server = await startServer();
    try {
      const response = await fetch(`${server.base}/interviews/s1`);
      const json = await response.json();

      assert.equal(response.status, 200);
      assert.equal("words" in json.session.messages[0], false);
      assert.deepEqual(json.session.messages[1].words, [{ text: "A", start: 0, end: 0.2 }]);
    } finally {
      await server.close();
    }
  });
});
