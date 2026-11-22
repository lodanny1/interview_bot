// Runs with the backend's own test command: `node --test` (node:test, no extra libraries).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeWords, MAX_WORDS } = require("./word-timing");

const good = [
  { text: "hello", start: 0.1, end: 0.4 },
  { text: "world", start: 0.5, end: 0.9 },
];

describe("sanitizeWords", () => {
  it("accepts valid word timing and returns clean copies", () => {
    const result = sanitizeWords(good);
    assert.deepEqual(result, good);
    assert.notEqual(result, good);
  });

  it("trims text and rounds times to milliseconds", () => {
    assert.deepEqual(
      sanitizeWords([{ text: "  hi  ", start: 0.123456, end: 0.98765 }]),
      [{ text: "hi", start: 0.123, end: 0.988 }]
    );
  });

  it("drops extra properties so only the contract is stored", () => {
    const [word] = sanitizeWords([
      { text: "hi", start: 0, end: 1, confidence: 0.9, junk: {} },
    ]);
    assert.deepEqual(Object.keys(word).sort(), ["end", "start", "text"]);
  });

  const invalidInputs = [
    ["undefined", undefined],
    ["null", null],
    ["a string", "hello world"],
    ["an object", { text: "x" }],
    ["an empty array", []],
    [
      "too many words",
      Array.from({ length: MAX_WORDS + 1 }, () => ({ text: "a", start: 0, end: 1 })),
    ],
    ["a null entry", [null]],
    ["empty text", [{ text: "  ", start: 0, end: 1 }]],
    ["non-string text", [{ text: 5, start: 0, end: 1 }]],
    ["string times", [{ text: "a", start: "0", end: "1" }]],
    ["NaN time", [{ text: "a", start: NaN, end: 1 }]],
    ["Infinity time", [{ text: "a", start: 0, end: Infinity }]],
    ["negative start", [{ text: "a", start: -1, end: 1 }]],
    ["end before start", [{ text: "a", start: 2, end: 1 }]],
  ];

  for (const [name, input] of invalidInputs) {
    it(`returns null for ${name}`, () => {
      assert.equal(sanitizeWords(input), null);
    });
  }

  it("is all-or-nothing: one bad word drops the whole list", () => {
    assert.equal(sanitizeWords([...good, { text: "bad", start: 3, end: 2 }]), null);
  });
});
