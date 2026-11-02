// Role & Company Knowledge Retrieval (Issue #16). The interview setup values
// the knowledge base understands. The frontend has the same lists in
// frontend/src/lib/interview/interview-options.ts; keep the two in sync.

const PRACTICE_GOALS = ["general", "specific"];

const INDUSTRIES = ["tech", "finance", "healthcare", "consulting"];

// Setup role levels map one-to-one onto the level tokens that knowledge
// sections declare ("levels: intern, entry"). No banding: a section is only
// eligible for the levels it lists, or for every level when it says "all".
const ROLE_LEVELS = ["intern", "entry", "mid", "senior", "lead"];

// "mixed" is the default framework when the focus area is missing or invalid.
const FOCUS_AREAS = [
  "behavioral",
  "technical",
  "system-design",
  "leadership",
  "mixed",
];

const DEFAULT_FOCUS_AREA = "mixed";

// Section tags name the focus areas a section is most useful for.
const FOCUS_TAGS = FOCUS_AREAS.filter((area) => area !== DEFAULT_FOCUS_AREA);

module.exports = {
  PRACTICE_GOALS,
  INDUSTRIES,
  ROLE_LEVELS,
  FOCUS_AREAS,
  DEFAULT_FOCUS_AREA,
  FOCUS_TAGS,
};
