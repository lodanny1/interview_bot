// Role & Company Knowledge Retrieval (Issue #16). Shared contract for the
// interview insights shown under the target job form. The backend route is
// GET /me/interview-insights (backend/src/knowledge/knowledge-routes.js); the
// app proxies it at /api/interview-insights.

export type InsightKind = "company" | "role" | "framework" | "industry";

export type CoverageStatus = "matched" | "not_given" | "not_found" | "unavailable" | "omitted";

export interface InsightsFacet {
  status: CoverageStatus;
  // What the user entered (company name, job title), if anything.
  name: string | null;
  // The knowledge base document that matched, if any.
  title: string | null;
  matchedBy: string | null;
  reason: string | null;
}

export interface InsightNote {
  id: string;
  title: string;
  text: string;
  sources: string[];
}

export interface InsightGroup {
  documentId: string;
  kind: InsightKind;
  title: string;
  reviewed: string;
  notes: InsightNote[];
}

export interface InsightSource {
  url: string;
  documentTitle: string;
  reviewed: string;
}

export interface InterviewInsights {
  // Insights use mixed focus and no seniority level; interviews may differ.
  basis: { focusArea: "mixed"; roleLevel: null };
  targetJob: { jobTitle: string; company: string | null; updatedAt: string | null };
  coverage: Record<InsightKind, InsightsFacet>;
  groups: InsightGroup[];
  sources: InsightSource[];
  version: string;
  retrieverVersion: string;
}

// What /api/interview-insights returns.
export type InsightsResponse =
  | { status: "ready" | "partial"; insights: InterviewInsights }
  | { status: "no_target_job" }
  | { status: "unavailable"; targetJob: { jobTitle: string; company: string | null } }
  | { status: "error"; code: "unauthenticated" | "service_unavailable"; error: string };

export type InsightsSuccess = Exclude<InsightsResponse, { status: "error" }>;

export const INSIGHTS_API_URL = "/api/interview-insights";

export const INSIGHTS_MESSAGES = {
  unauthenticated: "Your session has expired. Please sign in again to see interview insights.",
  serviceUnavailable:
    "We couldn't load interview insights right now. Your saved job isn't affected, so please try again.",
} as const;

const KINDS: InsightKind[] = ["company", "role", "framework", "industry"];
const STATUSES: CoverageStatus[] = ["matched", "not_given", "not_found", "unavailable", "omitted"];

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function stringOrNull(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return isString(value) ? value : undefined;
}

// Only https links are rendered, so a bad payload can't produce a
// javascript: or other unsafe link.
function isHttpsUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function parseFacet(raw: unknown): InsightsFacet | null {
  if (!isObject(raw) || !STATUSES.includes(raw.status as CoverageStatus)) return null;

  const name = stringOrNull(raw.name);
  const title = stringOrNull(raw.title);
  const matchedBy = stringOrNull(raw.matchedBy);
  const reason = stringOrNull(raw.reason);

  if (name === undefined || title === undefined || matchedBy === undefined || reason === undefined) {
    return null;
  }

  return { status: raw.status as CoverageStatus, name, title, matchedBy, reason };
}

function parseGroup(raw: unknown): InsightGroup | null {
  if (!isObject(raw) || !isString(raw.documentId) || !isString(raw.title) || !isString(raw.reviewed)) {
    return null;
  }
  if (!KINDS.includes(raw.kind as InsightKind) || !Array.isArray(raw.notes)) return null;

  const notes: InsightNote[] = [];
  for (const note of raw.notes) {
    if (!isObject(note) || !isString(note.id) || !isString(note.title) || !isString(note.text)) {
      return null;
    }
    const sources = Array.isArray(note.sources) ? note.sources.filter(isHttpsUrl) : [];
    notes.push({ id: note.id, title: note.title, text: note.text, sources });
  }

  return {
    documentId: raw.documentId,
    kind: raw.kind as InsightKind,
    title: raw.title,
    reviewed: raw.reviewed,
    notes,
  };
}

function parseInsights(raw: unknown): InterviewInsights | null {
  if (!isObject(raw) || !isObject(raw.targetJob) || !isObject(raw.coverage)) return null;
  if (!Array.isArray(raw.groups) || !Array.isArray(raw.sources)) return null;
  if (!isString(raw.version) || !isString(raw.retrieverVersion)) return null;

  const jobTitle = raw.targetJob.jobTitle;
  const company = stringOrNull(raw.targetJob.company);
  const updatedAt = stringOrNull(raw.targetJob.updatedAt);
  if (!isString(jobTitle) || company === undefined || updatedAt === undefined) return null;

  const coverage = {} as Record<InsightKind, InsightsFacet>;
  for (const kind of KINDS) {
    const facet = parseFacet(raw.coverage[kind]);
    if (!facet) return null;
    coverage[kind] = facet;
  }

  const groups: InsightGroup[] = [];
  for (const group of raw.groups) {
    const parsed = parseGroup(group);
    if (!parsed) return null;
    groups.push(parsed);
  }

  const sources: InsightSource[] = [];
  for (const source of raw.sources) {
    if (!isObject(source) || !isString(source.documentTitle) || !isString(source.reviewed)) return null;
    if (isHttpsUrl(source.url)) {
      sources.push({ url: source.url, documentTitle: source.documentTitle, reviewed: source.reviewed });
    }
  }

  return {
    basis: { focusArea: "mixed", roleLevel: null },
    targetJob: { jobTitle, company, updatedAt },
    coverage,
    groups,
    sources,
    version: raw.version,
    retrieverVersion: raw.retrieverVersion,
  };
}

// Validates a success body from the backend (or the app route). Returns null
// for anything unexpected, which callers treat as "service unavailable".
export function parseInsightsResponse(raw: unknown): InsightsSuccess | null {
  if (!isObject(raw)) return null;

  if (raw.status === "no_target_job") return { status: "no_target_job" };

  if (raw.status === "unavailable") {
    if (!isObject(raw.targetJob) || !isString(raw.targetJob.jobTitle)) return null;
    const company = stringOrNull(raw.targetJob.company);
    if (company === undefined) return null;
    return { status: "unavailable", targetJob: { jobTitle: raw.targetJob.jobTitle, company } };
  }

  if (raw.status === "ready" || raw.status === "partial") {
    const insights = parseInsights(raw.insights);
    return insights ? { status: raw.status, insights } : null;
  }

  return null;
}
