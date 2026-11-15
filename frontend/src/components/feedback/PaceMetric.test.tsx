import { describe, it, expect } from "vitest";
// Render tests use react-dom/server (already a Next.js dependency), no extra libraries needed.
import { renderToStaticMarkup } from "react-dom/server";
import PaceMetric from "./PaceMetric";
import { analyzePace } from "@/lib/speech/pace";
import { MOCK_BAD_TIMESTAMPS, MOCK_EMPTY, MOCK_TRANSCRIPT } from "@/lib/speech/speech-mock";

describe("PaceMetric", () => {
  it("shows wpm and an OPTIMAL badge for a good result", () => {
    const html = renderToStaticMarkup(<PaceMetric result={analyzePace(MOCK_TRANSCRIPT)} />);
    expect(html).toContain("Pacing");
    expect(html).toContain("wpm");
    expect(html).toContain("OPTIMAL");
  });

  it("shows an informational message with no transcript (AC 2)", () => {
    const html = renderToStaticMarkup(<PaceMetric result={analyzePace(MOCK_EMPTY)} />);
    expect(html).toContain("Pacing unavailable");
    expect(html).not.toContain("wpm");
  });

  it("shows an error with a retry button when processing fails (AC 3)", () => {
    const html = renderToStaticMarkup(
      <PaceMetric result={analyzePace(MOCK_BAD_TIMESTAMPS)} onRetry={() => {}} />,
    );
    expect(html).toContain("analyze your pacing");
    expect(html).toContain("Retry analysis");
  });
});
