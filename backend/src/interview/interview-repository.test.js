const assert = require("node:assert/strict");
const test = require("node:test");

const postgres = require("../db/postgres");

const originalCreatePool = postgres.createPool;

test.afterEach(() => {
  postgres.createPool = originalCreatePool;

  delete require.cache[
    require.resolve("./interview-repository")
  ];
});

function makePool({
  rows = [],
  onQuery = null,
} = {}) {
  return {
    query: async (sql, params) => {
      if (onQuery) {
        onQuery(sql, params);
      }

      return { rows };
    },

    end: async () => {},
  };
}

test("createInterviewSession inserts a session", async () => {
  let capturedSql;
  let capturedParams;

  postgres.createPool = async () =>
    makePool({
      rows: [
        {
          id: "session-123",
          user_id: "user-123",
          resume_id: "resume-123",
          goal: "general",
          title: "Practice Interview",
          focus_area: "technical",
          mode: "text",
          status: "ACTIVE",
        },
      ],
      onQuery: (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
      },
    });

  delete require.cache[
    require.resolve("./interview-repository")
  ];

  const {
    createInterviewSession,
  } = require("./interview-repository");

  const result = await createInterviewSession({
    userId: "user-123",
    resumeId: "resume-123",
    goal: "general",
    title: "Practice Interview",
    focusArea: "technical",
    mode: "text",
    industry: "technology",
    roleLevel: "entry",
    experienceLevel: "junior",
    jobDescription: "Example description",
  });

  assert.match(
    capturedSql,
    /INSERT INTO interview_sessions/
  );

  assert.deepEqual(
    capturedParams,
    [
      "user-123",
      "resume-123",
      "general",
      "Practice Interview",
      "technical",
      "text",
      "technology",
      "entry",
      "junior",
      "Example description",
    ]
  );

  assert.equal(
    result.id,
    "session-123"
  );
});

test("getInterviewSession is scoped by user ownership", async () => {
  let capturedSql;
  let capturedParams;

  postgres.createPool = async () =>
    makePool({
      rows: [
        {
          id: "session-123",
          user_id: "user-123",
        },
      ],
      onQuery: (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
      },
    });

  delete require.cache[
    require.resolve("./interview-repository")
  ];

  const {
    getInterviewSession,
  } = require("./interview-repository");

  const result = await getInterviewSession(
    "user-123",
    "session-123"
  );

  assert.match(
    capturedSql,
    /user_id = \$2/
  );

  assert.deepEqual(
    capturedParams,
    [
      "session-123",
      "user-123",
    ]
  );

  assert.equal(
    result.id,
    "session-123"
  );
});

test("addInterviewMessage inserts a message", async () => {
  let capturedParams;

  postgres.createPool = async () =>
    makePool({
      rows: [
        {
          id: "message-123",
          session_id: "session-123",
          role: "candidate",
          content: "My answer",
        },
      ],
      onQuery: (_sql, params) => {
        capturedParams = params;
      },
    });

  delete require.cache[
    require.resolve("./interview-repository")
  ];

  const {
    addInterviewMessage,
  } = require("./interview-repository");

  const result = await addInterviewMessage({
    sessionId: "session-123",
    role: "candidate",
    content: "  My answer  ",
  });

  assert.deepEqual(
    capturedParams,
    [
      "session-123",
      "candidate",
      "My answer",
    ]
  );

  assert.equal(
    result.content,
    "My answer"
  );
});

test("getInterviewMessages returns transcript in order", async () => {
  let capturedSql;

  postgres.createPool = async () =>
    makePool({
      rows: [
        {
          id: "message-1",
          session_id: "session-123",
          role: "interviewer",
          content: "Hello",
        },
        {
          id: "message-2",
          session_id: "session-123",
          role: "candidate",
          content: "Hi",
        },
      ],
      onQuery: (sql) => {
        capturedSql = sql;
      },
    });

  delete require.cache[
    require.resolve("./interview-repository")
  ];

  const {
    getInterviewMessages,
  } = require("./interview-repository");

  const result = await getInterviewMessages(
    "session-123"
  );

  assert.match(
    capturedSql,
    /ORDER BY created_at ASC, id ASC/
  );

  assert.equal(
    result.length,
    2
  );
});

test("repository validates required ids and message content", async () => {
  const {
    createInterviewSession,
    getInterviewSession,
    addInterviewMessage,
    getInterviewMessages,
  } = require("./interview-repository");

  await assert.rejects(
    () =>
      createInterviewSession({
        goal: "general",
        title: "Test",
        focusArea: "technical",
        mode: "text",
      }),
    /userId is required/
  );

  await assert.rejects(
    () =>
      getInterviewSession(
        "user-123"
      ),
    /sessionId is required/
  );

  await assert.rejects(
    () =>
      addInterviewMessage({
        sessionId: "session-123",
        role: "system",
        content: "Hello",
      }),
    /role must be interviewer or candidate/
  );

  await assert.rejects(
    () =>
      addInterviewMessage({
        sessionId: "session-123",
        role: "candidate",
        content: "   ",
      }),
    /content is required/
  );

  await assert.rejects(
    () =>
      getInterviewMessages(),
    /sessionId is required/
  );
});
