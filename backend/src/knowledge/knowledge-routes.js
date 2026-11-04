// Role & Company Knowledge Retrieval (Issue #16). Interview insights for the
// user's saved target job: the curated notes an interview for that job would
// draw on, with their sources and coverage. No AI call is made.
//
//   GET /me/interview-insights
//     200 { status: "ready" | "partial", insights }
//     200 { status: "no_target_job" }
//     200 { status: "unavailable", targetJob }   knowledge base can't be used
//     401 / 403 { error }                        from requireActiveUser
//     503 { status: "error", code: "target_job_unavailable", error }
//
// Insights use mixed focus and no seniority filter, because the target job
// has neither; an interview with other settings may use different notes.
// They are recomputed on every request from the saved job and the deployed
// knowledge base, so they change after job edits or content deployments.
const express = require("express");

const { buildInterviewContext } = require("./interview-context");
const { getKnowledgeBase: defaultGetKnowledgeBase } = require("./knowledge-base");

const INSIGHTS_SETUP = { goal: "specific", focusArea: "mixed" };

function facetSummary(knowledgeBase, entry) {
  const document = entry.documentId ? knowledgeBase.documents.get(entry.documentId) : null;

  return {
    status: entry.status,
    name: entry.input,
    title: document ? document.title : null,
    matchedBy: entry.matchedBy,
    reason: entry.reason,
  };
}

function toInsights(knowledgeBase, knowledge, targetJob) {
  const coverage = {};

  for (const [facet, entry] of Object.entries(knowledge.coverage)) {
    coverage[facet] = facetSummary(knowledgeBase, entry);
  }

  return {
    basis: { focusArea: "mixed", roleLevel: null },
    targetJob: {
      jobTitle: targetJob.job_title,
      company: targetJob.company || null,
      updatedAt: targetJob.updated_at || null,
    },
    coverage,
    groups: knowledge.documents.map((document) => ({
      documentId: document.id,
      kind: document.kind,
      title: document.title,
      reviewed: document.reviewed,
      notes: document.sectionIds.map((id) => {
        const section = knowledgeBase.sections.get(id);

        return { id, title: section.title, text: section.body, sources: section.sources };
      }),
    })),
    sources: knowledge.sources.map((source) => ({
      url: source.url,
      documentTitle: source.documentTitle,
      reviewed: source.reviewed,
    })),
    version: knowledge.version,
    retrieverVersion: knowledge.retrieverVersion,
  };
}

function createKnowledgeRouter({
  requireActiveUser,
  getTargetJob,
  getTargetJobById = null,
  getKnowledgeBase = defaultGetKnowledgeBase,
  logger = console,
}) {
  const router = express.Router();

  async function serveInsights(req, res) {
    // Per-user data: never cached by browsers or proxies.
    res.set("Cache-Control", "private, no-store");

    const auth = await requireActiveUser(req);

    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (req.params.targetJobId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.targetJobId)) {
      return res.status(400).json({ error: "Invalid target job id" });
    }

    let targetJob;

    try {
      targetJob = req.params.targetJobId
        ? (getTargetJobById ? await getTargetJobById(auth.user.id, req.params.targetJobId) : null)
        : await getTargetJob(auth.user.id);
    } catch (error) {
      logger.error("GET /me/interview-insights could not load the target job:", error.message);

      return res.status(503).json({
        status: "error",
        code: "target_job_unavailable",
        error: "Unable to load your target job",
      });
    }

    if (!targetJob) {
      return req.params.targetJobId
        ? res.status(404).json({ error: "Target job not found" })
        : res.status(200).json({ status: "no_target_job" });
    }

    const summary = { jobTitle: targetJob.job_title, company: targetJob.company || null };

    try {
      const knowledgeBase = getKnowledgeBase();
      const { input, knowledge } = buildInterviewContext(
        { setup: INSIGHTS_SETUP, targetJob },
        { knowledgeBase }
      );

      // A saved row always has a title; without one there's nothing to show.
      if (input.goal !== "specific") {
        return res.status(200).json({ status: "no_target_job" });
      }

      if (knowledge.status === "unavailable") {
        return res.status(200).json({ status: "unavailable", targetJob: summary });
      }

      return res.status(200).json({
        status: knowledge.status === "ok" ? "ready" : "partial",
        insights: toInsights(knowledgeBase, knowledge, targetJob),
      });
    } catch (error) {
      logger.error("GET /me/interview-insights could not build insights:", error.message);

      return res.status(200).json({ status: "unavailable", targetJob: summary });
    }
  }

  router.get("/me/interview-insights", serveInsights); // Legacy compatibility
  router.get("/me/target-jobs/:targetJobId/insights", serveInsights);

  return router;
}

module.exports = {
  INSIGHTS_SETUP,
  createKnowledgeRouter,
};
