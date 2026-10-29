import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchResumeFile,
  loadResumes,
  removeResume,
  resetMockResume,
  uploadResume,
} from "@/lib/resume/resume-api";

import { RESUME_VALIDATION_MESSAGES } from "@/lib/resume/resume-validation";

const RESUME = {
  id: "resume-123",
  fileName: "My Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 12,
  uploadedAt: "2026-10-28T12:00:00.000Z",
};

const SECOND_RESUME = {
  id: "resume-456",
  fileName: "Developer Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 10,
  uploadedAt: "2026-10-27T12:00:00.000Z",
};

const FILE = {
  fileName: "My Resume.pdf",
  extension: "pdf" as const,
  bytes: new TextEncoder().encode("%PDF-1.7 abc"),
};

function mockFetch(
  response:
    | {
        status: number;
        body?: unknown;
        headers?: Record<string, string>;
      }
    | Error
) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) {
      throw response;
    }

    const body =
      response.status === 204
        ? null
        : typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body ?? {});

    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
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

  it("uploads the raw file with POST /me/resumes", async () => {
    const fetchMock = mockFetch({
      status: 201,
      body: {
        resume: RESUME,
      },
    });

    await expect(
      uploadResume("id-token", FILE)
    ).resolves.toEqual({
      ok: true,
      resume: RESUME,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/resumes",
      expect.objectContaining({
        method: "POST",
        body: FILE.bytes,
        headers: {
          Authorization: "Bearer id-token",
          "Content-Type": "application/octet-stream",
          "X-File-Name": "My%20Resume.pdf",
        },
      })
    );
  });

  it("maps a rejected file to a clear message", async () => {
    mockFetch({
      status: 400,
      body: {
        code: "unreadable_file",
      },
    });

    await expect(
      uploadResume("t", FILE)
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      code: "unreadable_file",
      message:
        RESUME_VALIDATION_MESSAGES.unreadable_file,
    });

    mockFetch({
      status: 413,
      body: {
        code: "too_large",
      },
    });

    await expect(
      uploadResume("t", FILE)
    ).resolves.toMatchObject({
      code: "too_large",
    });
  });

  it("maps auth and service failures", async () => {
    mockFetch({ status: 401 });

    await expect(
      uploadResume("t", FILE)
    ).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });

    mockFetch({
      status: 502,
      body: {
        code: "storage_unavailable",
      },
    });

    await expect(
      uploadResume("t", FILE)
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });

    mockFetch(new TypeError("fetch failed"));

    await expect(
      uploadResume("t", FILE)
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });

    await expect(
      loadResumes("t")
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });

    await expect(
      removeResume("t", "resume-123")
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("is unavailable when BACKEND_URL is missing", async () => {
    vi.stubEnv("BACKEND_URL", "");

    const fetchMock = mockFetch({
      status: 200,
    });

    await expect(
      loadResumes("t")
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads all saved resumes", async () => {
    mockFetch({
      status: 200,
      body: {
        resumes: [
          RESUME,
          SECOND_RESUME,
        ],
      },
    });

    await expect(
      loadResumes("t")
    ).resolves.toEqual({
      ok: true,
      resumes: [
        RESUME,
        SECOND_RESUME,
      ],
    });
  });

  it("returns an empty resume list", async () => {
    mockFetch({
      status: 200,
      body: {
        resumes: [],
      },
    });

    await expect(
      loadResumes("t")
    ).resolves.toEqual({
      ok: true,
      resumes: [],
    });
  });

  it("passes the requested file through for viewing and downloading", async () => {
    const fetchMock = mockFetch({
      status: 200,
      body: "%PDF-1.7 abc",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="My Resume.pdf"',
        "X-Internal": "not forwarded",
      },
    });

    const result = await fetchResumeFile(
      "t",
      "resume-123",
      true
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/resumes/resume-123/file?download=1",
      expect.anything()
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(
      result.headers.get("Content-Type")
    ).toBe("application/pdf");

    expect(
      result.headers.get("Content-Disposition")
    ).toContain("attachment");

    expect(
      result.headers.get("X-Internal")
    ).toBeNull();

    mockFetch({
      status: 404,
      body: {
        code: "not_found",
      },
    });

    await expect(
      fetchResumeFile(
        "t",
        "resume-123",
        false
      )
    ).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("removes with DELETE /me/resumes/:resumeId", async () => {
    const fetchMock = mockFetch({
      status: 204,
    });

    await expect(
      removeResume("t", "resume-123")
    ).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/me/resumes/resume-123",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("returns not_found when deleting a missing resume", async () => {
    mockFetch({
      status: 404,
    });

    await expect(
      removeResume("t", "resume-missing")
    ).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("uses an in-memory multi-resume store in mock mode without calling the backend", async () => {
    vi.stubEnv("USE_MOCK_DATA", "true");
    resetMockResume();

    const fetchMock = mockFetch({
      status: 500,
    });

    await expect(
      loadResumes("t")
    ).resolves.toEqual({
      ok: true,
      resumes: [],
    });

    const firstUpload =
      await uploadResume("t", FILE);

    expect(firstUpload).toMatchObject({
      ok: true,
      resume: {
        fileName: "My Resume.pdf",
        contentType: "application/pdf",
        sizeBytes: 12,
      },
    });

    if (!firstUpload.ok) {
      throw new Error("Expected first upload to succeed");
    }

    const secondUpload =
      await uploadResume("t", {
        ...FILE,
        fileName: "Developer Resume.pdf",
      });

    expect(secondUpload.ok).toBe(true);

    const loaded =
      await loadResumes("t");

    expect(loaded.ok).toBe(true);

    if (!loaded.ok) {
      throw new Error("Expected resumes to load");
    }

    expect(loaded.resumes).toHaveLength(2);

    const file =
      await fetchResumeFile(
        "t",
        firstUpload.resume.id,
        false
      );

    expect(
      file.ok &&
        file.headers.get("Content-Type")
    ).toBe("application/pdf");

    await expect(
      removeResume(
        "t",
        firstUpload.resume.id
      )
    ).resolves.toEqual({
      ok: true,
    });

    const afterDelete =
      await loadResumes("t");

    expect(afterDelete.ok).toBe(true);

    if (!afterDelete.ok) {
      throw new Error("Expected resumes to load");
    }

    expect(afterDelete.resumes).toHaveLength(1);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});