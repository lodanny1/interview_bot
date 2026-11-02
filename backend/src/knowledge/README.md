# Interview knowledge base (Issue #16)

This module covers build steps 1–2 of #16. It adds a knowledge base of Markdown files in `content/`, a loader and validator, a small BM25 scorer, and the retrieval used to build interview context. Nothing here touches the database, auth or the AI service, so everything runs under `npm test`.

**Issue #16 is not finished yet.** The prompt change, the routes, the UI and session persistence are later steps (see "Later steps").

| File | What it does |
|---|---|
| `content/{frameworks,roles,industries,companies}/*.md` | The knowledge base content |
| `knowledge-base.js` | Parses, validates, indexes and versions the content. Exports `getKnowledgeBase()`, a cached copy loaded relative to this module |
| `bm25.js` | Okapi BM25 (k1 = 1.2, b = 0.75) |
| `text.js` | Company-name and title normalization, search tokens |
| `retrieve-knowledge.js` | `retrieveInterviewKnowledge(input)` and `formatKnowledgeContext()` |
| `interview-context.js` | `buildInterviewContext({ setup, targetJob })`, the entry point for the interview route |
| `interview-options.js` | Setup enums, kept in sync with `frontend/src/lib/interview/interview-options.ts` |
| `fixtures/retrieval-cases.json` | 26 retrieval cases, run by `retrieval-cases.test.js` and the report |
| `../../scripts/knowledge-report.js` | Relevance report (`npm run knowledge:report`) |

## Content format

Each file is `<kind folder>/<slug>.md`, and its `id` must be `<kind>.<slug>`. The parser handles only the small grammar below. It is not YAML: no quoting, no nesting, no multi-line values.

```text
---
id: company.amazon            exactly once
kind: company                 must match the folder
title: Amazon                 exactly once, at most 80 chars
alias: Amazon.com             company and role only; one per line, repeatable (max 20)
industry: tech                company only, optional; one of the setup industries
keywords: sql, excel          role only, optional; comma-separated lowercase words
reviewed: 2026-11-01          exactly once; real date, not in the future
---

## Section title {#section-slug}
levels: intern, entry         optional; "all" (default) or setup role levels
tags: behavioral, leadership  optional; focus areas other than mixed
source: https://...           repeatable (max 5); https only

Section text: 40–1,200 characters, no < or >, no "## " lines.
```

**Validation.** Any of these is an error:

- unknown or repeated fields
- a wrong `id` or `kind` for the file's location
- bad dates, non-https URLs, unknown levels or tags
- a missing `{#overview}` section, or an overview that isn't `levels: all`
- duplicate section slugs
- a company section with no `source:`
- a role file that is missing a section for any of intern, entry, mid, senior or lead
- an empty or duplicate alias after normalization
- size limits: 16,000 chars per file, 8 sections per file, 1,200 chars per section
- across files: a name used by two documents after normalization, or a focus area with no framework file

**CI.** `knowledge-base.test.js` fails on any error in the committed content.

**At runtime.** An invalid file is skipped whole and logged as `[knowledge] skipped <file>:<line> (<code>)`. File text is never logged. The skip marks that kind as degraded (see coverage below).

**Company content rules:**

- Paraphrase public first-party pages such as careers or interview-prep pages.
- Put the supporting URL on every section, and set `reviewed` to the date you checked them.
- Don't claim "Company X asks this" unless the source says so.
- No salaries and no confidential material.
- Add an alias only after checking that the company really uses that name.

## `buildInterviewContext({ setup, targetJob }, options?)`

- **`setup`** is the Start Interview body (`StartInterviewInput` on the frontend).
- **`targetJob`** is the `target_jobs` row, or `null`.
- **`options`** are `{ knowledgeBase, debug }` and are passed through to retrieval.

It never throws, and it never touches the database or auth.

### Input precedence

| Input | Rule |
|---|---|
| goal `general` | The saved target job is ignored entirely (note `target_job_ignored`) |
| goal `specific` | Title and company come from the saved target job |
| `specific` with no target job, or a blank title | Falls back to general practice: `goal: "general"`, `requestedGoal: "specific"`, note `target_job_missing` |
| Job description | A nonempty setup description **replaces** the saved one; the two are never merged, because they may describe different postings (note `setup_description_replaces_saved`). Otherwise the saved one is used, in specific practice only |
| `roleLevel` | Comes only from setup. Missing means level-neutral (`levels: all`) material only. `experienceLevel` (years) is not used to guess it |
| `focusArea` | Missing or invalid means the `mixed` framework |
| Invalid enums | Dropped, with notes `invalid_goal`, `invalid_industry`, `invalid_role_level` and `invalid_focus_area` |

Setup role levels map one to one onto section `levels:` tokens:

| Setup `roleLevel` | Eligible sections |
|---|---|
| `intern` | `all` and any section listing `intern` |
| `entry` | `all` and any section listing `entry` |
| `mid` | `all` and any section listing `mid` |
| `senior` | `all` and any section listing `senior` |
| `lead` | `all` and any section listing `lead` |
| none | `all` only |

### Return shape

```js
{
  input: {
    requestedGoal, goal, jobTitle, company, industry, roleLevel, focusArea, jobDescription,
    provenance: { jobTitle, company, jobDescription, industry, roleLevel, focusArea },
    notes: [...],
  },
  knowledge: {
    status: "ok" | "partial" | "unavailable",
    context: "<knowledge_base version=...>...</knowledge_base>",   // "" when there is nothing
    version: "kb-<12 hex>" | null,
    retrieverVersion: "r1",
    knowledgeStatus: "ok" | "degraded" | "unavailable",
    roleLevel: "intern" | ... | null,
    coverage: { company, role, framework, industry },  // each: { status, input, documentId, matchedBy, reason }
    documents: [{ id, kind, title, reviewed, sectionIds }],
    sections:  [{ id, documentId, kind, title, levels, tags, score, sources }],
    sources:   [{ url, documentId, documentTitle, reviewed, sectionIds }],
    budget:    { limitChars: 6000, usedChars, omittedSectionIds },
  },
}
```

`documents`, `sections` and `sources` list **only what is in `context`**.

### Coverage statuses

| Status | Meaning |
|---|---|
| `not_given` | No input for this facet (a missing input) |
| `matched` | Matched, and at least one section is in the context |
| `not_found` | Input given, but nothing in a healthy knowledge base matches (no match). Reasons: `no_matching_document`, `ambiguous_title`, `below_threshold`, `ambiguous_keywords`, `unknown_industry` |
| `unavailable` | The answer can't be trusted: the knowledge base is down (`knowledge_unavailable`), retrieval failed (`retrieval_error`), or a file of this kind was skipped, so the match might have been in it (`knowledge_degraded`) |
| `omitted` | Matched, but the budget cut every section |

**Overall status:**

- `unavailable`: no usable content.
- `partial`: any facet is `not_found`, `unavailable` or `omitted`, or the framework fell back to `mixed`.
- `ok`: otherwise.

Missing inputs alone don't make a result partial. With empty inputs and a healthy knowledge base, the result still includes framework content.

**Company-fact rule for the prompt step:** unless `coverage.company.status === "matched"`, the prompt must tell the interviewer it has no verified information about the company. That covers not found, unavailable and omitted.

## Matching and ranking

- **Company.** The normalized name must equal a title or alias exactly. Normalization:
  - lowercase, with accents removed
  - `.` and `'` dropped
  - other punctuation becomes spaces
  - legal suffixes (inc, llc, corp, ltd, co, company, plc and similar) are stripped **only as whole final words**, and never down to nothing

  "Amazon.com, Inc." becomes `amazoncom` (an alias). "Amazonian Foods" stays `amazonian foods` and matches nothing. There is no fuzzy or prefix matching.
- **Role.** The title decides when present:
  1. **Alias phrase.** The alias's words must appear in the title as a whole-word phrase, and the longest phrase wins. "Technical Product Manager" beats "Product Manager", and "BI Developer" beats "Developer". A tie between two roles leaves the role unknown (`ambiguous_title`).
  2. **Title keywords.** BM25 over each role's title plus its `keywords:` (aliases are left out, so broad words such as "analyst" or "business" can't match). The best role needs a score of at least 1.5, 2 matched terms and 1.5× the runner-up.
  3. **Description keywords,** only when there is no title. The best role needs a score of at least 4, 4 matched terms and 1.5× the runner-up.

  The job description never changes a role chosen by the title. When the evidence is weak, the role stays unknown. These thresholds are calibrated in `npm run knowledge:report`:
  - the strongest title negative is "Data Engineer" (1.49, 1 term)
  - the strongest description negative is a short PM posting (3.44); the weakest positive is 5.87
- **Framework.** Taken straight from the focus area, with `mixed` as the default. If that framework file is missing, it falls back to `mixed` (`matchedBy: "fallback"`).
- **Industry.** The setup industry. If none was chosen, the matched company's `industry:`.
- **Sections.** Sections are filtered by role level **before** scoring; IDF comes from the whole knowledge base. Within a document, sections are ranked by:
  1. the overview first
  2. tagged with the focus area, then untagged, then tagged with another area
  3. written for the chosen level before general sections
  4. BM25 score against the title, focus area and description
  5. file order
- **Budget.** The budget is 6,000 characters of formatted context, including the tags. That is about 1,500 tokens, but a character limit is not a guaranteed token count. Sections are only ever included whole.
  - **Pass 1** gives each facet its cap, framework first, so its 1,800 characters are reserved: framework 1,800, company 1,800, role 1,600, industry 800.
  - **Pass 2** fills what is left in display order: company, role, framework, industry.

## Determinism and versioning

- Files load in code-point order. Score ties break by file order and then by id, so the same content and input give the same result on any machine.
- `version` is `kb-` plus the first 12 hex characters of a SHA-256 over:
  - the format version
  - for each loaded file, in path order: its path and its text, with line endings normalized to `\n` and any BOM removed

  A Windows checkout and the Linux image therefore produce the same version. The version changes when any loaded file changes, or when a file is added, removed, or starts or stops failing validation.
- `retrieverVersion` identifies the matching, ranking, budget and format code. Bump it when any of those change.
- Content is loaded from `path.join(__dirname, "content")`, which ships in the Docker image because the Dockerfile copies `backend/src`.

## Commands

```bash
npm test                                         # includes content validation and the 26 cases
npm run knowledge:report                         # relevance report; exits 1 on any failure
npm run knowledge:report -- --case <id> --context
```

## Later steps (not part of steps 1–2)

1. **Interview route integration needs an owner.** `POST /interviews` doesn't exist yet. Until the opening and follow-up questions actually receive `knowledge.context`, #16 isn't done. The intended call:
   - `getTargetJob(user.id)`, then `buildInterviewContext({ setup: validatedBody, targetJob })`
   - pass `input.jobTitle`, `input.company`, `knowledge.context` and `knowledge.coverage` to the prompt
2. **Prompt (step 3, agree with Danny).** Add an optional `knowledgeContext` to `buildSystemPrompt`, labeled as reference material. Apply the company-fact rule above both when no company matches and when retrieval is `unavailable`.
3. **Insights route and UI (step 4).** These need explicit `success`, `no_target_job` and `unavailable` states, and a database failure loading the target job must stay a separate error. Recomputed insights can change after the user edits the target job or a new knowledge-base version is deployed. The UI should show the reviewed dates and not promise stable results.
4. **Session persistence (with the #20 owner).** Source ids plus `version` can't rebuild an old context, because the old content is gone after the next deploy. Agree to either:
   - persist the effective `input` plus `knowledge.context` (or `sections`, `sources`, `version` and `retrieverVersion`) with the session, so follow-up questions (#18) reuse the exact context; or
   - keep immutable, accessible copies of every deployed knowledge-base version.
5. **Full content (step 5).** About 8 roles, 4 industries and about 12 companies, each company checked against its sources by a person.
