# Interview knowledge base (Issue #16)

This module covers retrieval of curated role, company, industry and interview-style notes for #16.

**Status:**

- **Ready:** retrieval, prompt integration, live interview integration (see [Interview route integration](#interview-route-integration)), interview insights (API and UI), and tests.
- **Not checked yet:** question quality with a live model. All tests use a stubbed AI service.

| File | What it does |
|---|---|
| `content/{frameworks,roles,industries,companies}/*.md` | The knowledge base |
| `knowledge-base.js` | Parses, validates, indexes and versions content. `getKnowledgeBase()` is a cached copy loaded relative to this module |
| `bm25.js`, `text.js` | Keyword scorer (k1 = 1.2, b = 0.75); name and title normalization |
| `retrieve-knowledge.js` | `retrieveInterviewKnowledge(input)`, `formatKnowledgeContext()` |
| `interview-context.js` | `buildInterviewContext({ setup, targetJob })`: input precedence, then retrieval |
| `knowledge-routes.js` | `GET /me/interview-insights` |
| `interview-options.js` | Setup enums, kept in sync with `frontend/src/lib/interview/interview-options.ts` |
| `fixtures/retrieval-cases.json` | 46 relevance cases, run by `retrieval-cases.test.js` and the report |
| `../interview/interview-ai-service.js` | Prompt: optional `knowledgeContext` and `knowledgeCoverage` |
| `../interview/interview-knowledge.js` | Setup and target job → retrieval → question generators |
| `../interview/interview-routes.js` | The interview routes: build the knowledge at start, store it on the session, reuse it on later turns |
| `../../sql/007_add_interview_knowledge.sql` | `interview_sessions.prompt_input` and `knowledge_summary` |
| `../../scripts/knowledge-report.js` | Relevance report (`npm run knowledge:report`) |
| `../../scripts/capture-insights-fixture.js` | Regenerates the frontend's copy of real insights responses |

## Content

| Kind | Files |
|---|---|
| Frameworks | behavioral (STAR), technical, system design, leadership, mixed |
| Roles | software engineering, data analytics and data science, product management, UX design and research, IT support and cybersecurity, business and financial analysis, consulting, healthcare and clinical |
| Industries | tech, finance, healthcare, consulting |
| Companies | Amazon (including AWS), Google, Microsoft, JPMorgan Chase, Capital One, Wells Fargo, Kaiser Permanente, UnitedHealth Group, Deloitte, Accenture, EY |

Every company statement paraphrases a first-party page. The page is linked on the section and was read on the `reviewed` date (2026-11-01). Notes that a source limits to certain positions are scoped with `roles:`, `levels:` or `names:`. A few examples:

- Amazon's student SDE and data notes apply to intern/entry software and data roles only.
- Amazon's SDE II, SDE III and SDM notes apply to software engineering at mid, senior and lead level respectively.
- Amazon's PM, BIE and UX notes apply only to those roles.
- AWS's hiring steps apply only when the company was entered as AWS or Amazon Web Services.
- Capital One's case notes apply to business analysis and product roles, and its data-science note to data roles.
- JPMorgan Chase's experienced-engineer process applies to mid-level and above.
- Deloitte's case and scenario note applies to entry-level consulting and analysis roles.
- Accenture's case note applies to consulting and analysis roles.

**Known gaps:**

- **Cedars-Sinai** has no file. No first-party description of its interview process could be found, so it is reported as `not_found`.
- **Google** is covered only by its re:Work guide on structured interviewing. Its careers interview pages render no readable text.
- **Kaiser Permanente** program-specific nurse-residency material is not included.
- **Data engineering** has no role family. "Data Engineer" stays unknown rather than borrowing data-analyst notes.
- **Role, industry and framework files** are general guidance, not company claims, so they have no sources.

## Content format

Each file is `<kind folder>/<slug>.md`, and its `id` is `<kind>.<slug>`. The parser handles only this small grammar. It is not YAML.

```text
---
id: company.amazon            exactly once
kind: company                 must match the folder
title: Amazon                 exactly once, at most 80 chars
alias: Amazon.com             company and role only; one per line (max 20)
industry: tech                company only, optional; a setup industry
keywords: sql, excel          role only, optional; used only by the keyword fallback
reviewed: 2026-11-01          exactly once; real date, not in the future
---

## Section title {#section-slug}
levels: intern, entry         optional; "all" (default) or setup role levels
tags: behavioral              optional; focus areas other than mixed
roles: software-engineering   optional (company/framework/industry); role file slugs
names: amazon web services    optional (company); normalized title or alias names
source: https://...           repeatable (max 5); https only; required in company files

Section text: 40–1,200 characters, no < or >, no "## " lines.
```

**Validation.** `knowledge-base.test.js` fails CI on any error. The checks cover:

- unknown, repeated or misplaced fields
- `id` and `kind` that don't match the file's location
- bad dates, non-https URLs, unknown levels or tags
- `roles:` naming a missing role file, or `names:` that isn't one of the company's names
- a missing or scoped `{#overview}` section
- duplicate section slugs
- company sections without a source
- role files without a section for every level
- empty or duplicate aliases after normalization
- size limits: 16,000 characters per file, 12 sections per file, 1,200 characters per section
- across files: a name used by two documents (alias collision), and a focus area with no framework file

At runtime an invalid file is skipped and logged as `[knowledge] skipped <file>:<line> (<code>)`. The file's text is never logged, and its kind is marked degraded.

## `buildInterviewContext({ setup, targetJob }, options?)`

- `setup` is the Start Interview body (`StartInterviewInput`).
- `targetJob` is the `target_jobs` row or `null`.
- It never throws and makes no database or auth calls.

| Input | Rule |
|---|---|
| goal `general` | The saved target job is ignored (note `target_job_ignored`) |
| goal `specific` | Title and company come from the saved job. With no job (or a blank title) it falls back to general practice: `goal: "general"`, `requestedGoal: "specific"`, note `target_job_missing` |
| Job description | A nonempty setup description **replaces** the saved one (note `setup_description_replaces_saved`). Whitespace-only counts as absent |
| `roleLevel` | Comes only from setup. Missing means `levels: all` material only. `experienceLevel` is ignored |
| `industry` | The setup value wins. Otherwise the matched company's `industry:` |
| `focusArea` | Missing or invalid means `mixed` |
| Bad input | Non-string or unknown values are dropped (`invalid_<field>`). Text over its limit is cut (`<field>_truncated`). Limits: title and company 120, description 10,000 |

It returns `{ input, knowledge }`:

```js
knowledge = {
  status: "ok" | "partial" | "unavailable",
  context: "<knowledge_base version=...>...</knowledge_base>",   // "" when nothing
  version: "kb-<12 hex>" | null,      // content hash
  retrieverVersion: "r2",             // matching, ranking, budget and format code
  knowledgeStatus: "ok" | "degraded" | "unavailable",
  filters: { roleLevel, role, companyName },                    // what eligibility used
  coverage: { company, role, framework, industry },             // { status, input, documentId, matchedBy, reason }
  documents: [{ id, kind, title, reviewed, sectionIds }],       // only what is in context
  sections:  [{ id, documentId, kind, title, levels, tags, roles, names, score, sources }],
  sources:   [{ url, documentId, documentTitle, reviewed, sectionIds }],
  budget:    { limitChars: 6000, usedChars, omittedSectionIds },
}
```

**Coverage statuses:**

| Status | Meaning |
|---|---|
| `not_given` | No input |
| `matched` | Matched, and at least one section is in the context |
| `not_found` | Input given, but nothing in a healthy knowledge base matches. Reasons: `no_matching_document`, `ambiguous_title`, `below_threshold`, `ambiguous_keywords`, `unknown_industry` |
| `unavailable` | The knowledge base is down, retrieval failed, or a file of this kind was skipped, so a match may be missing |
| `omitted` | Matched, but the budget cut every section |

**Overall status:**

- `unavailable`: no usable content.
- `partial`: any facet is `not_found`, `unavailable` or `omitted`, or the framework fell back to `mixed`.
- `ok`: otherwise.

## Matching and ranking

- **Company.** The normalized name must equal a title or alias exactly. Normalization:
  - lowercase, with accents removed
  - `.` and `'` dropped
  - `&` becomes "and"
  - other punctuation becomes spaces
  - legal suffixes are stripped only as whole final words

  There is no fuzzy or prefix matching ("Amazonian Foods" matches nothing).
- **Role.** The title decides when present:
  1. **Alias phrase.** The longest whole-word phrase wins ("Technical Product Manager" beats "Product Manager"). A tie between roles leaves the role unknown.
  2. **Title keywords.** BM25 over each role's title and `keywords:` only, never aliases. It needs a score of at least 3, at least 2 matched terms, and 1.5× the runner-up.
  3. **Description keywords,** only when there is no title. They need a score of at least 6, at least 4 terms, and 1.5× the runner-up.

  These thresholds are calibrated in `npm run knowledge:report`:
  - **Titles:** one shared word scores at most about 2.7, and the weakest true match scores 5.0.
  - **Descriptions:** strong negatives are blocked by the term count or the ratio (for example, an engineering posting that mentions product managers scores 1.40× the runner-up), and the weakest true match scores 11.0.
- **Eligibility, before scoring.** A section is used only if:
  - its `levels:` include the setup level (or are `all`),
  - its `roles:` include the matched role, and
  - its `names:` include the name the company matched through.

  IDF comes from the whole knowledge base.
- **Order within a document:**
  1. the overview
  2. sections tagged with the focus area, then untagged sections, then sections tagged for other areas
  3. more specific sections (level, role, name) first
  4. BM25 against title, focus and description
  5. file order
- **Budget.** 6,000 characters of formatted context, which is about 1,500 tokens but not a guaranteed token count. Sections are only ever included whole.
  - **Pass 1** gives each facet its cap, framework first, so its 1,800 characters are reserved: framework 1,800, company 1,800, role 1,600, industry 800.
  - **Pass 2** fills the rest in display order: company, role, framework, industry.

## Interviewer prompt

`buildSystemPrompt` and both question generators accept two optional inputs:

- `knowledgeContext`: the `<knowledge_base>` block.
- `knowledgeCoverage`: the result's coverage.

Without either input, the prompt is byte-for-byte the previous one. With them:

- **Reference block.** The notes come last, inside `<interview_knowledge>` tags, labeled as reference material and not instructions. Every instruction sits outside the block.
- **Malformed context.** A block that isn't complete or exceeds the budget is dropped. A warning is logged without its text.
- **User-entered names.** Role, company and interview type come from the user. They are kept to one line, with no angle brackets, and capped at 120 characters (40 for the type).
- **No verified company notes.** If a company was given and no company notes are in the context (`not_found`, `unavailable`, `omitted`, or `matched` without company notes), the prompt forbids stating or implying facts about it and keeps the role and general guidance. This includes an empty context.
- **Verified company notes.** If company notes exist, statements about the company must stay within them.

## Interview route integration

The interview routes in `../interview/interview-routes.js` use the knowledge. `server.js` passes `getTargetJob` and `knowledgeService` (`interview-knowledge.js`) to `createInterviewRouter`; without them, the routes behave as before.

**Start (`POST /interviews`)**
1. For a "specific" goal, load the saved target job; "general" practice doesn't load it.
2. `prepareInterviewKnowledge({ setup, targetJob })` turns the validated setup and the job into `promptInput` (role, company, interview type, `knowledgeContext`, `knowledgeCoverage`). Without a job title, the role falls back to the setup's role level, as before.
3. The session stores `promptInput` in `prompt_input`, and `knowledgeSummary(...)` (ids, versions and statuses only) in `knowledge_summary`.
4. The opening question gets `promptInput`. That's `generateOpeningQuestion`, or `generateResumePersonalizedQuestion` when a resume is selected.

**Later turns (`POST /interviews/:id/messages`, `POST /interviews/:id/complete`)**
- Follow-up questions reuse the stored `prompt_input`, so every question in a session uses the same notes, even if the target job or the knowledge base changes mid-session. The target job isn't loaded again.
- Closings (time limit or user-ended) use the stored role, company and interview type, without the notes.
- Sessions started before migration 007 have no `prompt_input`. They keep the old inputs: the role level as the role, and no company.

**Failures**
- Retrieval never throws, so a knowledge problem never blocks an interview.
- A database error while loading the target job fails the start like any other database error (500).
- `converse` failures still reject, as before.
- The questions have only been checked with a stubbed AI service, not a live model.

## Interview insights

`GET /me/interview-insights` (frontend proxy `GET /api/interview-insights`) reads the authenticated user's saved target job. It returns the notes an interview for that job would use with mixed focus and no seniority filter, plus coverage and sources, without an AI call.

| Response | Meaning |
|---|---|
| 200 `ready` / `partial` | Insights |
| 200 `no_target_job` | No saved job |
| 200 `unavailable` | The knowledge base can't be used |
| 503 `target_job_unavailable` | Database error |
| 401 / 403 | Authentication |

Responses are `private, no-store`. The panel under the target job form:

- shows loading, ready/partial, no job, unknown company, unavailable and error states, with Try again;
- reloads after the job is saved or removed;
- ignores superseded responses;
- leaves the form untouched on failure.

**Return visits.** Insights are recomputed from the saved job and the deployed knowledge base on every request. A returning user sees the same insights until they edit the job or new content is deployed; then the insights change. No snapshot is stored, and none is needed for the panel.

**Interview sessions.** Unlike the panel, a session stores a snapshot: `prompt_input` holds the full `knowledgeContext`, so follow-ups reuse the opening's notes. `knowledge_summary` (version plus section ids) names what was used, but on its own it can't rebuild old text after a deploy.

## Determinism and versioning

- Files load in code-point order, and ties break by file order and then id.
- `version` is `kb-` plus the first 12 hex characters of a SHA-256 over the format version and each loaded file's path and text. Line endings are normalized to `\n` and any BOM is removed, so the CRLF Windows checkout and the Linux image get the same version.
- Bump `RETRIEVER_VERSION` in `retrieve-knowledge.js` when matching, ranking, the budget or the format change.
- Content is loaded from `path.join(__dirname, "content")`, which ships in the Docker image because the Dockerfile copies `backend/src`.

## Commands

```bash
npm test                                          # content validation, 46 relevance cases, prompt, route
npm run knowledge:report                          # relevance report; exits 1 on any failure
npm run knowledge:report -- --case <id> --context
node scripts/capture-insights-fixture.js          # after an intended insights response change
```

To add or update a company:

1. Read its first-party careers or interview pages.
2. Paraphrase only what they say, and put each URL on the section it supports.
3. Scope position-specific notes with `roles:`, `levels:` or `names:`.
4. Set `reviewed` to the date you read the sources.
5. Add fixtures to `fixtures/retrieval-cases.json`, then run `npm test` and the report.
