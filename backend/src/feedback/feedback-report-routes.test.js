const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const { createFeedbackReportRouter } = require("./feedback-report-routes");

const SESSION_ID = "11111111-2222-3333-4444-555555555555";

const sampleReport = {
  version: 1,
  overallScore: 74,
  summary: "Solid answers.",
  categories: [],
  strengths: [{ point: "Quantified impact.", questionNumbers: [1] }],
  improvements: [],
  questionsAnswered: 2,
};

async function withServer(router, run) {
  const app = express();
  app.use(express.json());
  app.use(router);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

function activeAuth() {
  return async () => ({ ok: true, user: { id: "user-123" } });
}

function interviewRepo({ status = "COMPLETED", messages = [] } = {}) {
  return {
    getInterviewSession: async (userId, sessionId) =>
      sessionId === SESSION_ID ? { id: SESSION_ID, user_id: userId, status } : null,
    getInterviewMessages: async () => messages,
  };
}

// In-memory stand-in for feedback-report-repository.js.
function memoryFeedbackRepo(initialRow = null) {
  const state = { row: initialRow, saves: [] };

  return {
    state,
    getFeedbackReport: async () => state.row,
    claimFeedbackReport: async ({ userId, sessionId }) => {
      if (state.row && !["FAILED"].includes(state.row.status)) return null;
      state.row = { session_id: sessionId, user_id: userId, status: "GENERATING" };
      return state.row;
    },
    saveFeedbackResult: async ({ status, report, reason }) => {
      state.saves.push({ status, report, reason });
      state.row = {
        ...state.row,
        status,
        report: status === "READY" ? report : null,
        unavailable_reason: status === "READY" ? null : reason,
        generated_at: status === "READY" ? "2026-11-11T20:00:00.000Z" : null,
      };
      return state.row;
    },
  };
}

function router(overrides = {}) {
  return createFeedbackReportRouter({
    requireActiveUser: activeAuth(),
    interviewRepository: interviewRepo(),
    feedbackRepository: memoryFeedbackRepo(),
    feedbackService: {
      generateFeedbackReport: async () => ({ status: "ready", report: sampleReport }),
    },
    logger: { error: () => {} },
    ...overrides,
  });
}

test("GET returns not_generated for a finished interview with no report", async () => {
  await withServer(router(), async (base) => {
    const response = await fetch(`${base}/interviews/${SESSION_ID}/feedback`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.feedback.status, "not_generated");
    assert.equal(body.feedback.report, null);
  });
});

test("GET returns not_completed while the interview is active", async () => {
  await withServer(
    router({ interviewRepository: interviewRepo({ status: "ACTIVE" }) }),
    async (base) => {
      const body = await (await fetch(`${base}/interviews/${SESSION_ID}/feedback`)).json();
      assert.equal(body.feedback.status, "not_completed");
    }
  );
});

test("GET returns 404 for an unknown or malformed session id", async () => {
  await withServer(router(), async (base) => {
    assert.equal((await fetch(`${base}/interviews/not-a-uuid/feedback`)).status, 404);
    assert.equal(
      (await fetch(`${base}/interviews/99999999-2222-3333-4444-555555555555/feedback`)).status,
      404
    );
  });
});

test("GET passes through the auth error", async () => {
  await withServer(
    router({ requireActiveUser: async () => ({ ok: false, status: 401, error: "Unauthorized" }) }),
    async (base) => {
      assert.equal((await fetch(`${base}/interviews/${SESSION_ID}/feedback`)).status, 401);
    }
  );
});

test("POST generates, saves, and returns the report; GET then returns the saved report", async () => {
  const feedbackRepository = memoryFeedbackRepo();
  let serviceInput;

  const messages = [{ role: "candidate", content: "hi" }];

  await withServer(
    router({
      interviewRepository: interviewRepo({ messages }),
      feedbackRepository,
      feedbackService: {
        generateFeedbackReport: async (input) => {
          serviceInput = input;
          return { status: "ready", report: sampleReport };
        },
      },
    }),
    async (base) => {
      const response = await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.feedback.status, "ready");
      assert.deepEqual(body.feedback.report, sampleReport);
      assert.equal(body.feedback.generatedAt, "2026-11-11T20:00:00.000Z");
      assert.deepEqual(serviceInput.messages, messages);

      // Scenario 4: the report is still there when the user comes back.
      const again = await (await fetch(`${base}/interviews/${SESSION_ID}/feedback`)).json();
      assert.equal(again.feedback.status, "ready");
      assert.deepEqual(again.feedback.report, sampleReport);
    }
  );
});

test("POST does not regenerate a report that already exists", async () => {
  let calls = 0;

  await withServer(
    router({
      feedbackRepository: memoryFeedbackRepo({
        status: "READY",
        report: sampleReport,
        generated_at: "2026-11-10T00:00:00.000Z",
      }),
      feedbackService: {
        generateFeedbackReport: async () => {
          calls += 1;
          return { status: "ready", report: sampleReport };
        },
      },
    }),
    async (base) => {
      const body = await (
        await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" })
      ).json();

      assert.equal(body.feedback.status, "ready");
      assert.equal(calls, 0);
    }
  );
});

test("POST returns 202 while another request is generating", async () => {
  await withServer(
    router({ feedbackRepository: memoryFeedbackRepo({ status: "GENERATING" }) }),
    async (base) => {
      const response = await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" });
      assert.equal(response.status, 202);
      assert.equal((await response.json()).feedback.status, "generating");
    }
  );
});

test("POST rejects an active interview with 409", async () => {
  await withServer(
    router({ interviewRepository: interviewRepo({ status: "ACTIVE" }) }),
    async (base) => {
      const response = await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "not_completed");
    }
  );
});

test("POST saves and returns an unavailable result without a report", async () => {
  const feedbackRepository = memoryFeedbackRepo();

  await withServer(
    router({
      feedbackRepository,
      feedbackService: {
        generateFeedbackReport: async () => ({ status: "unavailable", reason: "no_answers" }),
      },
    }),
    async (base) => {
      const body = await (
        await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" })
      ).json();

      assert.equal(body.feedback.status, "unavailable");
      assert.equal(body.feedback.reason, "no_answers");
      assert.equal(body.feedback.report, null);
      assert.deepEqual(feedbackRepository.state.saves[0], {
        status: "UNAVAILABLE",
        report: null,
        reason: "no_answers",
      });
    }
  );
});

test("a failed report can be retried", async () => {
  const feedbackRepository = memoryFeedbackRepo({ status: "FAILED", unavailable_reason: "ai_unavailable" });

  await withServer(router({ feedbackRepository }), async (base) => {
    const before = await (await fetch(`${base}/interviews/${SESSION_ID}/feedback`)).json();
    assert.equal(before.feedback.status, "failed");

    const after = await (
      await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" })
    ).json();
    assert.equal(after.feedback.status, "ready");
  });
});

test("POST marks the report FAILED if something throws after claiming it", async () => {
  const feedbackRepository = memoryFeedbackRepo();

  await withServer(
    router({
      feedbackRepository,
      feedbackService: {
        generateFeedbackReport: async () => {
          throw new Error("boom");
        },
      },
    }),
    async (base) => {
      const response = await fetch(`${base}/interviews/${SESSION_ID}/feedback`, { method: "POST" });

      assert.equal(response.status, 500);
      assert.equal(feedbackRepository.state.row.status, "FAILED");
    }
  );
});
