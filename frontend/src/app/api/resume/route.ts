// Upload Resume (Issue #06).
//   POST   /api/resume  (multipart form, field "file") -> upload or replace
//   DELETE /api/resume                                  -> remove
// This is a route handler rather than a server action because server actions
// only accept 1 MB request bodies and resumes can be up to 5 MB.
import { NextResponse } from "next/server";
import { removeResume, uploadResume } from "@/lib/resume/resume-api";
import { resumeSessionToken } from "@/lib/resume/resume-session";
import { RESUME_ERROR_MESSAGES, type ResumeApiResponse } from "@/lib/resume/resume-state";
import {
  RESUME_VALIDATION_MESSAGES,
  matchesResumeSignature,
  validateResumeFile,
} from "@/lib/resume/resume-validation";

function json(body: ResumeApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

const unauthenticated = () =>
  json({ error: RESUME_ERROR_MESSAGES.unauthenticated, code: "unauthenticated" }, 401);

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();
  if (!idToken) return unauthenticated();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  // Check name, type and size, then the file's contents (Scenario 3).
  const check = validateResumeFile(file instanceof File ? file : null);
  if (!check.ok) {
    return json({ error: check.message, code: check.code }, check.code === "too_large" ? 413 : 400);
  }

  const upload = file as File;
  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (!matchesResumeSignature(bytes, check.extension)) {
    return json(
      { error: RESUME_VALIDATION_MESSAGES.unreadable_file, code: "unreadable_file" },
      400
    );
  }

  const result = await uploadResume(idToken, {
    fileName: upload.name,
    extension: check.extension,
    bytes,
  });

  if (result.ok) return json({ resume: result.resume });
  if (result.reason === "unauthenticated") return unauthenticated();
  if (result.reason === "invalid") {
    return json({ error: result.message, code: result.code }, 400);
  }
  return json({ error: RESUME_ERROR_MESSAGES.uploadUnavailable, code: "unavailable" }, 503);
}

export async function DELETE() {
  const idToken = await resumeSessionToken();
  if (!idToken) return unauthenticated();

  const result = await removeResume(idToken);

  if (result.ok) return json({ resume: null });
  if (result.reason === "unauthenticated") return unauthenticated();
  return json({ error: RESUME_ERROR_MESSAGES.removeUnavailable, code: "unavailable" }, 503);
}
