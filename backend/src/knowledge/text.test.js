const assert = require("node:assert/strict");
const test = require("node:test");

const {
  compareStrings,
  normalizeCompanyName,
  phraseTokens,
  searchTokens,
} = require("./text");

test("normalizeCompanyName strips punctuation and terminal legal suffixes", () => {
  assert.equal(normalizeCompanyName("Amazon.com, Inc."), "amazoncom");
  assert.equal(normalizeCompanyName("Capital One Financial Corporation"), "capital one financial");
  assert.equal(normalizeCompanyName("  GOOGLE   LLC "), "google");
  assert.equal(normalizeCompanyName("Foo Co., Ltd."), "foo");
  assert.equal(normalizeCompanyName("J.P. Morgan"), "jp morgan");
  assert.equal(normalizeCompanyName("AT&T"), "at and t");
  assert.equal(normalizeCompanyName("Nestlé"), "nestle");
});

test("normalizeCompanyName only removes suffixes as whole last words", () => {
  // "Inc" in the middle or as part of a word stays.
  assert.equal(normalizeCompanyName("Inc Amazon"), "inc amazon");
  assert.equal(normalizeCompanyName("Incline Partners"), "incline partners");
  assert.equal(normalizeCompanyName("Costco"), "costco");
  // Never strips down to nothing.
  assert.equal(normalizeCompanyName("Company"), "company");
  assert.equal(normalizeCompanyName("Co."), "co");
});

test("normalizeCompanyName never turns a longer name into a covered one", () => {
  assert.equal(normalizeCompanyName("Amazonian Foods"), "amazonian foods");
  assert.notEqual(normalizeCompanyName("Amazonian Foods"), normalizeCompanyName("Amazon"));
  assert.notEqual(normalizeCompanyName("Amazon Fresh Foods"), normalizeCompanyName("Amazon"));
});

test("normalizeCompanyName returns empty text for names with no letters or digits", () => {
  assert.equal(normalizeCompanyName("..."), "");
  assert.equal(normalizeCompanyName(""), "");
});

test("phraseTokens splits on punctuation but joins dotted abbreviations", () => {
  assert.deepEqual(phraseTokens("Sr. Front-End Engineer II"), ["sr", "front", "end", "engineer", "ii"]);
  assert.deepEqual(phraseTokens("Software Engineer / Data Analyst"), [
    "software",
    "engineer",
    "data",
    "analyst",
  ]);
});

test("searchTokens drops stopwords and folds simple plurals", () => {
  assert.deepEqual(searchTokens("Partner with the software engineers on queries"), [
    "partner",
    "software",
    "engineer",
    "query",
  ]);
  // Words ending in ss/us/is keep their s.
  assert.deepEqual(searchTokens("process status analysis"), ["process", "status", "analysis"]);
});

test("compareStrings sorts by code point, not locale", () => {
  assert.deepEqual(["b", "B", "a", "A"].sort(compareStrings), ["A", "B", "a", "b"]);
});
