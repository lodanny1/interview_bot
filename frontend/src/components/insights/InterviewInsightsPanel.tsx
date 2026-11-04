"use client";

// Role & Company Knowledge Retrieval (Issue #16). Shows the curated notes that
// practice interviews for the saved target job draw on, with coverage and
// sources. Read-only: a failure here never affects the target job form.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSIGHTS_API_URL,
  INSIGHTS_MESSAGES,
  parseInsightsResponse,
  type InsightGroup,
  type InsightsFacet,
  type InsightsSuccess,
  type InterviewInsights,
} from "@/lib/insights/insights-state";

interface InterviewInsightsPanelProps {
  // Change it to reload, e.g. after the target job is saved or removed.
  refreshKey?: number;
  targetJobId?: string;
}

type Result =
  | { phase: "loaded"; response: InsightsSuccess }
  | { phase: "error"; code: "unauthenticated" | "service_unavailable" };

// key says which request produced the result, so the panel knows when a
// newer request is still running.
type LoadState = { key: string; result: Result } | null;

export const INSIGHTS_COPY = {
  heading: "Interview insights",
  intro:
    "Notes that practice interviews for this saved job can draw on. They're shown for a mixed interview focus with no seniority level, so the focus and level you choose when you start an interview can change which notes are used.",
  loading: "Loading interview insights…",
  updating: "Updating…",
  noTargetJob: "Save a target job above to see the company and role notes your practice interviews will use.",
  unavailable:
    "Interview notes are temporarily unavailable. Your job is saved, and practice interviews will use general interview guidance without company-specific facts.",
  retry: "Try again",
  signIn: "Go to Sign In",
  sources: "Sources",
} as const;

export function InterviewInsightsPanel({ refreshKey = 0, targetJobId }: InterviewInsightsPanelProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>(null);
  const latestRequest = useRef(0);
  const requestKey = `${targetJobId ?? "legacy"}:${refreshKey}:${attempt}`;

  useEffect(() => {
    const requestId = ++latestRequest.current;
    const controller = new AbortController();

    async function load(): Promise<Result | null> {
      try {
        const response = await fetch(targetJobId ? `/api/target-jobs/${encodeURIComponent(targetJobId)}/insights` : INSIGHTS_API_URL, { cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);

        if (response.status === 401) return { phase: "error", code: "unauthenticated" };

        const parsed = response.ok ? parseInsightsResponse(body) : null;
        return parsed ? { phase: "loaded", response: parsed } : { phase: "error", code: "service_unavailable" };
      } catch {
        return controller.signal.aborted ? null : { phase: "error", code: "service_unavailable" };
      }
    }

    load().then((result) => {
      // A newer request has started: drop this one so it can't overwrite it.
      if (result && requestId === latestRequest.current) {
        setState({ key: requestKey, result });
      }
    });

    return () => controller.abort();
  }, [requestKey]);

  const result = state?.result;
  const updating = state !== null && state.key !== requestKey;
  const retry = () => setAttempt((value) => value + 1);

  return (
    <section
      aria-labelledby="interview-insights-heading"
      aria-busy={state === null || updating}
      className="rounded-2xl border border-line-subtle bg-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="interview-insights-heading" className="flex items-center gap-2 text-xl font-medium text-primary">
          <BookOpen className="h-5 w-5 text-cta" aria-hidden="true" />
          {INSIGHTS_COPY.heading}
        </h2>
        {updating && (
          <span role="status" className="text-sm text-tertiary">
            {INSIGHTS_COPY.updating}
          </span>
        )}
      </div>

      {!result && (
        <p role="status" className="mt-4 text-sm text-tertiary">
          {INSIGHTS_COPY.loading}
        </p>
      )}

      {result?.phase === "error" && result.code === "unauthenticated" && (
        <Notice>
          <p>{INSIGHTS_MESSAGES.unauthenticated}</p>
          <Link href="/login" className="mt-1 inline-block font-semibold underline">
            {INSIGHTS_COPY.signIn}
          </Link>
        </Notice>
      )}

      {result?.phase === "error" && result.code === "service_unavailable" && (
        <Notice action={<RetryButton onClick={retry} disabled={updating} />}>
          <p>{INSIGHTS_MESSAGES.serviceUnavailable}</p>
        </Notice>
      )}

      {result?.phase === "loaded" && result.response.status === "no_target_job" && (
        <p className="mt-4 text-sm text-tertiary">{INSIGHTS_COPY.noTargetJob}</p>
      )}

      {result?.phase === "loaded" && result.response.status === "unavailable" && (
        <Notice action={<RetryButton onClick={retry} disabled={updating} />}>
          <p>{INSIGHTS_COPY.unavailable}</p>
        </Notice>
      )}

      {result?.phase === "loaded" &&
        (result.response.status === "ready" || result.response.status === "partial") && (
          <InsightsBody insights={result.response.insights} />
        )}
    </section>
  );
}

function InsightsBody({ insights }: { insights: InterviewInsights }) {
  const { coverage } = insights;

  return (
    <div className="mt-2 flex flex-col gap-5">
      <p className="text-sm text-tertiary">{INSIGHTS_COPY.intro}</p>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[9rem_1fr]">
        <CoverageRow label="Company" facet={coverage.company} describe={describeCompany} />
        <CoverageRow label="Role" facet={coverage.role} describe={describeRole} />
        <CoverageRow label="Industry" facet={coverage.industry} describe={describeIndustry} />
        <CoverageRow label="Interview style" facet={coverage.framework} describe={describeFramework} />
      </dl>

      {insights.groups.map((group) => (
        <NoteGroup key={group.documentId} group={group} />
      ))}

      {insights.sources.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary">{INSIGHTS_COPY.sources}</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {insights.sources.map((source) => (
              <li key={`${source.documentTitle}-${source.url}`} className="flex flex-wrap items-center gap-x-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-link underline hover:text-link-hover"
                >
                  {source.documentTitle}: {shortUrl(source.url)}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <span className="text-tertiary">Reviewed {formatReviewed(source.reviewed)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CoverageRow({
  label,
  facet,
  describe,
}: {
  label: string;
  facet: InsightsFacet;
  describe: (facet: InsightsFacet) => string;
}) {
  return (
    <>
      <dt className="font-semibold text-primary">{label}</dt>
      <dd className={cn(facet.status === "matched" ? "text-primary" : "text-tertiary")}>{describe(facet)}</dd>
    </>
  );
}

function NoteGroup({ group }: { group: InsightGroup }) {
  return (
    <details className="border-t border-line-subtle pt-4" open={group.kind === "company"}>
      <summary className="cursor-pointer text-sm font-semibold text-link hover:text-link-hover">
        {KIND_LABELS[group.kind]}: {group.title} ({group.notes.length}{" "}
        {group.notes.length === 1 ? "note" : "notes"}, reviewed {formatReviewed(group.reviewed)})
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {group.notes.map((note) => (
          <article key={note.id}>
            <h4 className="text-sm font-semibold text-primary">{note.title}</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-secondary">{note.text}</p>
          </article>
        ))}
      </div>
    </details>
  );
}

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-warning bg-warning-bg px-4 py-3 text-sm text-warning-text"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

function RetryButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 font-semibold underline disabled:opacity-50"
    >
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      {INSIGHTS_COPY.retry}
    </button>
  );
}

const KIND_LABELS: Record<InsightGroup["kind"], string> = {
  company: "Company",
  role: "Role",
  framework: "Interview style",
  industry: "Industry",
};

export function describeCompany(facet: InsightsFacet): string {
  const name = facet.name ?? facet.title ?? "this company";

  switch (facet.status) {
    case "matched":
      return `Verified notes for ${facet.title ?? name}.`;
    case "not_found":
      return `We don't have verified notes for ${name} yet. Practice questions will use the role and general guidance, and won't state facts about this company.`;
    case "unavailable":
      return `Company notes are temporarily unavailable, so practice questions won't state facts about ${name}.`;
    case "omitted":
      return `Notes for ${name} didn't fit this time, so practice questions won't state facts about the company.`;
    default:
      return "No company saved. Add one to see company notes.";
  }
}

export function describeRole(facet: InsightsFacet): string {
  switch (facet.status) {
    case "matched":
      return `Notes for ${facet.title} roles.`;
    case "not_found":
      return `No notes for "${facet.name}" yet. Practice questions will use general interview guidance.`;
    case "unavailable":
      return "Role notes are temporarily unavailable.";
    case "omitted":
      return "Role notes didn't fit this time.";
    default:
      return "No role notes.";
  }
}

export function describeIndustry(facet: InsightsFacet): string {
  switch (facet.status) {
    case "matched":
      return facet.matchedBy === "company" ? `${facet.title} (from the company)` : `${facet.title}`;
    case "unavailable":
      return "Industry notes are temporarily unavailable.";
    case "not_found":
    case "omitted":
      return "No industry notes this time.";
    default:
      return "Not set. You can choose an industry when you start an interview.";
  }
}

export function describeFramework(facet: InsightsFacet): string {
  return facet.status === "matched" ? `${facet.title} (mixed focus)` : "Interview style notes are unavailable.";
}

// Host and path, so several pages on one site are told apart.
function shortUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const text = `${hostname.replace(/^www\./, "")}${pathname.replace(/\/$/, "")}`;
    return text.length > 70 ? `${text.slice(0, 69)}…` : text;
  } catch {
    return url;
  }
}

// "2026-11-01" -> "Nov 1, 2026", read as a calendar date (no time zone shift).
function formatReviewed(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}
