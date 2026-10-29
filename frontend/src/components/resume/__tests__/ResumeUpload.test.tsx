// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { ResumeUpload } from "@/components/resume/ResumeUpload";

import {
  MAX_RESUME_BYTES,
  RESUME_VALIDATION_MESSAGES as MSG,
} from "@/lib/resume/resume-validation";

import {
  RESUME_ERROR_MESSAGES,
  RESUME_NOTICES,
  type Resume,
} from "@/lib/resume/resume-state";

afterEach(cleanup);

const RESUME: Resume = {
  id: "resume-123",
  fileName: "Arlena Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 240 * 1024,
  uploadedAt: "2026-10-28T12:00:00.000Z",
};

const SECOND_RESUME: Resume = {
  id: "resume-456",
  fileName: "Developer Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 180 * 1024,
  uploadedAt: "2026-10-27T12:00:00.000Z",
};

const pdf = (name = "My Resume.pdf") =>
  new File(["%PDF-1.7 abc"], name, {
    type: "application/pdf",
  });

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

function setup(
  props: {
    initialResumes?: Resume[];
    loadError?: string;
  } = {}
) {
  const user = userEvent.setup({
    applyAccept: false,
  });

  render(
    <ResumeUpload
      initialResumes={props.initialResumes ?? []}
      loadError={props.loadError}
    />
  );

  const input = () =>
    screen.getByLabelText(
      /Drag and drop your resume/
    ) as HTMLInputElement;

  const uploadButton = () =>
    screen.getByRole("button", {
      name: /Upload Resume|Uploading/,
    }) as HTMLButtonElement;

  return {
    user,
    input,
    uploadButton,
  };
}

describe("ResumeUpload", () => {
  it("only lets the user upload once a file is chosen", async () => {
    const { user, input, uploadButton } = setup();

    expect(uploadButton().disabled).toBe(true);
    expect(input().accept).toContain(".pdf");
    expect(input().accept).toContain(".docx");

    await user.upload(input(), pdf());

    expect(
      screen.getByText("My Resume.pdf")
    ).toBeTruthy();

    expect(uploadButton().disabled).toBe(false);
  });

  it("uploads a file and adds it to saved resumes", async () => {
    fetchMock.mockResolvedValue(
      respond(201, {
        resume: RESUME,
      })
    );

    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect(
      await screen.findByText(
        RESUME_NOTICES.uploaded
      )
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: RESUME.fileName,
      })
    ).toBeTruthy();

    expect(
      screen.getByText(/PDF · 240 KB · Uploaded/)
    ).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/resume");
    expect(init.method).toBe("POST");

    expect(
      (init.body as FormData).get("file")
    ).toBeInstanceOf(File);
  });

  it("keeps existing resumes when another resume is uploaded", async () => {
    fetchMock.mockResolvedValue(
      respond(201, {
        resume: SECOND_RESUME,
      })
    );

    const { user, input, uploadButton } = setup({
      initialResumes: [RESUME],
    });

    await user.upload(
      input(),
      pdf("Developer Resume.pdf")
    );

    await user.click(uploadButton());

    expect(
      await screen.findByRole("heading", {
        name: SECOND_RESUME.fileName,
      })
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: RESUME.fileName,
      })
    ).toBeTruthy();

    expect(
      screen.getByText("2 resumes saved.")
    ).toBeTruthy();
  });

  it("rejects unsupported or oversized files in the browser", async () => {
    const { user, input, uploadButton } = setup();

    await user.upload(
      input(),
      new File(["hi"], "resume.txt")
    );

    expect(
      screen.getByRole("alert").textContent
    ).toContain(MSG.unsupported_type);

    expect(
      screen.getByRole("button", {
        name: "Choose a different file",
      })
    ).toBeTruthy();

    expect(uploadButton().disabled).toBe(true);

    const big = new File(["x"], "big.pdf");

    Object.defineProperty(big, "size", {
      value: MAX_RESUME_BYTES + 1,
    });

    await user.upload(input(), big);

    expect(
      screen.getByRole("alert").textContent
    ).toContain(MSG.too_large);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server reason when the file cannot be processed", async () => {
    fetchMock.mockResolvedValue(
      respond(400, {
        error: MSG.unreadable_file,
        code: "unreadable_file",
      })
    );

    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect(
      (await screen.findByRole("alert"))
        .textContent
    ).toContain(MSG.unreadable_file);

    expect(
      screen.getByRole("button", {
        name: "Choose a different file",
      })
    ).toBeTruthy();

    expect(
      screen.queryByText("My Resume.pdf")
    ).toBeNull();
  });

  it("keeps the file and allows retry when the service is down", async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(503, {
          error: "down",
          code: "unavailable",
        })
      )
      .mockResolvedValueOnce(
        respond(201, {
          resume: RESUME,
        })
      );

    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect(
      (await screen.findByRole("alert"))
        .textContent
    ).toContain(
      RESUME_ERROR_MESSAGES.uploadUnavailable
    );

    expect(
      screen.getByText("My Resume.pdf")
    ).toBeTruthy();

    expect(uploadButton().disabled).toBe(false);

    await user.click(uploadButton());

    expect(
      await screen.findByText(
        RESUME_NOTICES.uploaded
      )
    ).toBeTruthy();
  });

  it("treats a network failure as retryable", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect(
      (await screen.findByRole("alert"))
        .textContent
    ).toContain(
      RESUME_ERROR_MESSAGES.uploadUnavailable
    );
  });

  it("offers a Sign In link when the session expired", async () => {
    fetchMock.mockResolvedValue(
      respond(401, {
        error: "x",
        code: "unauthenticated",
      })
    );

    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    const link = await screen.findByRole("link", {
      name: "Go to Sign In",
    });

    expect(link.getAttribute("href")).toBe(
      "/login"
    );
  });

  it("shows multiple saved resumes with view and download links", () => {
    setup({
      initialResumes: [
        RESUME,
        SECOND_RESUME,
      ],
    });

    expect(
      screen.getByRole("heading", {
        name: RESUME.fileName,
      })
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: SECOND_RESUME.fileName,
      })
    ).toBeTruthy();

    const viewLinks =
      screen.getAllByRole("link", {
        name: "View",
      });

    expect(
      viewLinks[0].getAttribute("href")
    ).toBe(
      "/api/resume/file?id=resume-123"
    );

    const downloadLinks =
      screen.getAllByRole("link", {
        name: "Download",
      });

    expect(
      downloadLinks[0].getAttribute("href")
    ).toBe(
      "/api/resume/file?id=resume-123&download=1"
    );

    // Upload remains available even when resumes exist.
    expect(
      screen.getByLabelText(
        /Drag and drop your resume/
      )
    ).toBeTruthy();
  });

  it("asks for confirmation, then removes only the selected resume", async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        success: true,
      })
    );

    const { user } = setup({
      initialResumes: [
        RESUME,
        SECOND_RESUME,
      ],
    });

    const removeButtons =
      screen.getAllByRole("button", {
        name: "Remove",
      });

    await user.click(removeButtons[0]);

    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "Yes, remove it",
      })
    );

    expect(
      await screen.findByText(
        RESUME_NOTICES.removed
      )
    ).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resume?id=resume-123",
      expect.objectContaining({
        method: "DELETE",
      })
    );

    expect(
      screen.queryByRole("heading", {
        name: RESUME.fileName,
      })
    ).toBeNull();

    expect(
      screen.getByRole("heading", {
        name: SECOND_RESUME.fileName,
      })
    ).toBeTruthy();
  });

  it("still lets the user upload when saved resumes could not be loaded", () => {
    setup({
      loadError:
        RESUME_ERROR_MESSAGES.loadUnavailable,
    });

    expect(
      screen.getByRole("status").textContent
    ).toContain(
      RESUME_ERROR_MESSAGES.loadUnavailable
    );

    expect(
      screen.getByLabelText(
        /Drag and drop your resume/
      )
    ).toBeTruthy();
  });

  it("disables the upload button while uploading", async () => {
    let finish!: (value: Response) => void;

    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      })
    );

    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    await waitFor(() =>
      expect(
        uploadButton().textContent
      ).toContain("Uploading")
    );

    expect(uploadButton().disabled).toBe(true);

    finish(
      respond(201, {
        resume: RESUME,
      })
    );

    expect(
      await screen.findByText(
        RESUME_NOTICES.uploaded
      )
    ).toBeTruthy();
  });
});