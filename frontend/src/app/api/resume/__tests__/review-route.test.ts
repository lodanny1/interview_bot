import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "@/app/api/resume/review/route";
import { MOCK_PARSED_RESUME } from "@/lib/resume/resume-api";
import { saveResumeReview } from "@/lib/resume/resume-review-api";
import { RESUME_REVIEW_MESSAGES as MSG } from "@/lib/resume/resume-review-state";
import { resumeSessionToken } from "@/lib/resume/resume-session";

import {
  RESUME_REVIEW_VALIDATION_MESSAGES,
  normalizeResumeData,
  type ResumeData,
} from "@/lib/resume/resume-review-validation";

vi.mock("@/lib/resume/resume-session", () => ({
  resumeSessionToken: vi.fn(),
}));

vi.mock("@/lib/resume/resume-review-api", () => ({
  saveResumeReview: vi.fn(),
}));

const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const DATA = normalizeResumeData(MOCK_PARSED_RESUME) as ResumeData;

const REVIEWED = {
  resumeId: RESUME_ID,
  fileName: "My Resume.pdf",
  status: "reviewed",
  data: DATA,
  reviewedAt: "2026-11-02T10:00:00.000Z",
};

function put(body: unknown, query = `?id=${RESUME_ID}`) {
  return PUT(
    new Request(`http://localhost/api/resume/review${query}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("PUT /api/resume/review", () => {
  beforeEach(() => {
    vi.mocked(resumeSessionToken).mockResolvedValue("id-token");
    vi.mocked(saveResumeReview).mockReset();
  });

  it("saves valid information", async () => {
    vi.mocked(saveResumeReview).mockResolvedValue({ ok: true, review: REVIEWED as never });

    const response = await put({ ...DATA, name: "  Jordan Lee  " });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ review: REVIEWED });
    expect(saveResumeReview).toHaveBeenCalledWith("id-token", RESUME_ID, DATA);
  });

  it("requires sign-in and a resume id", async () => {
    vi.mocked(resumeSessionToken).mockResolvedValueOnce(null);

    const signedOut = await put(DATA);
    expect(signedOut.status).toBe(401);
    expect((await signedOut.json()).code).toBe("unauthenticated");

    const missingId = await put(DATA, "");
    expect(missingId.status).toBe(400);
    expect((await missingId.json()).code).toBe("missing_resume_id");

    expect(saveResumeReview).not.toHaveBeenCalled();
  });

  it("rejects missing or invalid information without saving", async () => {
    const response = await put({ ...DATA, name: "", email: "jordan@" });

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.code).toBe("invalid");
    expect(body.fieldErrors.name).toBe(RESUME_REVIEW_VALIDATION_MESSAGES.required("Name"));
    expect(body.fieldErrors.email).toBe(RESUME_REVIEW_VALIDATION_MESSAGES.email);

    const malformed = await put("{not json");
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).code).toBe("invalid");

    expect(saveResumeReview).not.toHaveBeenCalled();
  });

  it("maps save failures to stable codes", async () => {
    for (const [result, status, code, error] of [
      [{ ok: false, reason: "unauthenticated" }, 401, "unauthenticated", MSG.unauthenticated],
      [{ ok: false, reason: "not_found" }, 404, "not_found", MSG.notFound],
      [{ ok: false, reason: "not_extracted" }, 409, "not_extracted", MSG.notExtracted],
      [{ ok: false, reason: "unavailable" }, 503, "unavailable", MSG.saveUnavailable],
    ] as const) {
      vi.mocked(saveResumeReview).mockResolvedValueOnce(result);

      const response = await put(DATA);

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error, code });
    }

    vi.mocked(saveResumeReview).mockResolvedValueOnce({
      ok: false,
      reason: "invalid",
      fieldErrors: { "experience.0.role": "Role is required." },
    });

    const invalid = await put(DATA);

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fieldErrors).toEqual({
      "experience.0.role": "Role is required.",
    });
  });
});
