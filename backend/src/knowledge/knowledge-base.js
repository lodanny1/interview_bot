// Role & Company Knowledge Retrieval (Issue #16). Loads the Markdown knowledge
// base from ./content, validates it, splits it into sections and builds the
// search indexes. The file format is described in ./README.md.
//
// Invalid files are skipped (and logged by path and error code) so one bad
// file can't take retrieval down. The content test fails CI on any error.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { createBm25Index } = require("./bm25");
const {
  FOCUS_AREAS,
  FOCUS_TAGS,
  INDUSTRIES,
  ROLE_LEVELS,
} = require("./interview-options");
const {
  compareStrings,
  normalizeCompanyName,
  phraseTokens,
  searchTokens,
} = require("./text");

// Relative to this module, so it works in the Docker image (which copies
// backend/src) as well as locally.
const CONTENT_DIR = path.join(__dirname, "content");

// Bump when the file grammar or how files are read changes. It is part of the
// version hash.
const FORMAT_VERSION = 1;

const KIND_DIRECTORIES = {
  framework: "frameworks",
  role: "roles",
  industry: "industries",
  company: "companies",
};

const KINDS = Object.keys(KIND_DIRECTORIES);

const LIMITS = {
  fileChars: 16000,
  titleChars: 80,
  aliasChars: 80,
  aliasesPerDocument: 20,
  keywordChars: 40,
  keywordsPerDocument: 40,
  sectionsPerDocument: 8,
  sectionMinChars: 40,
  sectionMaxChars: 1200,
  sourcesPerSection: 5,
  urlChars: 300,
};

// Header fields: which kinds may use them and how often they may appear.
const HEADER_FIELDS = {
  id: { kinds: KINDS, min: 1, max: 1 },
  kind: { kinds: KINDS, min: 1, max: 1 },
  title: { kinds: KINDS, min: 1, max: 1 },
  reviewed: { kinds: KINDS, min: 1, max: 1 },
  alias: { kinds: ["company", "role"], min: 0, max: LIMITS.aliasesPerDocument },
  keywords: { kinds: ["role"], min: 0, max: 1 },
  industry: { kinds: ["company"], min: 0, max: 1 },
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEADER_LINE = /^([a-z]+): (.*)$/;
const SECTION_HEADING = /^## (.+?) \{#([a-z0-9]+(?:-[a-z0-9]+)*)\}$/;
const SECTION_META_LINE = /^(levels|tags|source): (.*)$/;
const REQUIRED_SECTION = "overview";

function normalizeLineEndings(text) {
  return String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Allows one day of clock and time zone slack.
function latestAllowedDate(today) {
  const base = today ? new Date(`${today}T00:00:00Z`) : new Date();

  return new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isValidSourceUrl(value) {
  if (value.length > LIMITS.urlChars || /\s/.test(value)) return false;

  let url;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    url.hostname.includes(".")
  );
}

// The formatted context uses <tags> as delimiters, so content may not.
function hasAngleBrackets(value) {
  return /[<>]/.test(value);
}

function splitList(value) {
  return value.split(",").map((item) => item.trim());
}

function kindForDirectory(directory) {
  return KINDS.find((kind) => KIND_DIRECTORIES[kind] === directory) || null;
}

function kindForFile(file) {
  return kindForDirectory(String(file).split("/")[0]);
}

function parseHeader(lines, fail) {
  const fields = new Map();

  if (lines[0] !== "---") {
    fail(1, "missing_header", "the file must start with a --- line");
    return null;
  }

  const end = lines.indexOf("---", 1);

  if (end === -1) {
    fail(1, "unterminated_header", "the header needs a closing --- line");
    return null;
  }

  for (let index = 1; index < end; index += 1) {
    const match = HEADER_LINE.exec(lines[index]);

    if (!match) {
      fail(index + 1, "invalid_header_line", "expected 'key: value'");
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.trim();

    if (!HEADER_FIELDS[key]) {
      fail(index + 1, "unknown_field", key);
      continue;
    }

    if (!value) {
      fail(index + 1, "empty_field", key);
      continue;
    }

    if (!fields.has(key)) fields.set(key, []);
    fields.get(key).push({ value, line: index + 1 });
  }

  return { fields, end };
}

function parseSectionMeta(metaLines, fail) {
  const meta = { levels: "all", tags: [], sources: [] };
  const seen = new Set();

  for (const { key, value, line } of metaLines) {
    if (key !== "source" && seen.has(key)) {
      fail(line, "duplicate_section_field", key);
      continue;
    }

    seen.add(key);

    if (key === "levels") {
      const levels = splitList(value);

      if (levels.length === 1 && levels[0] === "all") {
        meta.levels = "all";
      } else if (
        levels.some((level) => !ROLE_LEVELS.includes(level)) ||
        new Set(levels).size !== levels.length
      ) {
        fail(line, "invalid_levels", `use 'all' or ${ROLE_LEVELS.join(", ")}`);
      } else {
        meta.levels = ROLE_LEVELS.filter((level) => levels.includes(level));
      }
    } else if (key === "tags") {
      const tags = splitList(value);

      if (
        tags.some((tag) => !FOCUS_TAGS.includes(tag)) ||
        new Set(tags).size !== tags.length
      ) {
        fail(line, "unknown_tag", `known tags: ${FOCUS_TAGS.join(", ")}`);
      } else {
        meta.tags = FOCUS_TAGS.filter((tag) => tags.includes(tag));
      }
    } else if (!isValidSourceUrl(value)) {
      fail(line, "invalid_source_url", "sources must be https URLs");
    } else if (meta.sources.includes(value)) {
      fail(line, "duplicate_source", "the same URL is listed twice");
    } else {
      meta.sources.push(value);
    }
  }

  return meta;
}

function parseSections(lines, start, documentId, fail) {
  const sections = [];
  let index = start;

  while (index < lines.length && !lines[index].trim()) index += 1;

  if (index < lines.length && !lines[index].startsWith("## ")) {
    fail(index + 1, "text_before_first_section", "content must start with a ## section");
  }

  while (index < lines.length && !lines[index].startsWith("## ")) index += 1;

  while (index < lines.length) {
    const headingLine = index + 1;
    const heading = SECTION_HEADING.exec(lines[index]);
    index += 1;

    const metaLines = [];

    while (index < lines.length && SECTION_META_LINE.test(lines[index])) {
      const [, key, value] = SECTION_META_LINE.exec(lines[index]);
      metaLines.push({ key, value: value.trim(), line: index + 1 });
      index += 1;
    }

    if (index < lines.length && lines[index].trim() && !lines[index].startsWith("## ")) {
      fail(index + 1, "invalid_section_metadata", "after the heading, only levels/tags/source lines, then a blank line");
    }

    const bodyLines = [];

    while (index < lines.length && !lines[index].startsWith("## ")) {
      bodyLines.push(lines[index]);
      index += 1;
    }

    if (!heading) {
      fail(headingLine, "invalid_section_heading", "expected '## Title {#section-id}'");
      continue;
    }

    const [, title, slug] = heading;
    const meta = parseSectionMeta(metaLines, fail);
    const body = bodyLines.join("\n").trim();

    sections.push({
      id: `${documentId}#${slug}`,
      slug,
      title: title.trim(),
      ...meta,
      body,
      line: headingLine,
    });
  }

  return sections;
}

function checkTitle(value, line, fail, code, maxChars = LIMITS.titleChars) {
  if (value.length > maxChars) {
    fail(line, code, `keep it to ${maxChars} characters`);
  } else if (hasAngleBrackets(value)) {
    fail(line, code, "< and > are not allowed");
  }
}

// Returns { document } or { errors }. A file with any error is skipped whole.
function parseDocument(file, rawText, options = {}) {
  const errors = [];
  const fail = (line, code, detail) => errors.push({ file, line, code, detail });
  const text = normalizeLineEndings(rawText);

  if (text.length > LIMITS.fileChars) {
    fail(0, "file_too_large", `keep files under ${LIMITS.fileChars} characters`);
    return { errors };
  }

  const pathParts = String(file).split("/");
  const directoryKind = pathParts.length === 2 ? kindForDirectory(pathParts[0]) : null;
  const basename = pathParts.length === 2 ? pathParts[1].replace(/\.md$/, "") : "";

  if (!directoryKind || !pathParts[1].endsWith(".md") || !SLUG_PATTERN.test(basename)) {
    fail(0, "invalid_file_path", "files live at <kind folder>/<lowercase-slug>.md");
    return { errors };
  }

  const lines = text.split("\n");
  const header = parseHeader(lines, fail);

  if (!header) return { errors };

  const { fields } = header;
  const one = (key) => (fields.get(key) ? fields.get(key)[0] : null);
  const kindField = one("kind");
  const kind = kindField ? kindField.value : null;

  if (kind && kind !== directoryKind) {
    fail(kindField.line, "kind_mismatch", `files in ${pathParts[0]}/ must be kind ${directoryKind}`);
  }

  for (const [key, rule] of Object.entries(HEADER_FIELDS)) {
    const entries = fields.get(key) || [];

    if (entries.length > 0 && !rule.kinds.includes(directoryKind)) {
      fail(entries[0].line, "field_not_allowed", `${key} is not used by ${directoryKind} files`);
    } else if (rule.kinds.includes(directoryKind) && entries.length < rule.min) {
      fail(0, "missing_field", key);
    } else if (entries.length > rule.max) {
      fail(entries[rule.max].line, "too_many_values", key);
    }
  }

  const expectedId = `${directoryKind}.${basename}`;
  const idField = one("id");

  if (idField && idField.value !== expectedId) {
    fail(idField.line, "id_mismatch", `expected id ${expectedId}`);
  }

  const titleField = one("title");

  if (titleField) checkTitle(titleField.value, titleField.line, fail, "invalid_title");

  const reviewedField = one("reviewed");

  if (reviewedField) {
    if (!isValidDate(reviewedField.value)) {
      fail(reviewedField.line, "invalid_date", "use YYYY-MM-DD");
    } else if (reviewedField.value > latestAllowedDate(options.today)) {
      fail(reviewedField.line, "future_date", "reviewed date is in the future");
    }
  }

  const aliases = (fields.get("alias") || []).map((entry) => entry.value);

  for (const entry of fields.get("alias") || []) {
    checkTitle(entry.value, entry.line, fail, "invalid_alias", LIMITS.aliasChars);
  }

  if (directoryKind === "role" && aliases.length === 0) {
    fail(0, "missing_field", "role files need at least one alias (a job title)");
  }

  // Exact-match keys. Company keys include the title; role keys are aliases.
  const matchKeys = [];

  if (directoryKind === "company" || directoryKind === "role") {
    const names = [...(fields.get("alias") || [])];

    if (directoryKind === "company" && titleField) names.unshift(titleField);

    const seen = new Set();

    for (const entry of names) {
      const key =
        directoryKind === "company"
          ? normalizeCompanyName(entry.value)
          : phraseTokens(entry.value).join(" ");

      if (!key) {
        fail(entry.line, "empty_alias", "the name has no letters or digits once normalized");
      } else if (seen.has(key)) {
        fail(entry.line, "duplicate_alias", `normalizes to '${key}' like another name in this file`);
      } else {
        seen.add(key);
        matchKeys.push(key);
      }
    }
  }

  let keywords = [];
  const keywordsField = one("keywords");

  if (keywordsField) {
    keywords = splitList(keywordsField.value);

    if (
      keywords.length > LIMITS.keywordsPerDocument ||
      keywords.some(
        (keyword) => !/^[a-z0-9][a-z0-9 -]*$/.test(keyword) || keyword.length > LIMITS.keywordChars
      )
    ) {
      fail(keywordsField.line, "invalid_keywords", "lowercase words separated by commas");
    }
  }

  const industryField = one("industry");

  if (industryField && !INDUSTRIES.includes(industryField.value)) {
    fail(industryField.line, "unknown_industry", `known industries: ${INDUSTRIES.join(", ")}`);
  }

  const sections = parseSections(lines, header.end + 1, expectedId, fail);
  const slugs = new Set();

  for (const section of sections) {
    if (slugs.has(section.slug)) {
      fail(section.line, "duplicate_section_id", section.slug);
    }

    slugs.add(section.slug);
    checkTitle(section.title, section.line, fail, "invalid_section_title");

    if (section.body.length < LIMITS.sectionMinChars) {
      fail(section.line, "section_too_short", `at least ${LIMITS.sectionMinChars} characters`);
    } else if (section.body.length > LIMITS.sectionMaxChars) {
      fail(section.line, "section_too_long", `at most ${LIMITS.sectionMaxChars} characters`);
    }

    if (hasAngleBrackets(section.body)) {
      fail(section.line, "angle_brackets", "< and > are not allowed in section text");
    }

    if (section.sources.length > LIMITS.sourcesPerSection) {
      fail(section.line, "too_many_sources", `at most ${LIMITS.sourcesPerSection}`);
    }

    if (directoryKind === "company" && section.sources.length === 0) {
      fail(section.line, "missing_source", "every company section needs a source line");
    }
  }

  if (sections.length > LIMITS.sectionsPerDocument) {
    fail(0, "too_many_sections", `at most ${LIMITS.sectionsPerDocument}`);
  }

  const overview = sections.find((section) => section.slug === REQUIRED_SECTION);

  if (!overview) {
    fail(0, "missing_section", `every file needs a {#${REQUIRED_SECTION}} section`);
  } else if (overview.levels !== "all") {
    fail(overview.line, "invalid_levels", "the overview section must apply to all levels");
  }

  if (directoryKind === "role") {
    for (const level of ROLE_LEVELS) {
      if (!sections.some((section) => Array.isArray(section.levels) && section.levels.includes(level))) {
        fail(0, "missing_level", `role files need a section for '${level}'`);
      }
    }
  }

  if (errors.length > 0) return { errors };

  const documentId = expectedId;

  return {
    document: {
      id: documentId,
      kind: directoryKind,
      title: titleField.value,
      file,
      reviewed: reviewedField.value,
      aliases,
      keywords,
      industry: industryField ? industryField.value : null,
      matchKeys,
      text,
      sections: sections.map((section, order) => ({
        id: section.id,
        slug: section.slug,
        documentId,
        kind: directoryKind,
        title: section.title,
        levels: section.levels,
        tags: section.tags,
        sources: section.sources,
        body: section.body,
        order,
      })),
    },
  };
}

// Content hash of every file that loaded. Line endings are normalized first,
// so a Windows checkout and the Linux Docker image get the same version.
function computeVersion(documents) {
  const hash = crypto.createHash("sha256");

  hash.update(`interview-knowledge-format-${FORMAT_VERSION}\n`);

  for (const document of [...documents].sort((a, b) => compareStrings(a.file, b.file))) {
    hash.update(document.file);
    hash.update("\0");
    hash.update(document.text);
    hash.update("\0");
  }

  return `kb-${hash.digest("hex").slice(0, 12)}`;
}

// Builds the exact-match lookup. A key claimed by two documents is an error
// and is removed, so neither document can be matched through it.
function buildMatchKeys(documents, kind, errors, degradedKinds) {
  const owners = new Map();
  const collided = new Set();

  for (const document of documents.filter((doc) => doc.kind === kind)) {
    for (const key of document.matchKeys) {
      const owner = owners.get(key);

      if (owner && owner !== document.id) {
        errors.push({
          file: document.file,
          line: 0,
          code: "alias_collision",
          detail: `'${key}' is also a name for ${owner}`,
        });
        collided.add(key);
        degradedKinds.add(kind);
      } else {
        owners.set(key, document.id);
      }
    }
  }

  for (const key of collided) owners.delete(key);

  return owners;
}

// files: [{ path: "companies/amazon.md", text }]. Pure; no file system access.
function buildKnowledgeBase(files, options = {}) {
  const errors = [...(options.readErrors || [])];
  const degradedKinds = new Set();

  for (const error of errors) {
    const kind = kindForFile(error.file);

    if (kind) degradedKinds.add(kind);
  }

  const parsed = [];

  for (const file of [...files].sort((a, b) => compareStrings(a.path, b.path))) {
    const result = parseDocument(file.path, file.text, options);

    if (result.errors) {
      errors.push(...result.errors);

      const kind = kindForFile(file.path);

      if (kind) degradedKinds.add(kind);
    } else {
      parsed.push(result.document);
    }
  }

  // Ids come from file paths, so duplicates only happen with bad input; drop
  // every copy rather than guess which one is right.
  const idCounts = new Map();

  for (const document of parsed) {
    idCounts.set(document.id, (idCounts.get(document.id) || 0) + 1);
  }

  const documents = parsed.filter((document) => {
    if (idCounts.get(document.id) === 1) return true;

    errors.push({ file: document.file, line: 0, code: "duplicate_document_id", detail: document.id });
    degradedKinds.add(document.kind);

    return false;
  });

  const documentMap = new Map(documents.map((document) => [document.id, document]));

  for (const area of FOCUS_AREAS) {
    if (!documentMap.has(`framework.${area}`)) {
      errors.push({
        file: `${KIND_DIRECTORIES.framework}/${area}.md`,
        line: 0,
        code: "missing_framework",
        detail: `focus area '${area}' has no framework file`,
      });
      degradedKinds.add("framework");
    }
  }

  const companyKeys = buildMatchKeys(documents, "company", errors, degradedKinds);
  const roleKeys = buildMatchKeys(documents, "role", errors, degradedKinds);

  const sections = new Map();

  for (const document of documents) {
    for (const section of document.sections) {
      sections.set(section.id, section);
    }
  }

  const roleDocuments = documents.filter((document) => document.kind === "role");

  return {
    status: documents.length === 0 ? "unavailable" : errors.length > 0 ? "degraded" : "ok",
    version: documents.length === 0 ? null : computeVersion(documents),
    documents: documentMap,
    sections,
    companyKeys,
    roleAliases: [...roleKeys.entries()]
      .map(([key, documentId]) => ({ key, tokens: key.split(" "), documentId }))
      .sort((a, b) => compareStrings(a.key, b.key)),
    // Aliases are left out on purpose: their broad words ("business",
    // "analyst", "engineer") would let a title like "Business Analyst" match
    // through the keyword fallback. Aliases only match as exact phrases.
    roleIndex: createBm25Index(
      roleDocuments.map((document) => ({
        id: document.id,
        tokens: searchTokens([document.title, ...document.keywords].join(" ")),
      }))
    ),
    sectionIndex: createBm25Index(
      [...sections.values()].map((section) => ({
        id: section.id,
        tokens: searchTokens(`${section.title} ${section.body}`),
      }))
    ),
    degradedKinds,
    errors,
  };
}

function readContentFiles(dir) {
  const files = [];
  const readErrors = [];

  for (const kind of KINDS) {
    const directory = KIND_DIRECTORIES[kind];
    let names;

    try {
      names = fs.readdirSync(path.join(dir, directory));
    } catch (error) {
      readErrors.push({ file: `${directory}/`, line: 0, code: "missing_directory", detail: error.code });
      continue;
    }

    for (const name of names.filter((entry) => entry.endsWith(".md")).sort(compareStrings)) {
      const file = `${directory}/${name}`;

      try {
        files.push({ path: file, text: fs.readFileSync(path.join(dir, directory, name), "utf8") });
      } catch (error) {
        readErrors.push({ file, line: 0, code: "unreadable_file", detail: error.code });
      }
    }
  }

  return { files, readErrors };
}

// Logs file paths and error codes only, never content.
function logProblems(knowledgeBase, logger) {
  for (const error of knowledgeBase.errors) {
    logger.warn(`[knowledge] skipped ${error.file}${error.line ? `:${error.line}` : ""} (${error.code})`);
  }

  if (knowledgeBase.status === "unavailable") {
    logger.error("[knowledge] no usable knowledge base content; retrieval is unavailable");
  }
}

// options: { dir, today, logger }. logger: null turns logging off.
function loadKnowledgeBase(options = {}) {
  const { files, readErrors } = readContentFiles(options.dir || CONTENT_DIR);
  const knowledgeBase = buildKnowledgeBase(files, { ...options, readErrors });
  const logger = options.logger === undefined ? console : options.logger;

  if (logger) logProblems(knowledgeBase, logger);

  return knowledgeBase;
}

let cachedKnowledgeBase = null;

// Loaded once per process. Content ships inside the image, so a reload only
// happens on deploy.
function getKnowledgeBase() {
  if (!cachedKnowledgeBase) {
    try {
      cachedKnowledgeBase = loadKnowledgeBase();
    } catch (error) {
      console.error("[knowledge] failed to load the knowledge base:", error.message);
      cachedKnowledgeBase = buildKnowledgeBase([], {
        readErrors: [{ file: "", line: 0, code: "load_failed", detail: error.message }],
      });
    }
  }

  return cachedKnowledgeBase;
}

module.exports = {
  CONTENT_DIR,
  FORMAT_VERSION,
  KIND_DIRECTORIES,
  KINDS,
  LIMITS,
  buildKnowledgeBase,
  getKnowledgeBase,
  loadKnowledgeBase,
  normalizeLineEndings,
  parseDocument,
};
