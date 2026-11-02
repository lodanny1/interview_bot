// Role & Company Knowledge Retrieval (Issue #16). Builders for small
// in-memory knowledge bases used by the tests.
const { FOCUS_AREAS } = require("../interview-options");

const DEFAULT_BODY =
  "This section explains what interviewers look for here, in enough words to pass validation.";

function body(chars, word = "detail") {
  let text = "";

  while (text.length < chars) text += `${word} `;

  return text.slice(0, chars).trim();
}

function sectionText({ title, slug, levels, tags, sources = [], text = DEFAULT_BODY }) {
  return [
    `## ${title || slug} {#${slug}}`,
    ...(levels ? [`levels: ${levels}`] : []),
    ...(tags ? [`tags: ${tags}`] : []),
    ...sources.map((url) => `source: ${url}`),
    "",
    text,
  ].join("\n");
}

const DIRECTORIES = {
  framework: "frameworks",
  role: "roles",
  industry: "industries",
  company: "companies",
};

function documentFile({ kind, slug, title, fields = [], sections, reviewed = "2026-10-01" }) {
  const text = [
    "---",
    `id: ${kind}.${slug}`,
    `kind: ${kind}`,
    `title: ${title || slug}`,
    ...fields,
    `reviewed: ${reviewed}`,
    "---",
    "",
    sections.map(sectionText).join("\n\n"),
    "",
  ].join("\n");

  return { path: `${DIRECTORIES[kind]}/${slug}.md`, text };
}

function frameworkFiles({ omit = [], overviewText } = {}) {
  return FOCUS_AREAS.filter((area) => !omit.includes(area)).map((area) =>
    documentFile({
      kind: "framework",
      slug: area,
      sections: [{ slug: "overview", text: overviewText || `${area} framework overview. ${DEFAULT_BODY}` }],
    })
  );
}

// A role file that covers every level, as validation requires.
function roleFile({ slug, aliases, keywords, extraSections = [], text } = {}) {
  return documentFile({
    kind: "role",
    slug,
    fields: [
      ...aliases.map((alias) => `alias: ${alias}`),
      ...(keywords ? [`keywords: ${keywords}`] : []),
    ],
    sections: [
      { slug: "overview", text: text || DEFAULT_BODY },
      { slug: "early-career", levels: "intern, entry", text: text || DEFAULT_BODY },
      { slug: "mid-level", levels: "mid", text: text || DEFAULT_BODY },
      { slug: "senior-lead", levels: "senior, lead", text: text || DEFAULT_BODY },
      ...extraSections,
    ],
  });
}

function companyFile({ slug, title, aliases = [], industry, sections, reviewed }) {
  return documentFile({
    kind: "company",
    slug,
    title,
    reviewed,
    fields: [
      ...aliases.map((alias) => `alias: ${alias}`),
      ...(industry ? [`industry: ${industry}`] : []),
    ],
    sections: sections || [
      { slug: "overview", sources: [`https://example.com/${slug}`], text: `${title} overview. ${DEFAULT_BODY}` },
    ],
  });
}

function industryFile({ slug, sections }) {
  return documentFile({
    kind: "industry",
    slug,
    sections: sections || [{ slug: "overview", text: DEFAULT_BODY }],
  });
}

module.exports = {
  DEFAULT_BODY,
  body,
  companyFile,
  documentFile,
  frameworkFiles,
  industryFile,
  roleFile,
};
