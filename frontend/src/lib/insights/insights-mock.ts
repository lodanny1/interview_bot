// Mock mode only (USE_MOCK_DATA=true): interview insights that follow the
// mock target job and use the same contract as the backend. The note text is
// sample text, not the real knowledge base.
import type { TargetJob } from "@/lib/target-job/target-job-form-state";
import type { InsightGroup, InsightsFacet, InsightsSuccess, InterviewInsights } from "./insights-state";

const REVIEWED = "2026-11-01";

function facet(status: InsightsFacet["status"], name: string | null, title: string | null): InsightsFacet {
  return { status, name, title, matchedBy: status === "matched" ? "name" : null, reason: null };
}

const FRAMEWORK_GROUP: InsightGroup = {
  documentId: "framework.mixed",
  kind: "framework",
  title: "Mixed interviews",
  reviewed: REVIEWED,
  notes: [
    {
      id: "framework.mixed#overview",
      title: "How mixed interviews work",
      text: "Sample note: a mixed interview combines background, behavioral and role-specific questions.",
      sources: [],
    },
  ],
};

const COMPANY_GROUP: InsightGroup = {
  documentId: "company.amazon",
  kind: "company",
  title: "Amazon",
  reviewed: REVIEWED,
  notes: [
    {
      id: "company.amazon#leadership-principles",
      title: "Leadership Principles",
      text: "Sample note: Amazon publishes 16 Leadership Principles.",
      sources: ["https://www.amazon.jobs/en/principles"],
    },
  ],
};

export function mockInsightsFor(targetJob: TargetJob | null): InsightsSuccess {
  if (!targetJob) return { status: "no_target_job" };

  const company = targetJob.company?.trim() || null;
  const covered = company !== null && company.toLowerCase() === "amazon";

  const insights: InterviewInsights = {
    basis: { focusArea: "mixed", roleLevel: null },
    targetJob: { jobTitle: targetJob.jobTitle, company, updatedAt: targetJob.updatedAt },
    coverage: {
      company: company ? facet(covered ? "matched" : "not_found", company, covered ? "Amazon" : null) : facet("not_given", null, null),
      role: facet("not_found", targetJob.jobTitle, null),
      framework: { ...facet("matched", null, "Mixed interviews"), matchedBy: "default" },
      industry: covered ? { ...facet("matched", null, "Technology industry"), matchedBy: "company" } : facet("not_given", null, null),
    },
    groups: covered ? [COMPANY_GROUP, FRAMEWORK_GROUP] : [FRAMEWORK_GROUP],
    sources: covered
      ? [{ url: "https://www.amazon.jobs/en/principles", documentTitle: "Amazon", reviewed: REVIEWED }]
      : [],
    version: "kb-mock",
    retrieverVersion: "mock",
  };

  return { status: "partial", insights };
}
