const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const { createInterviewRouter } = require("./interview-routes");

async function startTestServer(router) {
  const app = express();
  app.use(express.json());
  app.use(router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}

function activeAuth() {
  return async () => ({
    ok: true,
    user: {
      id: "user-123",
    },
  });
}

test("POST /interviews creates a session and opening question", async () => {
  let createInput;
  let aiInput;
  let messageInput;

  const repository = {
    createInterviewSession: async (input) => {
      createInput = input;

      return {
        id: "session-123",
        user_id: "user-123",
        title: "AWS Practice",
        mode: "text",
      };
    },

    addInterviewMessage: async (input) => {
      messageInput = input;

      return {
        id: "message-123",
        session_id: "session-123",
        role: "interviewer",
        content: input.content,
        created_at: "2026-11-02T05:00:00.000Z",
      };
    },
  };

  const aiService = {
    generateOpeningQuestion: async (input) => {
      aiInput = input;

      return {
        text: "Tell me about your background.",
      };
    },
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService,
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: "general",
          title: "AWS Practice",
          focusArea: "technical",
          mode: "text",
          industry: "technology",
          roleLevel: "entry",
          experienceLevel: "junior",
          jobDescription:
            "Example job description",
        }),
      }
    );

    assert.equal(
      response.status,
      201
    );

    const body = await response.json();

    assert.deepEqual(
      createInput,
      {
        userId: "user-123",
        goal: "general",
        title: "AWS Practice",
        focusArea: "technical",
        mode: "text",
        industry: "technology",
        roleLevel: "entry",
        experienceLevel: "junior",
        jobDescription:
          "Example job description",
        resumeId: null,
      }
    );

    assert.deepEqual(
      aiInput,
      {
        role: "entry",
        company: null,
        interviewType: "technical",
        resumeContext: null,
      }
    );

    assert.deepEqual(
      messageInput,
      {
        sessionId: "session-123",
        role: "interviewer",
        content:
          "Tell me about your background.",
      }
    );

    assert.equal(
      body.session.id,
      "session-123"
    );

    assert.equal(
      body.session.title,
      "AWS Practice"
    );

    assert.equal(
      body.session.mode,
      "text"
    );

    assert.equal(
      body.session.messages.length,
      1
    );

    assert.equal(
      body.session.messages[0].role,
      "interviewer"
    );
  } finally {
    server.close();
  }
});

test("POST /interviews rejects invalid input", async () => {
  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository: {},
    aiService: {},
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: "bad-goal",
          title: "",
          focusArea: "",
          mode: "invalid",
        }),
      }
    );

    assert.equal(
      response.status,
      400
    );

    const body = await response.json();

    assert.ok(
      body.fieldErrors.goal
    );

    assert.ok(
      body.fieldErrors.title
    );

    assert.ok(
      body.fieldErrors.focusArea
    );

    assert.ok(
      body.fieldErrors.mode
    );
  } finally {
    server.close();
  }
});

test("GET /interviews/:id returns owned session and transcript", async () => {
  let sessionLookup;

  const repository = {
    getInterviewSession: async (
      userId,
      sessionId
    ) => {
      sessionLookup = {
        userId,
        sessionId,
      };

      return {
        id: "session-123",
        user_id: "user-123",
        title: "AWS Practice",
        mode: "text",
      };
    },

    getInterviewMessages: async () => [
      {
        id: "message-1",
        session_id: "session-123",
        role: "interviewer",
        content: "Question one",
        created_at:
          "2026-11-02T05:00:00.000Z",
      },
      {
        id: "message-2",
        session_id: "session-123",
        role: "candidate",
        content: "Answer one",
        created_at:
          "2026-11-02T05:01:00.000Z",
      },
    ],
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService: {},
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/session-123`
    );

    assert.equal(
      response.status,
      200
    );

    assert.deepEqual(
      sessionLookup,
      {
        userId: "user-123",
        sessionId: "session-123",
      }
    );

    const body = await response.json();

    assert.equal(
      body.session.id,
      "session-123"
    );

    assert.equal(
      body.session.messages.length,
      2
    );

    assert.equal(
      body.session.messages[1].role,
      "candidate"
    );
  } finally {
    server.close();
  }
});

test("GET /interviews/:id returns 404 when session is not owned by user", async () => {
  const repository = {
    getInterviewSession: async () =>
      null,
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService: {},
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/missing-session`
    );

    assert.equal(
      response.status,
      404
    );
  } finally {
    server.close();
  }
});

test("POST /interviews/:id/messages saves candidate response and interviewer follow-up", async () => {
  const addedMessages = [];
  let aiInput;

  const repository = {
    getInterviewSession: async () => ({
      id: "session-123",
      user_id: "user-123",
      title: "AWS Practice",
      mode: "text",
      status: "ACTIVE",
      role_level: "entry",
      focus_area: "technical",
    }),

    addInterviewMessage: async (input) => {
      addedMessages.push(input);

      return {
        id: `message-${addedMessages.length}`,
        session_id: input.sessionId,
        role: input.role,
        content: input.content,
        created_at: "2026-11-02T06:00:00.000Z",
      };
    },

    getInterviewMessages: async () => [
      {
        id: "message-old-1",
        session_id: "session-123",
        role: "interviewer",
        content: "Tell me about yourself.",
        created_at: "2026-11-02T05:00:00.000Z",
      },
      {
        id: "message-old-2",
        session_id: "session-123",
        role: "candidate",
        content: "I have cloud experience.",
        created_at: "2026-11-02T05:01:00.000Z",
      },
      {
        id: "message-new",
        session_id: "session-123",
        role: "candidate",
        content: "I worked with AWS.",
        created_at: "2026-11-02T05:02:00.000Z",
      },
    ],
  };

  const aiService = {
    generateFollowUpQuestion: async (input) => {
      aiInput = input;

      return {
        text:
          "What AWS service did you work with most closely?",
      };
    },
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService,
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/session-123/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "I worked with AWS.",
        }),
      }
    );

    assert.equal(
      response.status,
      201
    );

    assert.deepEqual(
      addedMessages[0],
      {
        sessionId: "session-123",
        role: "candidate",
        content: "I worked with AWS.",
      }
    );

    assert.equal(
      aiInput.role,
      "entry"
    );

    assert.equal(
      aiInput.interviewType,
      "technical"
    );

    assert.deepEqual(
      aiInput.conversation,
      [
        {
          role: "assistant",
          content:
            "Tell me about yourself.",
        },
        {
          role: "user",
          content:
            "I have cloud experience.",
        },
        {
          role: "user",
          content:
            "I worked with AWS.",
        },
      ]
    );

    assert.deepEqual(
      addedMessages[1],
      {
        sessionId: "session-123",
        role: "interviewer",
        content:
          "What AWS service did you work with most closely?",
      }
    );

    const body = await response.json();

    assert.equal(
      body.messages.length,
      2
    );

    assert.equal(
      body.messages[0].role,
      "candidate"
    );

    assert.equal(
      body.messages[1].role,
      "interviewer"
    );
  } finally {
    server.close();
  }
});

test("POST /interviews/:id/messages rejects blank response content", async () => {
  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository: {},
    aiService: {},
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/session-123/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "   ",
        }),
      }
    );

    assert.equal(
      response.status,
      400
    );
  } finally {
    server.close();
  }
});

test("POST /interviews/:id/messages returns 404 for unowned session", async () => {
  const repository = {
    getInterviewSession: async () =>
      null,
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService: {},
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/missing/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "My answer",
        }),
      }
    );

    assert.equal(
      response.status,
      404
    );
  } finally {
    server.close();
  }
});

test("POST /interviews/:id/messages rejects inactive session", async () => {
  const repository = {
    getInterviewSession: async () => ({
      id: "session-123",
      user_id: "user-123",
      status: "COMPLETED",
    }),
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService: {},
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/session-123/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "My answer",
        }),
      }
    );

    assert.equal(
      response.status,
      409
    );
  } finally {
    server.close();
  }
});

test("POST /interviews uses resume-personalized opening question when resumeId is selected", async () => {
  let personalizedInput;
  let genericCalled = false;

  const repository = {
    createInterviewSession: async (input) => ({
      id: "session-resume-123",
      user_id: input.userId,
      resume_id: input.resumeId,
      title: input.title,
      mode: input.mode,
    }),

    addInterviewMessage: async (input) => ({
      id: "message-resume-123",
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      created_at: "2026-11-02T07:00:00.000Z",
    }),
  };

  const aiService = {
    generateOpeningQuestion: async () => {
      genericCalled = true;

      return {
        text: "Generic opening question",
      };
    },

    generateResumePersonalizedQuestion: async (input) => {
      personalizedInput = input;

      return {
        text:
          "You worked with AWS during your internship. Can you walk me through a technical challenge you handled there?",
      };
    },
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService,
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: "general",
          title: "Resume Practice",
          focusArea: "technical",
          mode: "text",
          roleLevel: "entry",
          resumeId: "resume-123",
        }),
      }
    );

    assert.equal(
      response.status,
      201
    );

    assert.equal(
      genericCalled,
      false
    );

    assert.deepEqual(
      personalizedInput,
      {
        userId: "user-123",
        resumeId: "resume-123",
        role: "entry",
        company: null,
        interviewType: "technical",
      }
    );

    const body = await response.json();

    assert.match(
      body.session.messages[0].content,
      /AWS/
    );
  } finally {
    server.close();
  }
});

test("POST /interviews/:id/messages includes resume context in follow-up when session has a resume", async () => {
  let aiInput;
  let resumeLookup;

  const repository = {
    getInterviewSession: async () => ({
      id: "session-123",
      user_id: "user-123",
      resume_id: "resume-123",
      status: "ACTIVE",
      role_level: "entry",
      focus_area: "technical",
    }),

    addInterviewMessage: async (input) => ({
      id: `message-${input.role}`,
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      created_at: "2026-11-02T08:00:00.000Z",
    }),

    getInterviewMessages: async () => [
      {
        id: "message-1",
        session_id: "session-123",
        role: "interviewer",
        content: "Tell me about Lisa.",
        created_at: "2026-11-02T07:59:00.000Z",
      },
      {
        id: "message-2",
        session_id: "session-123",
        role: "candidate",
        content: "I deployed it on ECS Fargate.",
        created_at: "2026-11-02T08:00:00.000Z",
      },
    ],
  };

  const resumeContextService = {
    getResumeContext: async (input) => {
      resumeLookup = input;

      return {
        resumeId: "resume-123",
        context: {
          summary: "AWS certified CS student",
          skills: ["AWS", "Docker"],
          education: [],
          experience: [
            {
              company: "Amazon Web Services",
              role: "Cloud Support Engineer Intern",
            },
          ],
          projects: [
            {
              name: "Lisa",
              description: "Voice assistant on ECS Fargate",
              technologies: ["ECS", "Cognito"],
            },
          ],
          certifications: [],
        },
      };
    },
  };

  const aiService = {
    generateFollowUpQuestion: async (input) => {
      aiInput = input;

      return {
        text:
          "How did your AWS internship experience influence the way you designed Lisa?",
      };
    },
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService,
    resumeContextService,
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/session-123/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "I deployed it on ECS Fargate.",
        }),
      }
    );

    assert.equal(
      response.status,
      201
    );

    assert.deepEqual(
      resumeLookup,
      {
        userId: "user-123",
        resumeId: "resume-123",
      }
    );

    assert.match(
      aiInput.resumeContext,
      /Amazon Web Services/
    );

    assert.match(
      aiInput.resumeContext,
      /Lisa/
    );

    assert.deepEqual(
      aiInput.conversation,
      [
        {
          role: "assistant",
          content: "Tell me about Lisa.",
        },
        {
          role: "user",
          content: "I deployed it on ECS Fargate.",
        },
      ]
    );
  } finally {
    server.close();
  }
});

test("POST /interviews/:id/messages ends interview naturally when time limit is reached", async () => {
  const completedCalls = [];
  let closingInput;

  const repository = {
    getInterviewSession: async () => ({
      id: "session-timeout",
      user_id: "user-123",
      resume_id: null,
      status: "ACTIVE",
      role_level: "entry",
      focus_area: "technical",
    }),

    addInterviewMessage: async (input) => ({
      id: `message-${input.role}-${Math.random()}`,
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      created_at: "2026-11-02T08:30:00.000Z",
    }),

    getInterviewMessages: async () => [
      {
        id: "message-1",
        session_id: "session-timeout",
        role: "interviewer",
        content:
          "Can you explain how you would design a scalable backend service?",
        created_at: "2026-11-02T08:29:00.000Z",
      },
      {
        id: "message-2",
        session_id: "session-timeout",
        role: "candidate",
        content:
          "I would start with stateless services behind a load balancer.",
        created_at: "2026-11-02T08:30:00.000Z",
      },
    ],

    getInterviewTimeState: async () => ({
      id: "session-timeout",
      status: "ACTIVE",
      expired: true,
    }),

    completeInterviewSession: async (input) => {
      completedCalls.push(input);

      return {
        id: input.sessionId,
        status: "COMPLETED",
        completion_reason: input.reason,
      };
    },
  };

  const aiService = {
    generateClosingStatement: async (input) => {
      closingInput = input;

      return {
        text:
          "We're right at the end of our time, so we'll have to wrap up here. Thank you for speaking with me today.",
      };
    },

    generateFollowUpQuestion: async () => {
      throw new Error(
        "Normal follow-up should not be generated after timeout"
      );
    },
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService,
    logger: {
      error: () => {},
    },
  });

  const {
    server,
    baseUrl,
  } = await startTestServer(router);

  try {
    const response = await fetch(
      `${baseUrl}/interviews/session-timeout/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content:
            "I would start with stateless services behind a load balancer.",
        }),
      }
    );

    assert.equal(
      response.status,
      201
    );

    const body = await response.json();

    assert.equal(
      body.completed,
      true
    );

    assert.equal(
      body.completionReason,
      "TIME_LIMIT"
    );

    assert.equal(
      body.messages.length,
      2
    );

    assert.equal(
      body.messages[1].role,
      "interviewer"
    );

    assert.match(
      body.messages[1].content,
      /wrap up|end of our time|thank you/i
    );

    assert.equal(
      completedCalls.length,
      1
    );

    assert.deepEqual(
      completedCalls[0],
      {
        userId: "user-123",
        sessionId: "session-timeout",
        reason: "TIME_LIMIT",
      }
    );

    assert.equal(
      Array.isArray(closingInput.conversation),
      true
    );

    assert.equal(
      closingInput.conversation.length,
      2
    );
  } finally {
    server.close();
  }
});

/* ------------- Role & Company Knowledge Retrieval (Issue #16) ------------- */

const interviewKnowledge = require("./interview-knowledge");

const AMAZON_INTERN_JOB = {
  job_title: "Software Development Engineer Intern",
  company: "Amazon",
  description: "Build and test services as part of a software development team.",
};

const STORED_PROMPT_INPUT = {
  role: "Software Development Engineer Intern",
  company: "Amazon",
  interviewType: "behavioral",
  knowledgeContext: [
    '<knowledge_base version="kb-test">',
    '<document id="company.amazon" kind="company" title="Amazon" reviewed="2026-11-01">',
    "</document>",
    "</knowledge_base>",
  ].join("\n"),
  knowledgeCoverage: { company: { status: "matched" } },
};

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: await response.json() };
}

// Starts a router with the real knowledge module and records what reaches
// the repository and the AI service.
async function startKnowledgeServer({ targetJob = AMAZON_INTERN_JOB, session = null } = {}) {
  const calls = { targetJobUsers: [], created: null, ai: {} };

  const repository = {
    createInterviewSession: async (input) => {
      calls.created = input;
      return { id: "session-kb", title: input.title, mode: input.mode, status: "ACTIVE" };
    },
    getInterviewSession: async () => session,
    addInterviewMessage: async (input) => ({
      id: `message-${input.role}`,
      role: input.role,
      content: input.content,
      created_at: "2026-11-02T08:00:00.000Z",
    }),
    getInterviewMessages: async () => [
      { id: "m1", role: "interviewer", content: "Tell me about a project.", created_at: "2026-11-02T08:00:00.000Z" },
      { id: "m2", role: "candidate", content: "I built an API.", created_at: "2026-11-02T08:01:00.000Z" },
    ],
    getInterviewTimeState: async () => ({ expired: Boolean(session && session.expired) }),
    completeInterviewSession: async () => ({ ...session, status: "COMPLETED" }),
  };

  const record = (name) => async (input) => {
    calls.ai[name] = input;
    return { text: `${name} text` };
  };

  const aiService = {
    generateOpeningQuestion: record("opening"),
    generateResumePersonalizedQuestion: record("resumeOpening"),
    generateFollowUpQuestion: record("followUp"),
    generateClosingStatement: record("closing"),
  };

  const router = createInterviewRouter({
    requireActiveUser: activeAuth(),
    repository,
    aiService,
    getTargetJob: async (userId) => {
      calls.targetJobUsers.push(userId);
      return targetJob;
    },
    knowledgeService: interviewKnowledge,
    logger: { error: () => {} },
  });

  const { server, baseUrl } = await startTestServer(router);

  return { server, baseUrl, calls };
}

test("POST /interviews uses the saved target job and its interview notes, and stores them on the session", async () => {
  const { server, baseUrl, calls } = await startKnowledgeServer();

  try {
    const { status } = await postJson(baseUrl, "/interviews", {
      goal: "specific",
      title: "Amazon practice",
      focusArea: "behavioral",
      mode: "text",
      roleLevel: "intern",
    });

    assert.equal(status, 201);
    assert.deepEqual(calls.targetJobUsers, ["user-123"]);

    const { promptInput, knowledgeSummary } = calls.created;

    assert.equal(promptInput.role, "Software Development Engineer Intern");
    assert.equal(promptInput.company, "Amazon");
    assert.equal(promptInput.interviewType, "behavioral");
    assert.match(promptInput.knowledgeContext, /^<knowledge_base version="/);
    assert.equal(promptInput.knowledgeCoverage.company.status, "matched");
    assert.equal(knowledgeSummary.coverage.company.status, "matched");
    assert.ok(knowledgeSummary.sectionIds.length > 0);

    // The opening question gets exactly what was stored.
    assert.deepEqual(calls.ai.opening, { ...promptInput, resumeContext: null });
  } finally {
    server.close();
  }
});

test("POST /interviews does not load the target job for general practice", async () => {
  const { server, baseUrl, calls } = await startKnowledgeServer();

  try {
    const { status } = await postJson(baseUrl, "/interviews", {
      goal: "general",
      title: "General practice",
      focusArea: "behavioral",
      mode: "text",
      roleLevel: "entry",
    });

    assert.equal(status, 201);
    assert.deepEqual(calls.targetJobUsers, []);

    const { promptInput } = calls.created;

    // No job title, so the role level is used as before; no company.
    assert.equal(promptInput.role, "entry");
    assert.equal(promptInput.company, null);
    assert.equal(promptInput.knowledgeCoverage.company.status, "not_given");
    assert.equal(calls.ai.opening.knowledgeCoverage.company.status, "not_given");
  } finally {
    server.close();
  }
});

test("POST /interviews passes the interview notes to the resume-personalized opening question", async () => {
  const { server, baseUrl, calls } = await startKnowledgeServer();

  try {
    const { status } = await postJson(baseUrl, "/interviews", {
      goal: "specific",
      title: "Amazon practice with resume",
      focusArea: "technical",
      mode: "text",
      roleLevel: "intern",
      resumeId: "resume-123",
    });

    assert.equal(status, 201);
    assert.equal(calls.ai.opening, undefined);
    assert.deepEqual(calls.ai.resumeOpening, {
      userId: "user-123",
      resumeId: "resume-123",
      ...calls.created.promptInput,
    });
    assert.equal(calls.ai.resumeOpening.company, "Amazon");
  } finally {
    server.close();
  }
});

test("follow-up questions reuse the prompt input stored with the session", async () => {
  const session = {
    id: "session-kb",
    status: "ACTIVE",
    role_level: "intern",
    focus_area: "behavioral",
    prompt_input: STORED_PROMPT_INPUT,
  };
  const { server, baseUrl, calls } = await startKnowledgeServer({ session });

  try {
    const { status } = await postJson(baseUrl, "/interviews/session-kb/messages", {
      content: "I built an API.",
    });

    assert.equal(status, 201);
    // Later turns never reload the target job.
    assert.deepEqual(calls.targetJobUsers, []);

    const { conversation, resumeContext, ...input } = calls.ai.followUp;

    assert.deepEqual(input, STORED_PROMPT_INPUT);
    assert.equal(resumeContext, null);
    assert.equal(conversation.length, 2);
  } finally {
    server.close();
  }
});

test("closings use the stored role, company and type without the notes", async () => {
  const expected = {
    role: "Software Development Engineer Intern",
    company: "Amazon",
    interviewType: "behavioral",
  };

  // The time limit is reached while answering.
  const expired = await startKnowledgeServer({
    session: { id: "session-kb", status: "ACTIVE", prompt_input: STORED_PROMPT_INPUT, expired: true },
  });

  try {
    const { status, body } = await postJson(expired.baseUrl, "/interviews/session-kb/messages", {
      content: "One more thing.",
    });

    assert.equal(status, 201);
    assert.equal(body.completionReason, "TIME_LIMIT");

    const { conversation, ...input } = expired.calls.ai.closing;
    assert.deepEqual(input, expected);
  } finally {
    expired.server.close();
  }

  // The candidate ends the interview.
  const ended = await startKnowledgeServer({
    session: { id: "session-kb", status: "ACTIVE", prompt_input: STORED_PROMPT_INPUT },
  });

  try {
    const { status } = await postJson(ended.baseUrl, "/interviews/session-kb/complete", {
      reason: "USER_ENDED",
    });

    assert.equal(status, 200);

    const { conversation, ...input } = ended.calls.ai.closing;
    assert.deepEqual(input, expected);
  } finally {
    ended.server.close();
  }
});

test("sessions started before prompt_input existed keep the basic prompt input", async () => {
  const session = {
    id: "session-old",
    status: "ACTIVE",
    role_level: "entry",
    focus_area: "technical",
    prompt_input: null,
  };
  const { server, baseUrl, calls } = await startKnowledgeServer({ session });

  try {
    const { status } = await postJson(baseUrl, "/interviews/session-old/messages", {
      content: "I worked with AWS.",
    });

    assert.equal(status, 201);

    const { conversation, resumeContext, ...input } = calls.ai.followUp;
    assert.deepEqual(input, { role: "entry", company: null, interviewType: "technical" });
  } finally {
    server.close();
  }
});
