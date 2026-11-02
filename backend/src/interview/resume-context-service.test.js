const assert = require("node:assert/strict");
const test = require("node:test");

const resumeRepository = require("../resumes/resume-repository");

const originalGetResume = resumeRepository.getResume;

function reloadService() {
  delete require.cache[
    require.resolve("./resume-context-service")
  ];

  return require("./resume-context-service");
}

test.afterEach(() => {
  resumeRepository.getResume = originalGetResume;

  delete require.cache[
    require.resolve("./resume-context-service")
  ];
});

test("buildInterviewResumeContext keeps interview-relevant fields only", () => {
  const {
    buildInterviewResumeContext,
  } = require("./resume-context-service");

  const context = buildInterviewResumeContext({
    name: "Danny Lo",
    email: "danny@example.com",
    phone: "555-1234",
    location: "Los Angeles, CA",
    summary: "AWS certified software engineer",
    skills: ["AWS", "Python"],
    education: [
      {
        institution: "CSULB",
        degree: "B.S.",
        field: "Computer Science",
      },
    ],
    experience: [
      {
        company: "AWS",
        role: "Cloud Support Engineer Intern",
      },
    ],
    projects: [
      {
        name: "Interview Bot",
      },
    ],
    certifications: [
      "AWS Certified Solutions Architect - Associate",
    ],
  });

  assert.deepEqual(context, {
    summary: "AWS certified software engineer",
    skills: ["AWS", "Python"],
    education: [
      {
        institution: "CSULB",
        degree: "B.S.",
        field: "Computer Science",
      },
    ],
    experience: [
      {
        company: "AWS",
        role: "Cloud Support Engineer Intern",
      },
    ],
    projects: [
      {
        name: "Interview Bot",
      },
    ],
    certifications: [
      "AWS Certified Solutions Architect - Associate",
    ],
  });

  assert.equal("email" in context, false);
  assert.equal("phone" in context, false);
  assert.equal("location" in context, false);
  assert.equal("name" in context, false);
});

test("buildInterviewResumeContext normalizes missing arrays", () => {
  const {
    buildInterviewResumeContext,
  } = require("./resume-context-service");

  const context = buildInterviewResumeContext({
    summary: "Cloud engineer",
  });

  assert.deepEqual(context, {
    summary: "Cloud engineer",
    skills: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
  });
});

test("buildInterviewResumeContext returns null for missing parsed JSON", () => {
  const {
    buildInterviewResumeContext,
  } = require("./resume-context-service");

  assert.equal(
    buildInterviewResumeContext(null),
    null
  );
});

test("getResumeContext returns parsed interview context", async () => {
  resumeRepository.getResume = async (
    userId,
    resumeId
  ) => ({
    id: resumeId,
    user_id: userId,
    parse_status: "COMPLETED",
    parsed_json: {
      summary: "Cloud engineer",
      skills: ["AWS", "Python"],
      education: [],
      experience: [
        {
          company: "AWS",
          role: "Cloud Support Engineer Intern",
        },
      ],
      projects: [],
      certifications: [],
      email: "hidden@example.com",
    },
  });

  const {
    getResumeContext,
  } = reloadService();

  const result = await getResumeContext({
    userId: "user-123",
    resumeId: "resume-123",
  });

  assert.equal(
    result.resumeId,
    "resume-123"
  );

  assert.deepEqual(
    result.context.skills,
    ["AWS", "Python"]
  );

  assert.equal(
    "email" in result.context,
    false
  );
});

test("getResumeContext rejects a missing resume", async () => {
  resumeRepository.getResume = async () => null;

  const {
    getResumeContext,
  } = reloadService();

  await assert.rejects(
    () =>
      getResumeContext({
        userId: "user-123",
        resumeId: "resume-missing",
      }),
    (error) => {
      assert.equal(
        error.code,
        "NOT_FOUND"
      );

      return true;
    }
  );
});

test("getResumeContext rejects an unparsed resume", async () => {
  resumeRepository.getResume = async () => ({
    id: "resume-123",
    parse_status: "PENDING",
    parsed_json: null,
  });

  const {
    getResumeContext,
  } = reloadService();

  await assert.rejects(
    () =>
      getResumeContext({
        userId: "user-123",
        resumeId: "resume-123",
      }),
    (error) => {
      assert.equal(
        error.code,
        "RESUME_NOT_PARSED"
      );

      return true;
    }
  );
});

test("getResumeContext validates required ids", async () => {
  const {
    getResumeContext,
  } = reloadService();

  await assert.rejects(
    () =>
      getResumeContext({
        resumeId: "resume-123",
      }),
    /userId is required/
  );

  await assert.rejects(
    () =>
      getResumeContext({
        userId: "user-123",
      }),
    /resumeId is required/
  );
});
