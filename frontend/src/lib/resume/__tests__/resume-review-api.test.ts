import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOCK_PARSED_RESUME,
  extractResume,
  findMockResume,
  resetMockResume,
  uploadResume,
} from "@/lib/resume/resume-api";

import {
  loadResumeReview,
  saveResumeReview,
} from "@/lib/resume/resume-review-api";

import {
  normalizeResumeData,
  type ResumeData,
} from "@/lib/resume/resume-review-validation";

const RESUME_ID = "11111111-1111-4111-8111-111111111111";

const DATA = normalizeResumeData(MOCK_PARSED_RESUME) as ResumeData;

const REVIEW = {
  resumeId: RESUME_ID,
  fileName: "My Resume.pdf",
  status: "ready",
  data: DATA,
  reviewedAt: null,
};

const FILE = {
  fileName: "My Resume.pdf",
  extension: "pdf" as const,
  bytes: new TextEncoder().encode("%PDF-1.7 abc"),
};

function mockFetch(response: { status: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;

    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("resume review API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubEnv("USE_MOCK_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads a review with GET /me/resumes/:resumeId/review", async () => {
    const fetchMock = mockFetch({ status: 200, body: { review: REVIEW } });

    await expect(loadResumeReview("id-token", RESUME_ID)).resolves.toEqual({
      ok: true,
      review: REVIEW,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://backend.test/me/resumes/${RESUME_ID}/review`,
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer id-token" },
        cache: "no-store",
      })
    );
  });

  it("maps load failures", async () => {
    for (const [status, reason] of [
      [401, "unauthenticated"],
      [403, "unauthenticated"],
      [404, "not_found"],
      [500, "unavailable"],
    ] as const) {
      mockFetch({ status, body: { error: "x" } });

      await expect(loadResumeReview("t", RESUME_ID)).resolves.toEqual({
        ok: false,
        reason,
      });
    }

    mockFetch(new Error("connection refused"));

    await expect(loadResumeReview("t", RESUME_ID)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("treats a malformed review as unavailable instead of showing it", async () => {
    for (const review of [
      null,
      { ...REVIEW, status: "done" },
      { ...REVIEW, data: null },
      { ...REVIEW, data: "text" },
    ]) {
      mockFetch({ status: 200, body: { review } });

      await expect(loadResumeReview("t", RESUME_ID)).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    }
  });

  it("is unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");

    await expect(loadResumeReview("t", RESUME_ID)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("saves a review with PUT /me/resumes/:resumeId/review", async () => {
    const reviewed = {
      ...REVIEW,
      status: "reviewed",
      reviewedAt: "2026-11-02T10:00:00.000Z",
    };

    const fetchMock = mockFetch({ status: 200, body: { review: reviewed } });

    await expect(saveResumeReview("id-token", RESUME_ID, DATA)).resolves.toEqual({
      ok: true,
      review: reviewed,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://backend.test/me/resumes/${RESUME_ID}/review`,
      expect.objectContaining({
        method: "PUT",
        headers: {
          Authorization: "Bearer id-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(DATA),
      })
    );
  });

  it("maps save failures", async () => {
    mockFetch({
      status: 400,
      body: { code: "invalid", fieldErrors: { name: "Name is required." } },
    });

    await expect(saveResumeReview("t", RESUME_ID, DATA)).resolves.toEqual({
      ok: false,
      reason: "invalid",
      fieldErrors: { name: "Name is required." },
    });

    for (const [status, reason] of [
      [401, "unauthenticated"],
      [404, "not_found"],
      [409, "not_extracted"],
      [500, "unavailable"],
    ] as const) {
      mockFetch({ status, body: { error: "x" } });

      await expect(saveResumeReview("t", RESUME_ID, DATA)).resolves.toEqual({
        ok: false,
        reason,
      });
    }
  });

  describe("mock mode", () => {
    beforeEach(() => {
      vi.stubEnv("USE_MOCK_DATA", "true");
      resetMockResume();
    });

    async function uploadMockResume() {
      const uploaded = await uploadResume("t", FILE);
      if (!uploaded.ok) throw new Error("Expected mock upload to succeed");
      return uploaded.resume.id;
    }

    it("reviews an extracted resume without calling the backend", async () => {
      const fetchMock = mockFetch({ status: 500 });
      const resumeId = await uploadMockResume();

      const before = await loadResumeReview("t", resumeId);
      expect(before.ok && before.review.status).toBe("not_extracted");

      await extractResume("t", resumeId);

      const ready = await loadResumeReview("t", resumeId);
      expect(ready.ok && ready.review.status).toBe("ready");
      expect(ready.ok && ready.review.data).toEqual(DATA);

      const saved = await saveResumeReview("t", resumeId, { ...DATA, location: "Remote" });
      expect(saved.ok && saved.review.status).toBe("reviewed");

      const after = await loadResumeReview("t", resumeId);
      expect(after.ok && after.review.status).toBe("reviewed");
      expect(after.ok && after.review.data?.location).toBe("Remote");
      expect(after.ok && after.review.reviewedAt).toEqual(expect.any(String));

      // The original extraction is kept.
      expect(findMockResume(resumeId)?.extraction?.parsedJson).toBe(MOCK_PARSED_RESUME);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not treat unusable mock output as successfully processed", async () => {
      const resumeId = await uploadMockResume();

      findMockResume(resumeId)!.extraction = {
        parseStatus: "COMPLETED",
        parsedJson: {},
      };

      const loaded = await loadResumeReview("t", resumeId);

      expect(loaded.ok && loaded.review).toMatchObject({ status: "failed", data: null });
    });

    it("refuses to save before extraction and for a missing resume", async () => {
      const resumeId = await uploadMockResume();

      await expect(saveResumeReview("t", resumeId, DATA)).resolves.toEqual({
        ok: false,
        reason: "not_extracted",
      });

      await expect(saveResumeReview("t", "missing", DATA)).resolves.toEqual({
        ok: false,
        reason: "not_found",
      });

      await expect(loadResumeReview("t", "missing")).resolves.toEqual({
        ok: false,
        reason: "not_found",
      });
    });
  });
});
