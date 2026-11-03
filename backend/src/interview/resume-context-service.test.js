const assert = require("node:assert/strict");
const test = require("node:test");

const resumeReviewRepository = require("../resumes/resume-review-repository");
const resumeExtractionService = require("../resumes/resume-extraction-service");

const originalGetResumeReview =
  resumeReviewRepository.getResumeReview;
const originalExtractAndParseResume =
  resumeExtractionService.extractAndParseResume;

function reloadService() {
  delete require.cache[
    require.resolve("./resume-context-service")
  ];

  return require("./resume-context-service");
}

test.afterEach(() => {
  resumeReviewRepository.getResumeReview =
    originalGetResumeReview;
  resumeExtractionService.extractAndParseResume =
    originalExtractAndParseResume;

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
  resumeReviewRepository.getResumeReview = async (
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
  resumeReviewRepository.getResumeReview = async () => null;

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
  let extractCalls = 0;

  resumeReviewRepository.getResumeReview = async () => ({
    id: "resume-123",
    parse_status: "PENDING",
    parsed_json: null,
  });

  resumeExtractionService.extractAndParseResume =
    async () => {
      extractCalls += 1;
    };

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

  assert.equal(extractCalls, 0);
});

test("getResumeContext prefers the reviewed information over the extraction", async () => {
  resumeReviewRepository.getResumeReview = async () => ({
    id: "resume-123",
    parse_status: "COMPLETED",
    parsed_json: {
      summary: "Extracted summary",
      skills: ["Pyhton"],
    },
    reviewed_json: {
      name: "Jordan Lee",
      summary: "Reviewed summary",
      skills: ["Python", "AWS"],
      education: [],
      experience: [],
      projects: [],
      certifications: [],
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
    result.context.summary,
    "Reviewed summary"
  );

  assert.deepEqual(
    result.context.skills,
    ["Python", "AWS"]
  );

  assert.equal("name" in result.context, false);
});

test("getResumeContext extracts an unparsed resume first when extractIfNeeded is set", async () => {
  const extractInputs = [];
  let parsed = false;

  resumeReviewRepository.getResumeReview = async () =>
    parsed
      ? {
          id: "resume-123",
          parse_status: "COMPLETED",
          parsed_json: {
            summary: "Cloud engineer",
            skills: ["AWS"],
          },
          reviewed_json: null,
        }
      : {
          id: "resume-123",
          parse_status: "PENDING",
          parsed_json: null,
          reviewed_json: null,
        };

  resumeExtractionService.extractAndParseResume =
    async (input) => {
      extractInputs.push(input);
      parsed = true;
    };

  const {
    getResumeContext,
  } = reloadService();

  const result = await getResumeContext({
    userId: "user-123",
    resumeId: "resume-123",
    extractIfNeeded: true,
  });

  assert.deepEqual(extractInputs, [
    {
      userId: "user-123",
      resumeId: "resume-123",
    },
  ]);

  assert.deepEqual(result.context.skills, ["AWS"]);
});

test("getResumeContext does not extract a resume that is already parsed", async () => {
  let extractCalls = 0;

  resumeReviewRepository.getResumeReview = async () => ({
    id: "resume-123",
    parse_status: "COMPLETED",
    parsed_json: {
      summary: "Cloud engineer",
    },
    reviewed_json: null,
  });

  resumeExtractionService.extractAndParseResume =
    async () => {
      extractCalls += 1;
    };

  const {
    getResumeContext,
  } = reloadService();

  await getResumeContext({
    userId: "user-123",
    resumeId: "resume-123",
    extractIfNeeded: true,
  });

  assert.equal(extractCalls, 0);
});

test("getResumeContext propagates extraction errors", async () => {
  resumeReviewRepository.getResumeReview = async () => ({
    id: "resume-123",
    parse_status: "FAILED",
    parsed_json: null,
    reviewed_json: null,
  });

  resumeExtractionService.extractAndParseResume =
    async () => {
      const error = new Error(
        "No usable resume information was found."
      );
      error.code = "UNUSABLE_RESUME_DATA";
      throw error;
    };

  const {
    getResumeContext,
  } = reloadService();

  await assert.rejects(
    () =>
      getResumeContext({
        userId: "user-123",
        resumeId: "resume-123",
        extractIfNeeded: true,
      }),
    (error) => {
      assert.equal(
        error.code,
        "UNUSABLE_RESUME_DATA"
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
