// Per Question Feedback (Issue #31).
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REPORT_VERSION,
  buildEvidence,
  buildQuestionFeedback,
  buildUserPrompt,
  createFeedbackReportService,
  validateReport,
} = require("./feedback-report-service");

const silentLogger = { error: () => {} };

function message(role, content) {
  return { role, content };
}

const longAnswer =
  "I built a tea shop website with React. I redesigned the menu page and online ordering, and sales from the site went up about twenty percent.";
const secondAnswer =
  "The owner wanted a different layout. I made two mockups, we compared them, and picked the one customers preferred in a quick survey.";

const transcript = [
  message("interviewer", "Tell me about a project you're proud of."),
  message("candidate", longAnswer),
  message("interviewer", "How did you handle a disagreement on that project?"),
  message("candidate", secondAnswer),
  message("interviewer", "Thanks, that's the end of our interview."),
];

function questionEntry(number, overrides = {}) {
  return {
    questionNumber: number,
    sufficientEvidence: true,
    score: 70 + number,
    feedback: `Feedback for question ${number}.`,
    strength: `Strength ${number}.`,
    improvement: `Improvement ${number}.`,
    ...overrides,
  };
}

function aiReport(overrides = {}) {
  return {
    sufficientEvidence: true,
    overallScore: 74,
    summary: "Clear answers with concrete results.",
    categories: [
      { key: "relevance", score: 80, comment: "" },
      { key: "structure", score: 70, comment: "" },
      { key: "clarity", score: 75, comment: "" },
      { key: "examples", score: 72, comment: "" },
    ],
    strengths: [{ point: "Quantified your impact.", questionNumbers: [1] }],
    improvements: [
      { point: "Explain your reasoning.", suggestion: "Say why.", questionNumbers: [2] },
    ],
    questions: [questionEntry(1), questionEntry(2)],
    ...overrides,
  };
}

test("report version includes per-question feedback", () => {
  assert.equal(REPORT_VERSION, 2);
});

test("prompt asks for one feedback entry per question", () => {
  const prompt = buildUserPrompt({ session: {}, evidence: buildEvidence(transcript) });

  assert.match(prompt, /"questions": \[/);
  assert.match(prompt, /exactly one "questions" entry for each question/);
});

test("valid report has one entry per answered question, in order, with transcript text", () => {
  const evidence = buildEvidence(transcript);
  const result = validateReport(aiReport(), evidence);

  assert.equal(result.ok, true);
  const { questions } = result.report;

  assert.equal(questions.length, 2);
  assert.deepEqual(questions[0], {
    number: 1,
    question: "Tell me about a project you're proud of.",
    answer: longAnswer,
    feedbackAvailable: true,
    reason: null,
    score: 71,
    feedback: "Feedback for question 1.",
    strength: "Strength 1.",
    improvement: "Improvement 1.",
  });
  assert.equal(questions[1].number, 2);
  assert.equal(questions[1].answer, secondAnswer);
});

test("uses the transcript's question text even if the AI rewrites it", () => {
  const evidence = buildEvidence(transcript);
  const [first] = buildQuestionFeedback(
    [{ ...questionEntry(1), question: "Something the AI made up", answer: "Fake" }],
    evidence
  );

  assert.equal(first.question, "Tell me about a project you're proud of.");
  assert.equal(first.answer, longAnswer);
});

test("AI entries come back in interview order even if sent out of order", () => {
  const evidence = buildEvidence(transcript);
  const questions = buildQuestionFeedback([questionEntry(2), questionEntry(1)], evidence);

  assert.deepEqual(
    questions.map((q) => [q.number, q.score]),
    [
      [1, 71],
      [2, 72],
    ]
  );
});

test("a very short answer gets no score even if the AI scored it", () => {
  const evidence = buildEvidence([
    message("interviewer", "Tell me about a project you're proud of."),
    message("candidate", longAnswer),
    message("interviewer", "Why this company?"),
    message("candidate", "idk honestly"),
  ]);

  const questions = buildQuestionFeedback([questionEntry(1), questionEntry(2)], evidence);

  assert.equal(questions[1].feedbackAvailable, false);
  assert.equal(questions[1].reason, "too_short");
  assert.equal(questions[1].score, null);
  assert.equal(questions[1].feedback, "");
  // The user's own answer is still shown.
  assert.equal(questions[1].answer, "idk honestly");
});

test("AI marking one answer as insufficient leaves that question unscored", () => {
  const evidence = buildEvidence(transcript);
  const questions = buildQuestionFeedback(
    [questionEntry(1), questionEntry(2, { sufficientEvidence: false, score: null })],
    evidence
  );

  assert.equal(questions[0].feedbackAvailable, true);
  assert.equal(questions[1].feedbackAvailable, false);
  assert.equal(questions[1].reason, "too_short");
});

test("a question missing from the AI response or with a bad score is not_reviewed", () => {
  const evidence = buildEvidence(transcript);

  const missing = buildQuestionFeedback([questionEntry(1)], evidence);
  assert.equal(missing[1].reason, "not_reviewed");
  assert.equal(missing[1].score, null);

  const badScore = buildQuestionFeedback(
    [questionEntry(1), questionEntry(2, { score: 140 })],
    evidence
  );
  assert.equal(badScore[1].reason, "not_reviewed");

  const noText = buildQuestionFeedback(
    [questionEntry(1), questionEntry(2, { feedback: "   " })],
    evidence
  );
  assert.equal(noText[1].reason, "not_reviewed");
});

test("question numbers that don't exist are ignored, and duplicates use the first", () => {
  const evidence = buildEvidence(transcript);
  const questions = buildQuestionFeedback(
    [questionEntry(1), questionEntry(1, { score: 5 }), questionEntry(9), questionEntry(2)],
    evidence
  );

  assert.equal(questions.length, 2);
  assert.equal(questions[0].score, 71);
});

test("report fails when the AI skips per-question feedback entirely", () => {
  const evidence = buildEvidence(transcript);

  assert.deepEqual(validateReport(aiReport({ questions: undefined }), evidence), {
    ok: false,
    reason: "invalid_ai_output",
  });
  assert.deepEqual(validateReport(aiReport({ questions: [] }), evidence), {
    ok: false,
    reason: "invalid_ai_output",
  });
});

test("report still succeeds when every unscored answer was too short", () => {
  const evidence = buildEvidence([
    message("interviewer", "Tell me about a project you're proud of."),
    message("candidate", `${longAnswer} ${secondAnswer}`),
    message("interviewer", "Anything else?"),
    message("candidate", "no thanks"),
  ]);

  const result = validateReport(aiReport({ questions: [questionEntry(1)] }), evidence);

  assert.equal(result.ok, true);
  assert.equal(result.report.questions[1].reason, "too_short");
});

test("feedback text is trimmed and length-limited", () => {
  const evidence = buildEvidence(transcript);
  const [first] = buildQuestionFeedback(
    [questionEntry(1, { feedback: `  ${"a".repeat(2000)}  `, strength: 42 })],
    evidence
  );

  assert.ok(first.feedback.length <= 601);
  assert.equal(first.strength, "");
});

test("service asks for more tokens on longer interviews, with a cap", async () => {
  const calls = [];
  const service = createFeedbackReportService({
    logger: silentLogger,
    converse: async (input) => {
      calls.push(input);
      return { text: JSON.stringify(aiReport()) };
    },
  });

  const result = await service.generateFeedbackReport({ session: {}, messages: transcript });
  assert.equal(result.status, "ready");
  assert.equal(result.report.questions.length, 2);
  assert.equal(calls[0].maxTokens, 1500 + 250 * 2);

  const longInterview = [];
  for (let i = 0; i < 20; i += 1) {
    longInterview.push(message("interviewer", `Question ${i}?`));
    longInterview.push(message("candidate", longAnswer));
  }

  await service.generateFeedbackReport({ session: {}, messages: longInterview });
  assert.equal(calls[1].maxTokens, 4000);
});
