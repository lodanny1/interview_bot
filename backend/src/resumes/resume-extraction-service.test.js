const assert = require("node:assert/strict");
const test = require("node:test");

const repository = require("./resume-repository");
const storage = require("./resume-storage");
const extractor = require("./resume-extractor");
const parser = require("./resume-parser");

const originals = {
  getResume: repository.getResume,
  markResumeProcessing: repository.markResumeProcessing,
  saveResumeExtraction: repository.saveResumeExtraction,
  markResumeExtractionFailed: repository.markResumeExtractionFailed,
  getResumeObject: storage.getResumeObject,
  extractResumeText: extractor.extractResumeText,
  parseResume: parser.parseResume,
};

function reloadService() {
  delete require.cache[
    require.resolve("./resume-extraction-service")
  ];

  return require("./resume-extraction-service");
}

test.afterEach(() => {
  repository.getResume = originals.getResume;
  repository.markResumeProcessing =
    originals.markResumeProcessing;
  repository.saveResumeExtraction =
    originals.saveResumeExtraction;
  repository.markResumeExtractionFailed =
    originals.markResumeExtractionFailed;

  storage.getResumeObject =
    originals.getResumeObject;

  extractor.extractResumeText =
    originals.extractResumeText;

  parser.parseResume =
    originals.parseResume;

  delete require.cache[
    require.resolve("./resume-extraction-service")
  ];
});

test("extractAndParseResume completes extraction successfully", async () => {
  const calls = [];

  repository.getResume = async (
    userId,
    resumeId
  ) => {
    calls.push(["getResume", userId, resumeId]);

    return {
      id: resumeId,
      user_id: userId,
      s3_key: "resumes/user/resume.pdf",
      content_type: "application/pdf",
    };
  };

  repository.markResumeProcessing = async (
    userId,
    resumeId
  ) => {
    calls.push([
      "markResumeProcessing",
      userId,
      resumeId,
    ]);
  };

  storage.getResumeObject = async (key) => {
    calls.push(["getResumeObject", key]);

    return {
      body: {},
      contentType: "application/pdf",
    };
  };

  extractor.extractResumeText = async ({
    body,
    contentType,
  }) => {
    calls.push([
      "extractResumeText",
      body,
      contentType,
    ]);

    return "Danny Lo\nAWS\nPython";
  };

  parser.parseResume = async (text) => {
    calls.push(["parseResume", text]);

    return {
      parsedJson: {
        name: "Danny Lo",
        skills: ["AWS", "Python"],
      },
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };
  };

  repository.saveResumeExtraction =
    async ({
      userId,
      resumeId,
      parsedText,
      parsedJson,
    }) => {
      calls.push([
        "saveResumeExtraction",
        userId,
        resumeId,
        parsedText,
        parsedJson,
      ]);

      return {
        id: resumeId,
        user_id: userId,
        parse_status: "COMPLETED",
        parsed_text: parsedText,
        parsed_json: parsedJson,
      };
    };

  const {
    extractAndParseResume,
  } = reloadService();

  const result = await extractAndParseResume({
    userId: "user-123",
    resumeId: "resume-123",
  });

  assert.equal(
    result.resume.parse_status,
    "COMPLETED"
  );

  assert.equal(
    result.resume.parsed_text,
    "Danny Lo\nAWS\nPython"
  );

  assert.deepEqual(
    result.resume.parsed_json.skills,
    ["AWS", "Python"]
  );

  assert.deepEqual(result.usage, {
    input_tokens: 100,
    output_tokens: 50,
  });

  assert.deepEqual(
    calls.map((call) => call[0]),
    [
      "getResume",
      "markResumeProcessing",
      "getResumeObject",
      "extractResumeText",
      "parseResume",
      "saveResumeExtraction",
    ]
  );
});

test("extractAndParseResume rejects when resume does not belong to user", async () => {
  repository.getResume = async () => null;

  const {
    extractAndParseResume,
  } = reloadService();

  await assert.rejects(
    () =>
      extractAndParseResume({
        userId: "user-123",
        resumeId: "resume-999",
      }),
    (error) => {
      assert.equal(
        error.message,
        "Resume not found."
      );

      assert.equal(
        error.code,
        "NOT_FOUND"
      );

      return true;
    }
  );
});

test("extractAndParseResume marks resume failed when extraction fails", async () => {
  let failureRecord = null;

  repository.getResume = async () => ({
    id: "resume-123",
    user_id: "user-123",
    s3_key: "resumes/user/resume.pdf",
    content_type: "application/pdf",
  });

  repository.markResumeProcessing =
    async () => {};

  storage.getResumeObject = async () => ({
    body: {},
    contentType: "application/pdf",
  });

  extractor.extractResumeText =
    async () => {
      throw new Error(
        "Unable to extract text."
      );
    };

  repository.markResumeExtractionFailed =
    async (input) => {
      failureRecord = input;
    };

  const {
    extractAndParseResume,
  } = reloadService();

  await assert.rejects(
    () =>
      extractAndParseResume({
        userId: "user-123",
        resumeId: "resume-123",
      }),
    /Unable to extract text/
  );

  assert.deepEqual(failureRecord, {
    userId: "user-123",
    resumeId: "resume-123",
    errorMessage:
      "Unable to extract text.",
  });
});

// Issue #08: AI output with no usable resume content must not be COMPLETED.
for (const [label, parsedJson] of [
  ["an empty object", {}],
  ["an array", [{ skills: ["AWS"] }]],
  [
    "the prompt's all-null example",
    {
      name: null,
      skills: [],
      education: [{ institution: null, degree: null }],
      experience: [{ company: null, role: null, description: [] }],
      projects: [{ name: null, description: [], technologies: [] }],
      certifications: [],
    },
  ],
]) {
  test(`extractAndParseResume marks resume failed when AI returns ${label}`, async () => {
    let failureRecord = null;
    let saved = false;

    repository.getResume = async () => ({
      id: "resume-123",
      user_id: "user-123",
      s3_key: "resumes/user/resume.pdf",
      content_type: "application/pdf",
    });

    repository.markResumeProcessing =
      async () => {};

    storage.getResumeObject = async () => ({
      body: {},
      contentType: "application/pdf",
    });

    extractor.extractResumeText =
      async () => "Some resume text";

    parser.parseResume = async () => ({
      parsedJson,
      usage: null,
    });

    repository.saveResumeExtraction =
      async () => {
        saved = true;
      };

    repository.markResumeExtractionFailed =
      async (input) => {
        failureRecord = input;
      };

    const {
      extractAndParseResume,
    } = reloadService();

    await assert.rejects(
      () =>
        extractAndParseResume({
          userId: "user-123",
          resumeId: "resume-123",
        }),
      (error) => {
        assert.equal(
          error.code,
          "UNUSABLE_RESUME_DATA"
        );

        return true;
      }
    );

    assert.equal(saved, false);

    assert.deepEqual(failureRecord, {
      userId: "user-123",
      resumeId: "resume-123",
      errorMessage:
        "No usable resume information was found.",
    });
  });
}

test("extractAndParseResume validates required IDs", async () => {
  const {
    extractAndParseResume,
  } = reloadService();

  await assert.rejects(
    () =>
      extractAndParseResume({
        resumeId: "resume-123",
      }),
    /userId is required/
  );

  await assert.rejects(
    () =>
      extractAndParseResume({
        userId: "user-123",
      }),
    /resumeId is required/
  );
});