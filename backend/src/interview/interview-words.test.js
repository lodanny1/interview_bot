// Repository tests for word timing. Runs with `node --test`; no database needed.
// The database module is replaced before the repository loads, so the real
// AWS/Postgres connection is never touched.
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const calls = [];
let ended = 0;

const fakePool = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "m1" }] };
  },
  end: async () => {
    ended += 1;
  },
};

const postgresPath = require.resolve("../db/postgres");
require.cache[postgresPath] = {
  id: postgresPath,
  filename: postgresPath,
  loaded: true,
  exports: { createPool: async () => fakePool },
};

const { addInterviewMessage, getInterviewMessages } = require("./interview-repository");

const words = [
  { text: "hello", start: 0.1, end: 0.4 },
  { text: "world", start: 0.5, end: 0.9 },
];

beforeEach(() => {
  calls.length = 0;
  ended = 0;
});

describe("addInterviewMessage with word timing", () => {
  it("saves words as JSON and closes the pool", async () => {
    await addInterviewMessage({
      sessionId: "s1",
      role: "candidate",
      content: "hello world",
      words,
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /words/);
    assert.deepEqual(calls[0].params, [
      "s1",
      "candidate",
      "hello world",
      JSON.stringify(words),
    ]);
    assert.equal(ended, 1);
  });

  it("keeps the original 3-column insert when there are no words", async () => {
    await addInterviewMessage({
      sessionId: "s1",
      role: "interviewer",
      content: "Tell me more.",
    });

    assert.doesNotMatch(calls[0].sql, /words/);
    assert.deepEqual(calls[0].params, ["s1", "interviewer", "Tell me more."]);
  });

  it("treats null or empty words as no words", async () => {
    await addInterviewMessage({ sessionId: "s1", role: "candidate", content: "hi", words: null });
    await addInterviewMessage({ sessionId: "s1", role: "candidate", content: "hi", words: [] });

    assert.equal(calls[0].params.length, 3);
    assert.equal(calls[1].params.length, 3);
  });

  it("rejects words that are not an array", async () => {
    await assert.rejects(
      addInterviewMessage({ sessionId: "s1", role: "candidate", content: "hi", words: "nope" }),
      /words must be an array/
    );
    assert.equal(calls.length, 0);
  });
});

describe("getInterviewMessages", () => {
  it("selects the words column", async () => {
    await getInterviewMessages("s1");
    assert.match(calls[0].sql, /words/);
  });
});
