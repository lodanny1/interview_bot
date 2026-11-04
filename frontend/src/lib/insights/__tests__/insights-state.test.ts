import { describe, expect, it } from "vitest";
import { parseInsightsResponse } from "@/lib/insights/insights-state";
import { mockInsightsFor } from "@/lib/insights/insights-mock";
import backend from "./backend-insights.json";

describe("parseInsightsResponse", () => {
  it("accepts the real backend responses (captured from knowledge-routes.js)", () => {
    const ready = parseInsightsResponse(backend.ready);
    const partial = parseInsightsResponse(backend.partial);

    expect(ready?.status).toBe("ready");
    expect(partial?.status).toBe("partial");
    expect(parseInsightsResponse(backend.noTargetJob)).toEqual({ status: "no_target_job" });

    if (ready?.status !== "ready") throw new Error("expected ready");
    expect(ready.insights.coverage.company).toMatchObject({ status: "matched", title: "Amazon" });
    expect(ready.insights.groups.map((group) => group.kind)).toEqual(["company", "role", "framework", "industry"]);
    expect(ready.insights.sources.length).toBe(backend.ready.insights.sources.length);

    if (partial?.status !== "partial") throw new Error("expected partial");
    expect(partial.insights.coverage.company).toMatchObject({
      status: "not_found",
      name: "Riverbend Credit Union",
      title: null,
    });
  });

  it("accepts the unavailable response", () => {
    expect(
      parseInsightsResponse({ status: "unavailable", targetJob: { jobTitle: "Data Analyst", company: null } })
    ).toEqual({ status: "unavailable", targetJob: { jobTitle: "Data Analyst", company: null } });
  });

  it("rejects bodies that don't match the contract", () => {
    const broken = structuredClone(backend.ready) as Record<string, unknown>;
    (broken.insights as Record<string, unknown>).coverage = { company: { status: "matched" } };

    for (const body of [
      null,
      "ready",
      {},
      { status: "ready" },
      { status: "something_else" },
      { status: "unavailable" },
      broken,
    ]) {
      expect(parseInsightsResponse(body)).toBeNull();
    }
  });

  it("drops source links that aren't https", () => {
    const body = structuredClone(backend.ready);
    body.insights.sources = [
      { url: "javascript:alert(1)", documentTitle: "Bad", reviewed: "2026-11-01" },
      { url: "http://example.com/plain", documentTitle: "Plain", reviewed: "2026-11-01" },
      { url: "https://example.com/ok", documentTitle: "Good", reviewed: "2026-11-01" },
    ];
    body.insights.groups[0].notes[0].sources = ["javascript:alert(1)", "https://example.com/ok"];

    const parsed = parseInsightsResponse(body);
    if (parsed?.status !== "ready") throw new Error("expected ready");

    expect(parsed.insights.sources.map((source) => source.url)).toEqual(["https://example.com/ok"]);
    expect(parsed.insights.groups[0].notes[0].sources).toEqual(["https://example.com/ok"]);
  });

  it("mock responses follow the same contract", () => {
    const job = { jobTitle: "Software Engineer", company: "Amazon", description: "x", updatedAt: "2026-11-01" };

    for (const response of [
      mockInsightsFor(null),
      mockInsightsFor(job),
      mockInsightsFor({ ...job, company: "Acme" }),
      mockInsightsFor({ ...job, company: null }),
    ]) {
      expect(parseInsightsResponse(JSON.parse(JSON.stringify(response)))).toEqual(response);
    }
  });
});
