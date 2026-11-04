const assert = require("node:assert/strict");
const test = require("node:test");

const { createBm25Index, scoreBm25 } = require("./bm25");

const index = createBm25Index([
  { id: "sql", tokens: ["sql", "query", "data", "data"] },
  { id: "code", tokens: ["code", "test", "data"] },
  { id: "empty", tokens: [] },
]);

test("scoreBm25 ranks documents with the rarer matching term first", () => {
  const results = scoreBm25(index, ["sql", "data"]);

  assert.equal(results[0].id, "sql");
  assert.ok(results[0].score > results[1].score);
  assert.deepEqual(results[0].matchedTerms, ["data", "sql"]);
});

test("scoreBm25 counts repeated query terms once", () => {
  const once = scoreBm25(index, ["code"]);
  const repeated = scoreBm25(index, ["code", "code", "code"]);

  assert.deepEqual(repeated, once);
});

test("scoreBm25 breaks score ties by id", () => {
  const results = scoreBm25(index, ["missing"]);

  assert.deepEqual(
    results.map((result) => result.id),
    ["code", "empty", "sql"]
  );
  assert.ok(results.every((result) => result.score === 0));
});

test("scoreBm25 scores only the given ids", () => {
  const results = scoreBm25(index, ["sql", "code"], ["code"]);

  assert.deepEqual(
    results.map((result) => result.id),
    ["code"]
  );
});

test("scoreBm25 rejects unknown ids and createBm25Index rejects duplicates", () => {
  assert.throws(() => scoreBm25(index, ["sql"], ["nope"]), /Unknown BM25 document id/);
  assert.throws(
    () => createBm25Index([{ id: "a", tokens: [] }, { id: "a", tokens: [] }]),
    /Duplicate BM25 document id/
  );
});

test("an empty index scores nothing", () => {
  assert.deepEqual(scoreBm25(createBm25Index([]), ["sql"]), []);
});
