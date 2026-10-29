import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchResumeFile,
  loadResumes,
  removeResume,
  uploadResume,
} from "@/lib/resume/resume-api";

import { resumeSessionToken } from "@/lib/resume/resume-session";

import {
  RESUME_ERROR_MESSAGES,
} from "@/lib/resume/resume-state";

import {
  MAX_RESUME_BYTES,
  RESUME_VALIDATION_MESSAGES as MSG,
} from "@/lib/resume/resume-validation";

import {
  DELETE,
  GET as GET_RESUMES,
  POST,
} from "@/app/api/resume/route";

import { GET as GET_FILE } from "@/app/api/resume/file/route";

vi.mock("@/lib/resume/resume-session", () => ({
  resumeSessionToken: vi.fn(),
}));

vi.mock("@/lib/resume/resume-api", () => ({
  loadResumes: vi.fn(),
  uploadResume: vi.fn(),
  removeResume: vi.fn(),
  fetchResumeFile: vi.fn(),
}));

const RESUME = {
  id: "resume-123",
  fileName: "My Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 12,
  uploadedAt: "2026-10-28T12:00:00.000Z",
};

const pdf = (
  name = "My Resume.pdf",
  text = "%PDF-1.7 abc"
) =>
  new File([text], name, {
    type: "application/pdf",
  });

function post(file?: File) {
  const form = new FormData();

  if (file) {
    form.set("file", file);
  }

  return POST(
    new Request("http://app.test/api/resume", {
      method: "POST",
      body: form,
    })
  );
}

describe("GET /api/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resumeSessionToken).mockResolvedValue("id-token");
  });

  it("returns all saved resumes", async () => {
    vi.mocked(loadResumes).mockResolvedValue({
      ok: true,
      resumes: [RESUME],
    });

    const response = await GET_RESUMES();

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      resumes: [RESUME],
    });

    expect(loadResumes).toHaveBeenCalledWith("id-token");
  });

  it("requires sign-in", async () => {
    vi.mocked(resumeSessionToken).mockResolvedValue(null);

    const response = await GET_RESUMES();

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("unauthenticated");
    expect(loadResumes).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resumeSessionToken).mockResolvedValue("id-token");
  });

  it("uploads a valid resume and returns its details", async () => {
    vi.mocked(uploadResume).mockResolvedValue({
      ok: true,
      resume: RESUME,
    });

    const response = await post(pdf());

    expect(response.status).toBe(201);

    expect(await response.json()).toEqual({
      resume: RESUME,
    });

    const [token, file] =
      vi.mocked(uploadResume).mock.calls[0];

    expect(token).toBe("id-token");
    expect(file.fileName).toBe("My Resume.pdf");
    expect(file.extension).toBe("pdf");

    expect(
      new TextDecoder().decode(file.bytes)
    ).toBe("%PDF-1.7 abc");
  });

  it("rejects a missing, wrong-type or oversized file before uploading", async () => {
    const missing = await post();

    expect(missing.status).toBe(400);

    expect(await missing.json()).toEqual({
      error: MSG.missing_file,
      code: "missing_file",
    });

    const wrongType = await post(
      new File(["hi"], "resume.txt")
    );

    expect(
      (await wrongType.json()).code
    ).toBe("unsupported_type");

    const tooBig = await post(
      new File(
        [new Uint8Array(MAX_RESUME_BYTES + 1)],
        "big.pdf"
      )
    );

    expect(tooBig.status).toBe(413);
    expect(uploadResume).not.toHaveBeenCalled();
  });

  it("rejects a file whose contents don't match its type", async () => {
    const response = await post(
      pdf(
        "resume.pdf",
        "this is not really a pdf"
      )
    );

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: MSG.unreadable_file,
      code: "unreadable_file",
    });

    expect(uploadResume).not.toHaveBeenCalled();
  });

  it("returns a retryable error when the service is down", async () => {
    vi.mocked(uploadResume).mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await post(pdf());

    expect(response.status).toBe(503);

    expect(await response.json()).toEqual({
      error: RESUME_ERROR_MESSAGES.uploadUnavailable,
      code: "unavailable",
    });
  });

  it("requires sign-in", async () => {
    vi.mocked(resumeSessionToken).mockResolvedValue(null);

    const response = await post(pdf());

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("unauthenticated");
    expect(uploadResume).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resumeSessionToken).mockResolvedValue("id-token");
  });

  it("removes the requested resume", async () => {
    vi.mocked(removeResume).mockResolvedValue({
      ok: true,
    });

    const response = await DELETE(
      new Request(
        "http://app.test/api/resume?id=resume-123",
        {
          method: "DELETE",
        }
      )
    );

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      success: true,
    });

    expect(removeResume).toHaveBeenCalledWith(
      "id-token",
      "resume-123"
    );
  });

  it("requires a resume id", async () => {
    const response = await DELETE(
      new Request(
        "http://app.test/api/resume",
        {
          method: "DELETE",
        }
      )
    );

    expect(response.status).toBe(400);
    expect(removeResume).not.toHaveBeenCalled();
  });

  it("returns a retryable error when removing fails", async () => {
    vi.mocked(removeResume).mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await DELETE(
      new Request(
        "http://app.test/api/resume?id=resume-123",
        {
          method: "DELETE",
        }
      )
    );

    expect(response.status).toBe(503);

    expect(
      (await response.json()).error
    ).toBe(
      RESUME_ERROR_MESSAGES.removeUnavailable
    );
  });
});

describe("GET /api/resume/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resumeSessionToken).mockResolvedValue("id-token");
  });

  it("streams the requested file without caching it", async () => {
    vi.mocked(fetchResumeFile).mockResolvedValue({
      ok: true,
      body: new TextEncoder().encode("%PDF-1.7 abc"),
      headers: new Headers({
        "Content-Type": "application/pdf",
      }),
    });

    const response = await GET_FILE(
      new Request(
        "http://app.test/api/resume/file?id=resume-123&download=1"
      )
    );

    expect(fetchResumeFile).toHaveBeenCalledWith(
      "id-token",
      "resume-123",
      true
    );

    expect(response.status).toBe(200);

    expect(
      response.headers.get("Content-Type")
    ).toBe("application/pdf");

    expect(
      response.headers.get("Cache-Control")
    ).toBe("private, no-store");

    expect(await response.text()).toBe(
      "%PDF-1.7 abc"
    );
  });

  it("returns 404 when the requested resume does not exist", async () => {
    vi.mocked(fetchResumeFile).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    const response = await GET_FILE(
      new Request(
        "http://app.test/api/resume/file?id=resume-123"
      )
    );

    expect(response.status).toBe(404);
  });

  it("requires a resume id", async () => {
    const response = await GET_FILE(
      new Request(
        "http://app.test/api/resume/file"
      )
    );

    expect(response.status).toBe(400);
    expect(fetchResumeFile).not.toHaveBeenCalled();
  });
});