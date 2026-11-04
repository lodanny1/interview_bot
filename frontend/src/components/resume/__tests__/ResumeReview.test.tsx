// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ResumeReview } from "@/components/resume/ResumeReview";
import { MOCK_PARSED_RESUME } from "@/lib/resume/resume-api";

import {
  RESUME_REVIEW_MESSAGES as MSG,
  RESUME_REVIEW_NOTICES,
  type ResumeReview as Review,
  type ResumeReviewStatus,
} from "@/lib/resume/resume-review-state";

import {
  RESUME_REVIEW_VALIDATION_MESSAGES as VALIDATION,
  normalizeResumeData,
  type ResumeData,
} from "@/lib/resume/resume-review-validation";

afterEach(cleanup);

const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const DATA = normalizeResumeData(MOCK_PARSED_RESUME) as ResumeData;

function review(status: ResumeReviewStatus, overrides: Partial<Review> = {}): Review {
  const hasData = status === "ready" || status === "reviewed";

  return {
    resumeId: RESUME_ID,
    fileName: "My Resume.pdf",
    status,
    data: hasData ? DATA : null,
    reviewedAt: status === "reviewed" ? "2026-11-02T10:00:00.000Z" : null,
    ...overrides,
  };
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

function setup(initialReview: Review) {
  const user = userEvent.setup();
  render(<ResumeReview initialReview={initialReview} />);
  return user;
}

function lastRequestBody() {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(init.body as string);
}

describe("ResumeReview", () => {
  describe("extraction", () => {
    it("extracts a resume that hasn't been read, then shows it for review", async () => {
      fetchMock.mockResolvedValue(
        respond(200, {
          resume: { id: RESUME_ID, parseStatus: "COMPLETED", parsedJson: MOCK_PARSED_RESUME },
        })
      );

      const user = setup(review("not_extracted"));

      expect(screen.queryByRole("form", { name: "Resume information" })).toBeNull();

      await user.click(screen.getByRole("button", { name: "Extract information" }));

      expect(fetchMock).toHaveBeenCalledWith(`/api/resume/extract?id=${RESUME_ID}`, {
        method: "POST",
      });

      expect(screen.getByLabelText("Name")).toHaveProperty("value", "Jordan Lee");
      expect(screen.getByLabelText("Role")).toHaveProperty("value", "Software Engineering Intern");
      expect(screen.getByRole("button", { name: "Confirm information" })).toBeTruthy();
    });

    it("does not treat unusable output as extracted and offers recovery", async () => {
      fetchMock.mockResolvedValue(
        respond(200, { resume: { id: RESUME_ID, parseStatus: "COMPLETED", parsedJson: {} } })
      );

      const user = setup(review("not_extracted"));

      await user.click(screen.getByRole("button", { name: "Extract information" }));

      expect(screen.getByRole("heading", { name: "We couldn't read this resume" })).toBeTruthy();
      expect(screen.getByText(MSG.extractFailed)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

      expect(
        screen.getByRole("link", { name: "Upload a different file" }).getAttribute("href")
      ).toBe("/resume");

      expect(screen.queryByRole("form", { name: "Resume information" })).toBeNull();
    });

    it("shows recovery options when extraction fails or can't be reached", async () => {
      for (const failure of [
        () => Promise.resolve(respond(500, { error: "x", code: "extraction_failed" })),
        () => Promise.reject(new Error("offline")),
      ]) {
        fetchMock.mockImplementationOnce(failure);

        const user = setup(review("not_extracted"));

        await user.click(screen.getByRole("button", { name: "Extract information" }));

        expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
        cleanup();
      }
    });

    it("lets the user try again after a failure", async () => {
      fetchMock.mockResolvedValue(
        respond(200, {
          resume: { id: RESUME_ID, parseStatus: "COMPLETED", parsedJson: MOCK_PARSED_RESUME },
        })
      );

      const user = setup(review("failed"));

      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(screen.getByLabelText("Name")).toHaveProperty("value", "Jordan Lee");
    });

    it("lets the user restart an extraction that is stuck processing", async () => {
      fetchMock.mockResolvedValue(respond(500, { error: "x", code: "extraction_failed" }));

      const user = setup(review("processing"));

      await user.click(screen.getByRole("button", { name: "Extract again" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });

    it("asks the user to sign in again when the session expired", async () => {
      fetchMock.mockResolvedValue(respond(401, { error: "x", code: "unauthenticated" }));

      const user = setup(review("not_extracted"));

      await user.click(screen.getByRole("button", { name: "Extract information" }));

      const alert = screen.getByRole("alert");

      expect(within(alert).getByText(MSG.unauthenticated)).toBeTruthy();
      expect(within(alert).getByRole("link", { name: "Go to Sign In" }).getAttribute("href")).toBe(
        "/login"
      );
    });
  });

  describe("confirming", () => {
    it("confirms valid information and shows the reviewed state", async () => {
      fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
        respond(200, {
          review: review("reviewed", { data: JSON.parse(init.body as string) }),
        })
      );

      const user = setup(review("ready"));

      expect(screen.getByText(/Not confirmed yet/)).toBeTruthy();

      await user.clear(screen.getByLabelText(/^Location/));
      await user.type(screen.getByLabelText(/^Location/), "Remote");
      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/resume/review?id=${RESUME_ID}`,
        expect.objectContaining({ method: "PUT" })
      );

      expect(lastRequestBody()).toEqual({ ...DATA, location: "Remote" });

      expect(screen.getByRole("status").textContent).toContain(RESUME_REVIEW_NOTICES.confirmed);
      expect(screen.getByText(/Reviewed on/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
      expect(screen.getByLabelText(/^Location/)).toHaveProperty("value", "Remote");
    });

    it("shows the reviewed state for a resume confirmed earlier", () => {
      setup(review("reviewed"));

      expect(screen.getByText(/Reviewed on/).textContent).toContain("Nov 2, 2026");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    });

    it("shows validation errors without sending missing or invalid information", async () => {
      const user = setup(review("ready"));

      await user.clear(screen.getByLabelText("Name"));
      await user.clear(screen.getByLabelText(/^Email/));
      await user.type(screen.getByLabelText(/^Email/), "jordan@");
      await user.clear(screen.getByLabelText("Role"));
      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toContain(MSG.invalid);
      expect(screen.getByText(VALIDATION.required("Name"))).toBeTruthy();
      expect(screen.getByText(VALIDATION.email)).toBeTruthy();
      expect(screen.getByText(VALIDATION.required("Role"))).toBeTruthy();
      expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    });

    it("requires some resume content to confirm", async () => {
      const user = setup(
        review("ready", {
          data: { ...DATA, skills: [], certifications: [], education: [], projects: [] },
        })
      );

      await user.click(screen.getByRole("button", { name: "Remove Experience 1" }));
      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByText(VALIDATION.noContent)).toBeTruthy();
      expect(screen.getByText("No experience entries found in this resume.")).toBeTruthy();
    });

    it("removes an entry from the confirmed information", async () => {
      fetchMock.mockResolvedValue(respond(200, { review: review("reviewed") }));

      const user = setup(review("ready"));

      await user.click(screen.getByRole("button", { name: "Remove Project 1" }));
      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(lastRequestBody().projects).toEqual([]);
    });

    it("keeps the user's edits when saving fails", async () => {
      fetchMock.mockResolvedValue(respond(503, { error: "x", code: "unavailable" }));

      const user = setup(review("ready"));

      await user.clear(screen.getByLabelText(/^Location/));
      await user.type(screen.getByLabelText(/^Location/), "Remote");
      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(screen.getByRole("alert").textContent).toContain(MSG.saveUnavailable);
      expect(screen.getByLabelText(/^Location/)).toHaveProperty("value", "Remote");
      expect(screen.queryByText(/Reviewed on/)).toBeNull();
    });

    it("shows the server's field errors", async () => {
      fetchMock.mockResolvedValue(
        respond(400, {
          error: "x",
          code: "invalid",
          fieldErrors: { "experience.0.role": VALIDATION.required("Role") },
        })
      );

      const user = setup(review("ready"));

      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(screen.getByText(VALIDATION.required("Role"))).toBeTruthy();
      expect(screen.getByLabelText("Role").getAttribute("aria-invalid")).toBe("true");
    });

    it("explains when the resume can't be confirmed yet", async () => {
      fetchMock.mockResolvedValue(respond(409, { error: "x", code: "not_extracted" }));

      const user = setup(review("ready"));

      await user.click(screen.getByRole("button", { name: "Confirm information" }));

      expect(screen.getByRole("alert").textContent).toContain(MSG.notExtracted);
    });
  });
});
