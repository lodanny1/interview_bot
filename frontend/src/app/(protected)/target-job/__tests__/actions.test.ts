import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { removeTargetJob, saveTargetJob } from "@/lib/target-job/target-job-api";
import { TARGET_JOB_VALIDATION_MESSAGES as MSG } from "@/lib/target-job/target-job-validation";
import {
  TARGET_JOB_ERROR_MESSAGES,
  TARGET_JOB_NOTICES,
  TARGET_JOB_PATH,
} from "@/lib/target-job/target-job-form-state";
import { removeTargetJobAction, saveTargetJobAction } from "@/app/(protected)/target-job/actions";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/target-job/target-job-api", () => ({
  isMockMode: vi.fn(() => false),
  saveTargetJob: vi.fn(),
  removeTargetJob: vi.fn(),
}));

const DESCRIPTION =
  "We are hiring a junior software engineer to build and maintain web features. " +
  "You will work with React and Node.js, write tests, and review code with the team.";

const SAVED = {
  jobTitle: "Junior Software Engineer",
  company: "Acme",
  description: DESCRIPTION,
  updatedAt: "2026-10-26T00:00:00.000Z",
};

function mockSessionCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn(() => (value ? { name: "ib_session", value } : undefined)),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function jobForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = { jobTitle: "Junior Software Engineer", company: " Acme ", description: DESCRIPTION, ...overrides };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const save = (data: FormData) => saveTargetJobAction({}, data);
const remove = () => removeTargetJobAction();

describe("saveTargetJobAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCookie("id-token");
  });

  it("saves the job and returns it so the page shows it (Scenario 1)", async () => {
    vi.mocked(saveTargetJob).mockResolvedValue({ ok: true, targetJob: SAVED });

    await expect(save(jobForm())).resolves.toEqual({
      targetJob: SAVED,
      notice: TARGET_JOB_NOTICES.saved,
    });
    expect(saveTargetJob).toHaveBeenCalledWith("id-token", {
      jobTitle: "Junior Software Engineer",
      company: "Acme",
      description: DESCRIPTION,
    });
    expect(revalidatePath).toHaveBeenCalledWith(TARGET_JOB_PATH);
  });

  it("does not save missing or invalid information (Scenarios 2 and 3)", async () => {
    await expect(save(jobForm({ jobTitle: "", description: "https://example.com/job" }))).resolves.toEqual({
      fieldErrors: { jobTitle: MSG.jobTitleRequired, description: MSG.descriptionIsLink },
    });
    expect(saveTargetJob).not.toHaveBeenCalled();
  });

  it("keeps the user on the form with a retryable error when the service is down", async () => {
    vi.mocked(saveTargetJob).mockResolvedValue({ ok: false, reason: "unavailable" });

    await expect(save(jobForm())).resolves.toEqual({
      formError: TARGET_JOB_ERROR_MESSAGES.saveUnavailable,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the backend's field errors when it rejects the data", async () => {
    vi.mocked(saveTargetJob).mockResolvedValue({
      ok: false,
      reason: "invalid",
      fieldErrors: { description: "Too short" },
    });

    await expect(save(jobForm())).resolves.toEqual({
      formError: TARGET_JOB_ERROR_MESSAGES.invalid,
      fieldErrors: { description: "Too short" },
    });
  });

  it("asks the user to sign in again when the session is missing or expired", async () => {
    mockSessionCookie(undefined);
    await expect(save(jobForm())).resolves.toEqual({
      formError: TARGET_JOB_ERROR_MESSAGES.unauthenticated,
      signInAgain: true,
    });
    expect(saveTargetJob).not.toHaveBeenCalled();

    mockSessionCookie("expired");
    vi.mocked(saveTargetJob).mockResolvedValue({ ok: false, reason: "unauthenticated" });
    await expect(save(jobForm())).resolves.toMatchObject({ signInAgain: true });
  });
});

describe("removeTargetJobAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCookie("id-token");
  });

  it("removes the job and clears it from the page", async () => {
    vi.mocked(removeTargetJob).mockResolvedValue({ ok: true });

    await expect(remove()).resolves.toEqual({
      targetJob: null,
      notice: TARGET_JOB_NOTICES.removed,
    });
    expect(removeTargetJob).toHaveBeenCalledWith("id-token");
    expect(revalidatePath).toHaveBeenCalledWith(TARGET_JOB_PATH);
  });

  it("shows a retryable error when removing fails", async () => {
    vi.mocked(removeTargetJob).mockResolvedValue({ ok: false, reason: "unavailable" });

    await expect(remove()).resolves.toEqual({
      formError: TARGET_JOB_ERROR_MESSAGES.removeUnavailable,
    });
  });
});
