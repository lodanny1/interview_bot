// @vitest-environment jsdom
// Per Question Feedback (Issue #31).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FeedbackReportPanel } from "@/components/feedback/FeedbackReportPanel";
import {
  QUESTION_FEEDBACK_COPY,
  QuestionFeedbackList,
} from "@/components/feedback/QuestionFeedbackList";
import {
  QUESTION_FEEDBACK_MESSAGES,
  parseFeedbackReport,
  type QuestionFeedback,
} from "@/lib/feedback/feedback-state";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const scored: QuestionFeedback = {
  number: 1,
  question: "Tell me about a project you're proud of.",
  answer: "I built a tea shop website and sales went up twenty percent.",
  feedbackAvailable: true,
  reason: null,
  score: 82,
  feedback: "A strong answer with a clear result.",
  strength: "You gave a number for your impact.",
  improvement: "Say what your specific role was.",
};

const tooShort: QuestionFeedback = {
  number: 2,
  question: "Why this company?",
  answer: "idk",
  feedbackAvailable: false,
  reason: "too_short",
  score: null,
  feedback: "",
  strength: "",
  improvement: "",
};

const baseReport = {
  overallScore: 74,
  summary: "Clear answers with concrete results.",
  categories: [],
  strengths: [{ point: "Quantified your impact.", questionNumbers: [1] }],
  improvements: [{ point: "Explain why.", suggestion: "", questionNumbers: [2, 3] }],
  questionsAnswered: 2,
};

describe("parseFeedbackReport questions", () => {
  it("parses per-question feedback and sorts it by question number", () => {
    const parsed = parseFeedbackReport({ ...baseReport, questions: [tooShort, scored] });

    expect(parsed?.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(parsed?.questions[0]).toEqual(scored);
    expect(parsed?.questions[1].score).toBeNull();
    expect(parsed?.questions[1].reason).toBe("too_short");
  });

  it("never shows a score the backend didn't mark as real", () => {
    const parsed = parseFeedbackReport({
      ...baseReport,
      questions: [
        { ...scored, feedbackAvailable: false, reason: "not_reviewed" },
        { ...scored, number: 2, score: 140 },
        { ...scored, number: 3, feedback: "" },
      ],
    });

    expect(parsed?.questions.every((q) => q.score === null && !q.feedbackAvailable)).toBe(true);
    expect(parsed?.questions.every((q) => q.reason === "not_reviewed")).toBe(true);
  });

  it("drops malformed entries and treats older reports as having none", () => {
    expect(
      parseFeedbackReport({ ...baseReport, questions: [null, { number: 0 }, "x", scored] })
        ?.questions
    ).toEqual([scored]);
    expect(parseFeedbackReport(baseReport)?.questions).toEqual([]);
  });
});

describe("QuestionFeedbackList", () => {
  it("renders nothing when there's no per-question feedback", () => {
    const { container } = render(<QuestionFeedbackList questions={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows each question with its score, feedback, and the user's answer", async () => {
    render(<QuestionFeedbackList questions={[scored, tooShort]} />);

    expect(screen.getByRole("heading", { name: QUESTION_FEEDBACK_COPY.heading })).toBeTruthy();
    expect(screen.getByText(scored.question)).toBeTruthy();
    expect(screen.getByLabelText("Score 82 out of 100, Strong")).toBeTruthy();
    expect(screen.getByText(scored.feedback)).toBeTruthy();
    expect(screen.getByText(scored.strength)).toBeTruthy();
    expect(screen.getByText(scored.improvement)).toBeTruthy();

    // The answer is tucked into a "Your answer" toggle.
    const toggles = screen.getAllByText(QUESTION_FEEDBACK_COPY.yourAnswer);
    await userEvent.click(toggles[0]);
    expect(screen.getByText(scored.answer)).toBeTruthy();

    expect(document.getElementById("question-feedback-1")).toBeTruthy();
    expect(document.getElementById("question-feedback-2")).toBeTruthy();
  });

  it("explains a missing score instead of making one up", () => {
    render(<QuestionFeedbackList questions={[tooShort]} />);

    expect(screen.getByText(QUESTION_FEEDBACK_MESSAGES.too_short)).toBeTruthy();
    expect(screen.queryByLabelText(/^Score /)).toBeNull();
  });

  it("shows a fallback when the question text wasn't saved", () => {
    render(<QuestionFeedbackList questions={[{ ...scored, question: "" }]} />);
    expect(screen.getByText(QUESTION_FEEDBACK_COPY.noQuestionText)).toBeTruthy();
  });
});

describe("FeedbackReportPanel with per-question feedback", () => {
  function stubReady(report: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            feedback: { sessionId: "s", status: "ready", reason: null, report },
          }),
          { status: 200 }
        )
      )
    );
  }

  it("hands the per-question feedback to the page", async () => {
    stubReady({ ...baseReport, questions: [scored, tooShort] });
    const onQuestionFeedback = vi.fn();

    render(
      <FeedbackReportPanel
        sessionId="s"
        sessionStatus="COMPLETED"
        onQuestionFeedback={onQuestionFeedback}
      />
    );

    await waitFor(() =>
      expect(onQuestionFeedback).toHaveBeenLastCalledWith([scored, tooShort])
    );
  });

  it("links Q tags to questions that have feedback cards", async () => {
    stubReady({ ...baseReport, questions: [scored, tooShort] });

    render(<FeedbackReportPanel sessionId="s" sessionStatus="COMPLETED" />);

    const q1 = await screen.findByRole("link", { name: "See feedback for question 1" });
    expect(q1.getAttribute("href")).toBe("#question-feedback-1");
    expect(screen.getByRole("link", { name: "See feedback for question 2" })).toBeTruthy();
    // Q3 has no card, so it stays plain text.
    expect(screen.queryByRole("link", { name: "See feedback for question 3" })).toBeNull();
    expect(screen.getByText("Q3")).toBeTruthy();
  });

  it("sends an empty list when the report has no per-question feedback", async () => {
    stubReady(baseReport);
    const onQuestionFeedback = vi.fn();

    render(
      <FeedbackReportPanel
        sessionId="s"
        sessionStatus="COMPLETED"
        onQuestionFeedback={onQuestionFeedback}
      />
    );

    await screen.findByText(baseReport.summary);
    expect(onQuestionFeedback).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
