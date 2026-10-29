// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { RESUME_VALIDATION_MESSAGES as MSG, MAX_RESUME_BYTES } from "@/lib/resume/resume-validation";
import {
  RESUME_ERROR_MESSAGES,
  RESUME_NOTICES,
  type Resume,
} from "@/lib/resume/resume-state";

afterEach(cleanup);

const RESUME: Resume = {
  fileName: "Arlena Resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 240 * 1024,
  uploadedAt: "2026-10-28T12:00:00.000Z",
};

const pdf = (name = "My Resume.pdf") => new File(["%PDF-1.7 abc"], name, { type: "application/pdf" });

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

function setup(props: { initialResume?: Resume | null; loadError?: string } = {}) {
  // applyAccept: false lets tests pick files the picker would normally hide.
  const user = userEvent.setup({ applyAccept: false });
  render(<ResumeUpload initialResume={props.initialResume ?? null} loadError={props.loadError} />);
  const input = () => screen.getByLabelText(/Drag and drop your resume/) as HTMLInputElement;
  const uploadButton = () =>
    screen.getByRole("button", { name: /Upload resume|Uploading/ }) as HTMLButtonElement;
  return { user, input, uploadButton };
}

describe("ResumeUpload", () => {
  it("only lets the user upload once a file is chosen", async () => {
    const { user, input, uploadButton } = setup();

    expect(uploadButton().disabled).toBe(true);
    expect(input().accept).toContain(".pdf");
    expect(input().accept).toContain(".docx");

    await user.upload(input(), pdf());
    expect(screen.getByText("My Resume.pdf")).toBeTruthy();
    expect(uploadButton().disabled).toBe(false);
  });

  it("uploads the file and shows it as the current resume (Scenario 1)", async () => {
    fetchMock.mockResolvedValue(respond(200, { resume: RESUME }));
    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect(await screen.findByText(RESUME_NOTICES.uploaded)).toBeTruthy();
    expect(screen.getByRole("heading", { name: RESUME.fileName })).toBeTruthy();
    expect(screen.getByText(/PDF · 240 KB · Uploaded/)).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/resume");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("rejects unsupported or oversized files in the browser (Scenario 3)", async () => {
    const { user, input, uploadButton } = setup();

    await user.upload(input(), new File(["hi"], "resume.txt"));
    expect(screen.getByRole("alert").textContent).toContain(MSG.unsupported_type);
    expect(screen.getByRole("button", { name: "Choose a different file" })).toBeTruthy();
    expect(uploadButton().disabled).toBe(true);

    const big = new File(["x"], "big.pdf");
    Object.defineProperty(big, "size", { value: MAX_RESUME_BYTES + 1 });
    await user.upload(input(), big);
    expect(screen.getByRole("alert").textContent).toContain(MSG.too_large);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the file can't be processed (Scenario 3)", async () => {
    fetchMock.mockResolvedValue(respond(400, { error: MSG.unreadable_file, code: "unreadable_file" }));
    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect((await screen.findByRole("alert")).textContent).toContain(MSG.unreadable_file);
    expect(screen.getByRole("button", { name: "Choose a different file" })).toBeTruthy();
    expect(screen.queryByText("My Resume.pdf")).toBeNull();
  });

  it("keeps the file and allows a retry when the service is down (Scenario 2)", async () => {
    fetchMock
      .mockResolvedValueOnce(respond(503, { error: "down", code: "unavailable" }))
      .mockResolvedValueOnce(respond(200, { resume: RESUME }));
    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect((await screen.findByRole("alert")).textContent).toContain(
      RESUME_ERROR_MESSAGES.uploadUnavailable
    );
    expect(screen.getByText("My Resume.pdf")).toBeTruthy();
    expect(uploadButton().disabled).toBe(false);

    await user.click(uploadButton());
    expect(await screen.findByText(RESUME_NOTICES.uploaded)).toBeTruthy();
  });

  it("treats a network failure as a retryable error instead of crashing", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    expect((await screen.findByRole("alert")).textContent).toContain(
      RESUME_ERROR_MESSAGES.uploadUnavailable
    );
  });

  it("offers a Sign In link when the session expired", async () => {
    fetchMock.mockResolvedValue(respond(401, { error: "x", code: "unauthenticated" }));
    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    const link = await screen.findByRole("link", { name: "Go to Sign In" });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("shows a saved resume with view and download links (Scenario 4)", () => {
    setup({ initialResume: RESUME });

    expect(screen.getByRole("heading", { name: RESUME.fileName })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View" }).getAttribute("href")).toBe("/api/resume/file");
    expect(screen.getByRole("link", { name: "Download" }).getAttribute("href")).toBe(
      "/api/resume/file?download=1"
    );
    expect(screen.queryByLabelText(/Drag and drop your resume/)).toBeNull();
  });

  it("replaces a saved resume", async () => {
    fetchMock.mockResolvedValue(respond(200, { resume: { ...RESUME, fileName: "New.pdf" } }));
    const { user, input, uploadButton } = setup({ initialResume: RESUME });

    await user.click(screen.getByRole("button", { name: "Replace" }));
    await user.upload(input(), pdf("New.pdf"));
    await user.click(uploadButton());

    expect(await screen.findByRole("heading", { name: "New.pdf" })).toBeTruthy();
    expect(screen.queryByLabelText(/Drag and drop your resume/)).toBeNull();
  });

  it("asks for confirmation, then removes the resume", async () => {
    fetchMock.mockResolvedValue(respond(200, { resume: null }));
    const { user } = setup({ initialResume: RESUME });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));

    expect(await screen.findByText(RESUME_NOTICES.removed)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/resume", expect.objectContaining({ method: "DELETE" }));
    expect(screen.getByLabelText(/Drag and drop your resume/)).toBeTruthy();
  });

  it("still lets the user upload when the saved resume couldn't be loaded", () => {
    setup({ loadError: RESUME_ERROR_MESSAGES.loadUnavailable });

    expect(screen.getByRole("status").textContent).toContain(RESUME_ERROR_MESSAGES.loadUnavailable);
    expect(screen.getByLabelText(/Drag and drop your resume/)).toBeTruthy();
  });

  it("disables the upload button while uploading", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    const { user, input, uploadButton } = setup();

    await user.upload(input(), pdf());
    await user.click(uploadButton());

    await waitFor(() => expect(uploadButton().textContent).toContain("Uploading"));
    expect(uploadButton().disabled).toBe(true);
    finish(respond(200, { resume: RESUME }));
    expect(await screen.findByText(RESUME_NOTICES.uploaded)).toBeTruthy();
  });
});
