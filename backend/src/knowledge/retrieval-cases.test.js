// Runs every case in fixtures/retrieval-cases.json through
// buildInterviewContext and checks the final assembled result: coverage,
// sections in and out of the context, sources and determinism.
const assert = require("node:assert/strict");
const test = require("node:test");

const { loadKnowledgeBase } = require("./knowledge-base");
const { buildInterviewContext } = require("./interview-context");
const { checkCase, loadRetrievalCases } = require("./fixtures/retrieval-cases");

const knowledgeBase = loadKnowledgeBase({ logger: null });
const cases = loadRetrievalCases();

function run(testCase) {
  return buildInterviewContext(
    { setup: testCase.setup, targetJob: testCase.targetJob },
    { knowledgeBase }
  );
}

test("there are about twenty retrieval cases with unique ids", () => {
  assert.ok(cases.length >= 20, `${cases.length} cases`);
  assert.equal(new Set(cases.map((testCase) => testCase.id)).size, cases.length);
});

for (const testCase of cases) {
  test(`retrieval case: ${testCase.id}`, () => {
    const result = run(testCase);

    assert.deepEqual(checkCase(knowledgeBase, testCase, result), []);
    assert.deepEqual(run(testCase), result, "the same input must give the same result");
  });
}

test("the case checker catches wrong expectations", () => {
  const [testCase] = cases;
  const wrong = {
    ...testCase,
    expect: {
      status: "partial",
      coverage: { framework: "not_found" },
      includeSections: ["company.amazon#overview"],
      excludeSections: ["framework.mixed#overview"],
      includeSources: ["https://example.com/missing"],
    },
  };

  assert.equal(checkCase(knowledgeBase, wrong, run(testCase)).length, 5);
});

test("the case checker catches a section that isn't whole", () => {
  const [testCase] = cases;
  const result = run(testCase);
  const damaged = {
    ...result,
    knowledge: { ...result.knowledge, context: result.knowledge.context.replace("combines", "") },
  };

  assert.ok(checkCase(knowledgeBase, testCase, damaged).some((failure) => /not included whole/.test(failure)));
});
