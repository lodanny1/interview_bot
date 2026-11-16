import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SpeechAnalysisCard from "./SpeechAnalysisCard";
import { computeSpeechMetrics } from "@/lib/speech/metrics";
import {
  MOCK_BAD_TIMESTAMPS,
  MOCK_EMPTY,
  MOCK_TRANSCRIPT,
} from "@/lib/speech/speech-mock";

const count = (html: string, text: string) => html.split(text).length - 1;

describe("computeSpeechMetrics", () => {
  it("computes pace and pauses from one transcript", () => {
    const m = computeSpeechMetrics(MOCK_TRANSCRIPT);
    expect(m.pace.status).toBe("ready");
    expect(m.pauses.status).toBe("ready");
  });

  it("never throws on bad input", () => {
    expect(() => computeSpeechMetrics(null)).not.toThrow();
    expect(() => computeSpeechMetrics(MOCK_BAD_TIMESTAMPS)).not.toThrow();
  });
});

describe("SpeechAnalysisCard", () => {
  it("renders pace and pause results (AC 1)", () => {
    const html = renderToStaticMarkup(
      <SpeechAnalysisCard metrics={computeSpeechMetrics(MOCK_TRANSCRIPT)} />,
    );
    expect(html).toContain("Speech Analysis");
    expect(html).toContain("Pacing");
    expect(html).toContain("Pauses Detected");
  });

  it("renders the filler-word slot between pace and pauses", () => {
    const html = renderToStaticMarkup(
      <SpeechAnalysisCard
        metrics={computeSpeechMetrics(MOCK_TRANSCRIPT)}
        fillerWords={<div>FILLER SLOT</div>}
      />,
    );
    expect(html.indexOf("Pacing")).toBeLessThan(html.indexOf("FILLER SLOT"));
    expect(html.indexOf("FILLER SLOT")).toBeLessThan(html.indexOf("Pauses Detected"));
  });

  it("shows ONE message when there is no transcript (AC 2)", () => {
    const html = renderToStaticMarkup(
      <SpeechAnalysisCard metrics={computeSpeechMetrics(MOCK_EMPTY)} />,
    );
    expect(count(html, "unavailable")).toBe(1);
    expect(html).toContain("Speech metrics unavailable");
    expect(html).not.toContain("Pacing");
  });

  it("shows ONE error with a retry button when processing fails (AC 3)", () => {
    const html = renderToStaticMarkup(
      <SpeechAnalysisCard
        metrics={computeSpeechMetrics(MOCK_BAD_TIMESTAMPS)}
        onRetry={() => {}}
      />,
    );
    expect(count(html, "Retry analysis")).toBe(1);
    expect(html).toContain("analyze your speech metrics");
  });

  it("keeps the working metric visible when only the other one fails (AC 3)", () => {
    const ok = computeSpeechMetrics(MOCK_TRANSCRIPT);
    const html = renderToStaticMarkup(
      <SpeechAnalysisCard
        metrics={{
          pace: ok.pace,
          pauses: { status: "failed", code: "PROCESSING_FAILED", message: "Service down." },
        }}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain("Pacing");
    expect(html).toContain("OPTIMAL");
    expect(html).toContain("analyze your pauses");
    expect(html).toContain("Retry analysis");
  });
});
