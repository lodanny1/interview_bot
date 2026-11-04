const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  LIMITS,
  MESSAGES,
  hasResumeContent,
  normalizeResumeData,
  validateResumeReview,
} = require("./resume-review-validation");

const { buildResumeParserPrompt } = require("./resume-parser");

// The JSON structure the parser prompt asks the AI to return.
function parserTemplate() {
  const prompt = buildResumeParserPrompt("resume text");
  const start = prompt.indexOf("{");
  const end = prompt.indexOf("Rules:");

  return JSON.parse(prompt.slice(start, end));
}

// What the AI returns for a typical resume, including its usual quirks.
const AI_OUTPUT = {
  name: "  Jordan Lee ",
  email: "jordan@example.com",
  phone: 5551234567,
  location: "Seattle, WA",
  summary: "Backend developer.",
  skills: ["Python", " ", "AWS", null],
  education: [
    {
      institution: "State University",
      degree: "B.S.",
      field: "Computer Science",
      startDate: "2020",
      endDate: 2024,
    },
    {
      institution: null,
      degree: null,
      field: null,
      startDate: null,
      endDate: null,
    },
  ],
  experience: [
    {
      company: "Acme",
      role: "Software Intern",
      startDate: "June 2023",
      endDate: "Aug 2023",
      description: "Built REST APIs",
    },
  ],
  projects: [
    {
      name: "Interview Bot",
      description: ["Practice interview app"],
      technologies: ["Next.js", "Postgres"],
    },
  ],
  certifications: [],
};

const VALID = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "(555) 123-4567",
  location: "Seattle, WA",
  summary: "",
  skills: ["Python", "AWS"],
  certifications: [],
  education: [],
  experience: [
    {
      company: "Acme",
      role: "Software Intern",
      startDate: "June 2023",
      endDate: "Present",
      description: ["Built REST APIs"],
    },
  ],
  projects: [],
};

describe("normalizeResumeData", () => {
  it("finds no content in the parser prompt's own template", () => {
    const data = normalizeResumeData(parserTemplate());

    assert.deepEqual(data, {
      name: null,
      email: null,
      phone: null,
      location: null,
      summary: null,
      skills: [],
      certifications: [],
      education: [],
      experience: [],
      projects: [],
    });

    assert.equal(hasResumeContent(data), false);
  });

  it("cleans up typical AI output", () => {
    const data = normalizeResumeData(AI_OUTPUT);

    assert.equal(data.name, "Jordan Lee");
    assert.equal(data.phone, "5551234567");
    assert.deepEqual(data.skills, ["Python", "AWS"]);

    assert.deepEqual(data.education, [
      {
        institution: "State University",
        degree: "B.S.",
        field: "Computer Science",
        startDate: "2020",
        endDate: "2024",
      },
    ]);

    assert.deepEqual(data.experience[0].description, ["Built REST APIs"]);
    assert.equal(hasResumeContent(data), true);
  });

  it("rejects values that aren't a JSON object", () => {
    for (const value of [null, undefined, "text", 42, [AI_OUTPUT]]) {
      assert.equal(normalizeResumeData(value), null);
      assert.equal(hasResumeContent(normalizeResumeData(value)), false);
    }
  });

  it("does not count contact details alone as resume content", () => {
    const data = normalizeResumeData({
      name: "Jordan Lee",
      email: "jordan@example.com",
      summary: "Developer",
    });

    assert.equal(hasResumeContent(data), false);
  });
});

describe("validateResumeReview", () => {
  it("accepts valid information and returns it cleaned", () => {
    const result = validateResumeReview({
      ...VALID,
      name: " Jordan Lee ",
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.name, "Jordan Lee");
    assert.equal(result.data.summary, null);
    assert.equal(result.data.experience.length, 1);
  });

  it("requires a name and some resume content", () => {
    const result = validateResumeReview({
      ...VALID,
      name: "  ",
      skills: [],
      experience: [],
    });

    assert.equal(result.ok, false);
    assert.equal(result.fieldErrors.name, MESSAGES.required("Name"));
    assert.equal(result.fieldErrors.content, MESSAGES.noContent);
  });

  it("treats a missing or non-object body as missing information", () => {
    for (const body of [undefined, null, "text", []]) {
      const result = validateResumeReview(body);

      assert.equal(result.ok, false);
      assert.ok(result.fieldErrors.name);
      assert.ok(result.fieldErrors.content);
    }
  });

  it("rejects an invalid email or phone number", () => {
    for (const [email, phone] of [
      ["jordan@", "call me"],
      ["jordan example.com", "12345"],
    ]) {
      const result = validateResumeReview({ ...VALID, email, phone });

      assert.equal(result.ok, false);
      assert.equal(result.fieldErrors.email, MESSAGES.email);
      assert.equal(result.fieldErrors.phone, MESSAGES.phone);
    }
  });

  it("accepts common phone formats", () => {
    for (const phone of ["+1 555 123 4567", "555.123.4567", "(555) 123-4567"]) {
      assert.equal(validateResumeReview({ ...VALID, phone }).ok, true);
    }
  });

  it("keys entry errors by the entry's position in the submitted list", () => {
    const result = validateResumeReview({
      ...VALID,
      education: [
        { institution: "", degree: "" },
        { institution: "", degree: "B.S." },
      ],
      experience: [
        { company: "Acme", role: "", description: [] },
      ],
    });

    assert.equal(result.ok, false);

    assert.deepEqual(result.fieldErrors, {
      "education.1.institution": MESSAGES.required("Institution"),
      "experience.0.role": MESSAGES.required("Role"),
    });
  });

  it("drops blank entries from the saved data", () => {
    const result = validateResumeReview({
      ...VALID,
      projects: [
        { name: "", description: [], technologies: [] },
        { name: "Interview Bot", description: [], technologies: ["Next.js"] },
      ],
    });

    assert.equal(result.ok, true);

    assert.deepEqual(result.data.projects, [
      {
        name: "Interview Bot",
        description: [],
        technologies: ["Next.js"],
      },
    ]);
  });

  it("enforces length and count limits", () => {
    const result = validateResumeReview({
      ...VALID,
      name: "x".repeat(LIMITS.name + 1),
      skills: Array.from({ length: LIMITS.skills + 1 }, (_, i) => `Skill ${i}`),
      certifications: ["x".repeat(LIMITS.text + 1)],
      experience: Array.from({ length: LIMITS.entries + 1 }, () => ({
        company: "Acme",
        role: "Intern",
      })),
    });

    assert.equal(result.ok, false);
    assert.equal(result.fieldErrors.name, MESSAGES.tooLong("Name", LIMITS.name));
    assert.equal(result.fieldErrors.skills, MESSAGES.tooMany("skills", LIMITS.skills));

    assert.equal(
      result.fieldErrors.certifications,
      MESSAGES.itemTooLong("certification", LIMITS.text)
    );

    assert.equal(
      result.fieldErrors.experience,
      MESSAGES.tooMany("experience entries", LIMITS.entries)
    );
  });
});
