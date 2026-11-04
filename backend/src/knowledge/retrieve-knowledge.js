// Role & Company Knowledge Retrieval (Issue #16). Picks the knowledge base
// sections for one interview and formats them as prompt context. The response
// contract is described in ./README.md.
//
// Never throws: a broken or missing knowledge base returns status
// "unavailable" with empty context, so the interview can continue without it.
const { scoreBm25 } = require("./bm25");
const { getKnowledgeBase } = require("./knowledge-base");
const {
  DEFAULT_FOCUS_AREA,
  FOCUS_AREAS,
  INDUSTRIES,
  ROLE_LEVELS,
} = require("./interview-options");
const {
  normalizeCompanyName,
  phraseTokens,
  searchTokens,
} = require("./text");

// Bump whenever matching, thresholds, ranking, the budget or the context
// format change. Together with the knowledge base version it identifies how a
// context was produced.
const RETRIEVER_VERSION = "r2";

// Characters, not tokens. Roughly 1,500 tokens of English, but a character
// limit is not a guaranteed token count.
const CONTEXT_CHAR_BUDGET = 6000;

// First pass: each facet may use up to its cap, framework first, so the
// framework cap is a reservation that company content can't take. A second
// pass fills what is left in display order. Caps include formatting.
const FACET_CAPS = {
  framework: 1800,
  company: 1800,
  role: 1600,
  industry: 800,
};

const FIRST_PASS_ORDER = ["framework", "company", "role", "industry"];
const DISPLAY_ORDER = ["company", "role", "framework", "industry"];

// Calibrated against fixtures/retrieval-cases.json (see the report script).
// A role is only inferred when the best match clears every bar; otherwise the
// role stays unknown instead of being forced. With 8 role files, one shared
// title word scores up to about 2.7, so minTerms is the main title guard.
const ROLE_THRESHOLDS = {
  title: { minScore: 3, minTerms: 2, minRatio: 1.5 },
  description: { minScore: 6, minTerms: 4, minRatio: 1.5 },
};

const INPUT_LIMITS = {
  jobTitle: 120,
  company: 120,
  jobDescription: 10000,
};

function cleanText(value, maxChars) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  return text ? text.slice(0, maxChars) : null;
}

function cleanInput(input) {
  const raw = input && typeof input === "object" ? input : {};

  return {
    jobTitle: cleanText(raw.jobTitle, INPUT_LIMITS.jobTitle),
    company: cleanText(raw.company, INPUT_LIMITS.company),
    industry: cleanText(raw.industry, 40),
    roleLevel: cleanText(raw.roleLevel, 40),
    focusArea: cleanText(raw.focusArea, 40),
    jobDescription: cleanText(raw.jobDescription, INPUT_LIMITS.jobDescription),
  };
}

function coverage(status, input, extra = {}) {
  return {
    status,
    input: input || null,
    documentId: null,
    matchedBy: null,
    reason: null,
    ...extra,
  };
}

function round(score) {
  return Math.round(score * 10000) / 10000;
}

/* ------------------------------- Matching -------------------------------- */

// Returns { coverage, name }: name is the normalized title or alias that
// matched, which decides "names:"-scoped sections (e.g. AWS-only notes).
function matchCompany(knowledgeBase, company) {
  if (!company) return { coverage: coverage("not_given", null), name: null };

  const key = normalizeCompanyName(company);
  const documentId = key ? knowledgeBase.companyKeys.get(key) : undefined;

  if (documentId) {
    return { coverage: coverage("matched", company, { documentId, matchedBy: "name" }), name: key };
  }

  // A skipped company file might have matched, so "not found" would be wrong.
  if (knowledgeBase.degradedKinds.has("company")) {
    return {
      coverage: coverage("unavailable", company, { reason: "knowledge_degraded" }),
      name: null,
    };
  }

  return {
    coverage: coverage("not_found", company, { reason: "no_matching_document" }),
    name: null,
  };
}

function containsPhrase(tokens, phrase) {
  for (let start = 0; start + phrase.length <= tokens.length; start += 1) {
    if (phrase.every((token, offset) => tokens[start + offset] === token)) {
      return true;
    }
  }

  return false;
}

// Keyword fallback: the best role must clear the score and term minimums and
// beat the runner-up by minRatio.
function decideByKeywords(knowledgeBase, text, thresholds) {
  const scores = scoreBm25(knowledgeBase.roleIndex, searchTokens(text));
  const [best, runnerUp] = scores;

  if (!best || best.score < thresholds.minScore || best.matchedTerms.length < thresholds.minTerms) {
    return { documentId: null, reason: "below_threshold", scores };
  }

  if (runnerUp && runnerUp.score > 0 && best.score < runnerUp.score * thresholds.minRatio) {
    return { documentId: null, reason: "ambiguous_keywords", scores };
  }

  return { documentId: best.id, reason: null, scores };
}

// A job title, when present, is the only thing that decides the role. The
// job description is used only when there is no title, so a description that
// mentions working with engineers can't turn an analyst into an engineer.
function matchRole(knowledgeBase, jobTitle, jobDescription) {
  const debug = { aliasMatches: [], scores: [] };

  if (jobTitle) {
    const titleTokens = phraseTokens(jobTitle);
    const matches = knowledgeBase.roleAliases.filter((alias) =>
      containsPhrase(titleTokens, alias.tokens)
    );
    const longest = Math.max(0, ...matches.map((alias) => alias.tokens.length));
    const best = matches.filter((alias) => alias.tokens.length === longest);
    const documentIds = [...new Set(best.map((alias) => alias.documentId))].sort();

    debug.aliasMatches = matches.map(({ key, documentId }) => ({ alias: key, documentId }));

    if (documentIds.length === 1) {
      return {
        coverage: coverage("matched", jobTitle, {
          documentId: documentIds[0],
          matchedBy: "title_alias",
        }),
        debug,
      };
    }

    if (documentIds.length > 1) {
      return {
        coverage: coverage("not_found", jobTitle, { reason: "ambiguous_title" }),
        debug,
      };
    }

    const decision = decideByKeywords(knowledgeBase, jobTitle, ROLE_THRESHOLDS.title);
    debug.scores = decision.scores;

    if (decision.documentId) {
      return {
        coverage: coverage("matched", jobTitle, {
          documentId: decision.documentId,
          matchedBy: "title_keywords",
        }),
        debug,
      };
    }

    if (knowledgeBase.degradedKinds.has("role")) {
      return {
        coverage: coverage("unavailable", jobTitle, { reason: "knowledge_degraded" }),
        debug,
      };
    }

    return { coverage: coverage("not_found", jobTitle, { reason: decision.reason }), debug };
  }

  if (jobDescription) {
    const decision = decideByKeywords(knowledgeBase, jobDescription, ROLE_THRESHOLDS.description);
    debug.scores = decision.scores;

    if (decision.documentId) {
      return {
        coverage: coverage("matched", null, {
          documentId: decision.documentId,
          matchedBy: "description_keywords",
        }),
        debug,
      };
    }

    return {
      coverage: coverage("not_given", null, { reason: "description_inconclusive" }),
      debug,
    };
  }

  return { coverage: coverage("not_given", null), debug };
}

function matchFramework(knowledgeBase, focusArea) {
  const valid = FOCUS_AREAS.includes(focusArea);
  const area = valid ? focusArea : DEFAULT_FOCUS_AREA;
  const extra = {
    matchedBy: valid ? "focus_area" : "default",
    reason: focusArea && !valid ? "unknown_focus_area" : null,
  };

  if (knowledgeBase.documents.has(`framework.${area}`)) {
    return coverage("matched", focusArea, { ...extra, documentId: `framework.${area}` });
  }

  // Only happens when the knowledge base is degraded.
  if (knowledgeBase.documents.has(`framework.${DEFAULT_FOCUS_AREA}`)) {
    return coverage("matched", focusArea, {
      documentId: `framework.${DEFAULT_FOCUS_AREA}`,
      matchedBy: "fallback",
      reason: "framework_missing",
    });
  }

  return coverage("unavailable", focusArea, { reason: "knowledge_degraded" });
}

function matchIndustry(knowledgeBase, industry, companyDocument) {
  if (industry) {
    const documentId = `industry.${industry}`;

    if (INDUSTRIES.includes(industry) && knowledgeBase.documents.has(documentId)) {
      return coverage("matched", industry, { documentId, matchedBy: "input" });
    }

    if (INDUSTRIES.includes(industry) && knowledgeBase.degradedKinds.has("industry")) {
      return coverage("unavailable", industry, { reason: "knowledge_degraded" });
    }

    return coverage("not_found", industry, {
      reason: INDUSTRIES.includes(industry) ? "no_matching_document" : "unknown_industry",
    });
  }

  // No industry chosen: use the matched company's industry when we have it.
  if (companyDocument && companyDocument.industry) {
    const documentId = `industry.${companyDocument.industry}`;

    if (knowledgeBase.documents.has(documentId)) {
      return coverage("matched", null, { documentId, matchedBy: "company" });
    }
  }

  return coverage("not_given", null);
}

/* ------------------------------- Ranking --------------------------------- */

// filters: { roleLevel, role, companyName }, where role is the matched role
// file slug ("software-engineering") and companyName the normalized name the
// company matched through. Returns null when eligible, otherwise the reason.
function ineligibleReason(section, filters) {
  if (section.levels !== "all" && !(filters.roleLevel && section.levels.includes(filters.roleLevel))) {
    return "level";
  }

  if (section.roles.length > 0 && !(filters.role && section.roles.includes(filters.role))) {
    return "role";
  }

  if (section.names.length > 0 && !(filters.companyName && section.names.includes(filters.companyName))) {
    return "name";
  }

  return null;
}

function specificity(section) {
  return (
    (section.levels === "all" ? 0 : 1) +
    (section.roles.length > 0 ? 1 : 0) +
    (section.names.length > 0 ? 1 : 0)
  );
}

// Sort keys, smallest first: the overview, then sections tagged with the
// focus area, untagged, tagged for other areas; then sections scoped to the
// chosen level, role or business unit before general ones; then BM25 score;
// then file order.
function rankKey(section, focusArea) {
  const focusRank =
    focusArea === DEFAULT_FOCUS_AREA || !FOCUS_AREAS.includes(focusArea)
      ? 0
      : section.tags.includes(focusArea)
        ? 0
        : section.tags.length === 0
          ? 1
          : 2;

  return [section.slug === "overview" ? 0 : 1, focusRank, -specificity(section)];
}

// Level, role and name filtering happens before scoring, so an ineligible
// section is never ranked. IDF still comes from the whole knowledge base,
// which keeps scores stable regardless of the filter.
function rankSections(knowledgeBase, document, { filters, focusArea, queryTokens }) {
  const eligible = [];
  const filtered = [];

  for (const section of document.sections) {
    const reason = ineligibleReason(section, filters);

    if (reason) {
      filtered.push({ id: section.id, reason });
    } else {
      eligible.push(section);
    }
  }

  const scores = new Map(
    scoreBm25(knowledgeBase.sectionIndex, queryTokens, eligible.map((section) => section.id)).map(
      (result) => [result.id, result.score]
    )
  );

  const ranked = eligible
    .map((section) => ({
      section,
      score: scores.get(section.id) || 0,
      key: rankKey(section, focusArea),
    }))
    .sort((left, right) => {
      for (let index = 0; index < left.key.length; index += 1) {
        if (left.key[index] !== right.key[index]) return left.key[index] - right.key[index];
      }

      return right.score - left.score || left.section.order - right.section.order;
    });

  return { ranked, filtered };
}

/* ------------------------------ Formatting ------------------------------- */

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// documents: [{ id, kind, title, reviewed, sections: [{ id, title, body }] }]
// in the order they should appear. Returns "" when there is nothing to show.
function formatKnowledgeContext(version, documents) {
  const blocks = documents
    .filter((document) => document.sections.length > 0)
    .map((document) => {
      const sections = document.sections.map(
        (section) =>
          `<section id="${escapeAttribute(section.id)}" title="${escapeAttribute(section.title)}">\n` +
          `${section.body}\n</section>`
      );

      return (
        `<document id="${escapeAttribute(document.id)}" kind="${document.kind}" ` +
        `title="${escapeAttribute(document.title)}" reviewed="${document.reviewed}">\n` +
        `${sections.join("\n")}\n</document>`
      );
    });

  if (blocks.length === 0) return "";

  return `<knowledge_base version="${escapeAttribute(version || "")}">\n${blocks.join("\n")}\n</knowledge_base>`;
}

/* ------------------------------- Assembly -------------------------------- */

function orderedDocuments(knowledgeBase, plan, selectedIds) {
  return DISPLAY_ORDER.filter((facet) => plan[facet])
    .map((facet) => {
      const document = knowledgeBase.documents.get(plan[facet].documentId);

      return {
        facet,
        id: document.id,
        kind: document.kind,
        title: document.title,
        reviewed: document.reviewed,
        sections: document.sections.filter((section) => selectedIds.has(section.id)),
      };
    });
}

// Adds whole sections only. A section that doesn't fit is skipped and the
// next (possibly smaller) one is tried.
function selectSections(knowledgeBase, plan) {
  const selectedIds = new Set();
  const used = { framework: 0, company: 0, role: 0, industry: 0 };
  let length = 0;

  const tryAdd = (facet, section, cap) => {
    selectedIds.add(section.id);

    const next = formatKnowledgeContext(
      knowledgeBase.version,
      orderedDocuments(knowledgeBase, plan, selectedIds)
    ).length;
    const cost = next - length;

    if (next > CONTEXT_CHAR_BUDGET || (cap !== undefined && used[facet] + cost > cap)) {
      selectedIds.delete(section.id);
      return;
    }

    used[facet] += cost;
    length = next;
  };

  for (const facet of FIRST_PASS_ORDER) {
    if (!plan[facet]) continue;

    for (const { section } of plan[facet].ranked) {
      tryAdd(facet, section, FACET_CAPS[facet]);
    }
  }

  for (const facet of DISPLAY_ORDER) {
    if (!plan[facet]) continue;

    for (const { section } of plan[facet].ranked) {
      if (!selectedIds.has(section.id)) tryAdd(facet, section);
    }
  }

  return selectedIds;
}

function emptyResult(knowledgeBase, input, reason) {
  const unavailableIfGiven = (value) =>
    value ? coverage("unavailable", value, { reason }) : coverage("not_given", null);

  return {
    status: "unavailable",
    context: "",
    version: knowledgeBase ? knowledgeBase.version : null,
    retrieverVersion: RETRIEVER_VERSION,
    knowledgeStatus: knowledgeBase ? knowledgeBase.status : "unavailable",
    filters: {
      roleLevel: ROLE_LEVELS.includes(input.roleLevel) ? input.roleLevel : null,
      role: null,
      companyName: null,
    },
    coverage: {
      company: unavailableIfGiven(input.company),
      role: unavailableIfGiven(input.jobTitle),
      framework: coverage("unavailable", input.focusArea, { reason }),
      industry: unavailableIfGiven(input.industry),
    },
    documents: [],
    sections: [],
    sources: [],
    budget: { limitChars: CONTEXT_CHAR_BUDGET, usedChars: 0, omittedSectionIds: [] },
  };
}

function retrieve(knowledgeBase, input, options) {
  const focusArea = FOCUS_AREAS.includes(input.focusArea) ? input.focusArea : DEFAULT_FOCUS_AREA;

  const company = matchCompany(knowledgeBase, input.company);
  const companyDocument = company.coverage.documentId
    ? knowledgeBase.documents.get(company.coverage.documentId)
    : null;
  const role = matchRole(knowledgeBase, input.jobTitle, input.jobDescription);
  const filters = {
    roleLevel: ROLE_LEVELS.includes(input.roleLevel) ? input.roleLevel : null,
    role: role.coverage.documentId ? role.coverage.documentId.replace(/^role\./, "") : null,
    companyName: company.name,
  };
  const coverageByFacet = {
    company: company.coverage,
    role: role.coverage,
    framework: matchFramework(knowledgeBase, input.focusArea),
    industry: matchIndustry(knowledgeBase, input.industry, companyDocument),
  };

  const queryTokens = searchTokens(
    [input.jobTitle, focusArea.replace(/-/g, " "), input.jobDescription].filter(Boolean).join(" ")
  );

  const plan = {};
  const filtered = [];

  for (const facet of DISPLAY_ORDER) {
    const { documentId } = coverageByFacet[facet];

    if (!documentId) continue;

    const ranking = rankSections(knowledgeBase, knowledgeBase.documents.get(documentId), {
      filters,
      focusArea,
      queryTokens,
    });

    plan[facet] = { documentId, ranked: ranking.ranked };
    filtered.push(...ranking.filtered);
  }

  const selectedIds = selectSections(knowledgeBase, plan);
  const documents = orderedDocuments(knowledgeBase, plan, selectedIds);
  const context = formatKnowledgeContext(knowledgeBase.version, documents);

  const scoreById = new Map();

  for (const facet of Object.keys(plan)) {
    for (const { section, score } of plan[facet].ranked) scoreById.set(section.id, score);
  }

  // A matched document whose sections were all cut by the budget is reported
  // as "omitted", because nothing from it reaches the prompt.
  for (const facet of DISPLAY_ORDER) {
    const entry = coverageByFacet[facet];

    if (entry.status === "matched" && !documents.some((doc) => doc.facet === facet && doc.sections.length > 0)) {
      coverageByFacet[facet] = { ...entry, status: "omitted", reason: "budget" };
    }
  }

  const includedDocuments = documents.filter((document) => document.sections.length > 0);
  const sections = includedDocuments.flatMap((document) =>
    document.sections.map((section) => ({
      id: section.id,
      documentId: document.id,
      kind: document.kind,
      title: section.title,
      levels: section.levels,
      tags: section.tags,
      roles: section.roles,
      names: section.names,
      score: round(scoreById.get(section.id) || 0),
      sources: section.sources,
    }))
  );

  // Sources come only from sections that made it into the context.
  const sources = [];

  for (const document of includedDocuments) {
    for (const section of document.sections) {
      for (const url of section.sources) {
        let source = sources.find((entry) => entry.url === url && entry.documentId === document.id);

        if (!source) {
          source = {
            url,
            documentId: document.id,
            documentTitle: document.title,
            reviewed: document.reviewed,
            sectionIds: [],
          };
          sources.push(source);
        }

        source.sectionIds.push(section.id);
      }
    }
  }

  const partial = DISPLAY_ORDER.some((facet) => {
    const entry = coverageByFacet[facet];

    return (
      ["not_found", "unavailable", "omitted"].includes(entry.status) ||
      entry.matchedBy === "fallback"
    );
  });

  const omittedSectionIds = Object.keys(plan)
    .flatMap((facet) => plan[facet].ranked.map(({ section }) => section.id))
    .filter((id) => !selectedIds.has(id));

  const result = {
    status: partial ? "partial" : "ok",
    context,
    version: knowledgeBase.version,
    retrieverVersion: RETRIEVER_VERSION,
    knowledgeStatus: knowledgeBase.status,
    filters,
    coverage: coverageByFacet,
    documents: includedDocuments.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      reviewed: document.reviewed,
      sectionIds: document.sections.map((section) => section.id),
    })),
    sections,
    sources,
    budget: {
      limitChars: CONTEXT_CHAR_BUDGET,
      usedChars: context.length,
      omittedSectionIds,
    },
  };

  if (options.debug) {
    result.debug = {
      role: {
        aliasMatches: role.debug.aliasMatches,
        scores: role.debug.scores.map((entry) => ({ ...entry, score: round(entry.score) })),
      },
      candidates: Object.keys(plan).flatMap((facet) =>
        plan[facet].ranked.map(({ section, score }, rank) => ({
          facet,
          id: section.id,
          rank: rank + 1,
          score: round(score),
          selected: selectedIds.has(section.id),
        }))
      ),
      filtered,
    };
  }

  return result;
}

// input: { jobTitle, company, industry, roleLevel, focusArea, jobDescription }
// options: { knowledgeBase, debug }. Without knowledgeBase the shared,
// lazily loaded one from ./content is used.
function retrieveInterviewKnowledge(input, options = {}) {
  const cleaned = cleanInput(input);
  let knowledgeBase = null;

  try {
    knowledgeBase = options.knowledgeBase || getKnowledgeBase();

    if (!knowledgeBase || knowledgeBase.status === "unavailable") {
      return emptyResult(knowledgeBase, cleaned, "knowledge_unavailable");
    }

    return retrieve(knowledgeBase, cleaned, options);
  } catch (error) {
    console.error("[knowledge] retrieval failed:", error.message);

    return emptyResult(knowledgeBase, cleaned, "retrieval_error");
  }
}

module.exports = {
  CONTEXT_CHAR_BUDGET,
  FACET_CAPS,
  RETRIEVER_VERSION,
  ROLE_THRESHOLDS,
  formatKnowledgeContext,
  retrieveInterviewKnowledge,
};
