import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PauseMetric from "./PauseMetric";
import { analyzePauses } from "@/lib/speech/pauses";
import {
  MOCK_BAD_TIMESTAMPS,
  MOCK_EMPTY,
  MOCK_TRANSCRIPT,
  buildTranscript,
} from "@/lib/speech/speech-mock";

describe("PauseMetric", () => {
  it("shows pause stats and the long pause for a good result", () => {
    const html = renderToStaticMarkup(<PauseMetric result={analyzePauses(MOCK_TRANSCRIPT)} />);
    expect(html).toContain("Pauses Detected");
    expect(html).toContain("3 pauses");
    expect(html).toContain("2.4s after");
  });

  it("handles a transcript with no pauses", () => {
    const words = buildTranscript(
      Array.from({ length: 8 }, (_, i) => [`w${i}`, 0.1] as [string, number]),
    );
    const html = renderToStaticMarkup(<PauseMetric result={analyzePauses(words)} />);
    expect(html).toContain("0 pauses");
    expect(html).toContain("No noticeable pauses");
  });

  it("shows an informational message with no transcript (AC 2)", () => {
    const html = renderToStaticMarkup(<PauseMetric result={analyzePauses(MOCK_EMPTY)} />);
    expect(html).toContain("Pauses unavailable");
  });

  it("shows an error with a retry button when processing fails (AC 3)", () => {
    const html = renderToStaticMarkup(
      <PauseMetric result={analyzePauses(MOCK_BAD_TIMESTAMPS)} onRetry={() => {}} />,
    );
    expect(html).toContain("analyze your pauses");
    expect(html).toContain("Retry analysis");
  });
});
