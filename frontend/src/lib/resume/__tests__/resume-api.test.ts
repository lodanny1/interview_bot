import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchResumeFile,
  loadResume,
  removeResume,
  resetMockResume,
  uploadResume,
} from "@/lib/resume/resume-api";
import { RESUME_VALIDATION_MESSAGES } from "@/lib/resume/resume-validation";

const RESUME = {
  fileName: "My Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 12,
  uploadedAt: "2026-10-28T12:00:00.000Z",
};

const FILE = {
  fileName: "My Resume.pdf",
  extension: "pdf" as const,
  bytes: new TextEncoder().encode("%PDF-1.7 abc"),
};

function mockFetch(response: { status: number; body?: unknown; headers?: Record<string, string> } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    const body =
      response.status === 204
        ? null
        : typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body ?? {});
    return new Response(body, { status: response.status, headers: response.headers });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("resume API", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_URL", "http://backend.test");
    vi.stubEnv("USE_MOCK_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("uploads the raw file with PUT /me/resume (Scenario 1)", async () => {
    const fetchMock = mockFetch({ status: 200, body: { resume: RESUME } });

    await expect(uploadResume("id-token", FILE)).resolves.toEqual({ ok: true, resume: RESUME });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/resume",
      expect.objectContaining({
        method: "PUT",
        body: FILE.bytes,
        headers: {
          Authorization: "Bearer id-token",
          "Content-Type": "application/octet-stream",
          "X-File-Name": "My%20Resume.pdf",
        },
      })
    );
  });

  it("maps a rejected file to a clear message (Scenario 3)", async () => {
    mockFetch({ status: 400, body: { code: "unreadable_file" } });
    await expect(uploadResume("t", FILE)).resolves.toEqual({
      ok: false,
      reason: "invalid",
      code: "unreadable_file",
      message: RESUME_VALIDATION_MESSAGES.unreadable_file,
    });

    mockFetch({ status: 413, body: { code: "too_large" } });
    await expect(uploadResume("t", FILE)).resolves.toMatchObject({ code: "too_large" });
  });

  it("maps auth and service failures (Scenario 2)", async () => {
    mockFetch({ status: 401 });
    await expect(uploadResume("t", FILE)).resolves.toEqual({ ok: false, reason: "unauthenticated" });

    mockFetch({ status: 502, body: { code: "storage_unavailable" } });
    await expect(uploadResume("t", FILE)).resolves.toEqual({ ok: false, reason: "unavailable" });

    mockFetch(new TypeError("fetch failed"));
    await expect(uploadResume("t", FILE)).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(loadResume("t")).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(removeResume("t")).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("is unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const fetchMock = mockFetch({ status: 200 });
    await expect(loadResume("t")).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the saved resume, or null (Scenario 4)", async () => {
    mockFetch({ status: 200, body: { resume: RESUME } });
    await expect(loadResume("t")).resolves.toEqual({ ok: true, resume: RESUME });

    mockFetch({ status: 200, body: { resume: null } });
    await expect(loadResume("t")).resolves.toEqual({ ok: true, resume: null });
  });

  it("passes the file through for viewing and downloading", async () => {
    const fetchMock = mockFetch({
      status: 200,
      body: "%PDF-1.7 abc",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="My Resume.pdf"',
        "X-Internal": "not forwarded",
      },
    });

    const result = await fetchResumeFile("t", true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/resume/file?download=1",
      expect.anything()
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headers.get("Content-Type")).toBe("application/pdf");
    expect(result.headers.get("Content-Disposition")).toContain("attachment");
    expect(result.headers.get("X-Internal")).toBeNull();

    mockFetch({ status: 404, body: { code: "not_found" } });
    await expect(fetchResumeFile("t", false)).resolves.toEqual({ ok: false, reason: "not_found" });
  });

  it("removes with DELETE /me/resume", async () => {
    const fetchMock = mockFetch({ status: 204 });
    await expect(removeResume("t")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/resume",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("uses an in-memory store in mock mode without calling the backend", async () => {
    vi.stubEnv("USE_MOCK_DATA", "true");
    resetMockResume();
    const fetchMock = mockFetch({ status: 500 });

    await expect(loadResume("t")).resolves.toEqual({ ok: true, resume: null });
    await expect(uploadResume("t", FILE)).resolves.toMatchObject({
      ok: true,
      resume: { fileName: "My Resume.pdf", contentType: "application/pdf", sizeBytes: 12 },
    });
    const file = await fetchResumeFile("t", false);
    expect(file.ok && file.headers.get("Content-Type")).toBe("application/pdf");
    await expect(removeResume("t")).resolves.toEqual({ ok: true });
    await expect(loadResume("t")).resolves.toEqual({ ok: true, resume: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
