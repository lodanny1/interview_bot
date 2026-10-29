// Upload Resume (Issue #06).
//
//   GET    /api/resume              -> list saved resumes
//   POST   /api/resume              -> upload a new resume
//   DELETE /api/resume?id=<id>      -> remove one resume
//
// This is a route handler rather than a server action because resumes can
// exceed the server action request-size limit.

import { NextResponse } from "next/server";

import {
  loadResumes,
  removeResume,
  uploadResume,
} from "@/lib/resume/resume-api";

import { resumeSessionToken } from "@/lib/resume/resume-session";

import {
  RESUME_ERROR_MESSAGES,
  type ResumeApiResponse,
} from "@/lib/resume/resume-state";

import {
  RESUME_VALIDATION_MESSAGES,
  matchesResumeSignature,
  validateResumeFile,
} from "@/lib/resume/resume-validation";

function json(body: ResumeApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

const unauthenticated = () =>
  json(
    {
      error: RESUME_ERROR_MESSAGES.unauthenticated,
      code: "unauthenticated",
    },
    401
  );

export async function GET() {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return unauthenticated();
  }

  const result = await loadResumes(idToken);

  if (result.ok) {
    return json({ resumes: result.resumes });
  }

  if (result.reason === "unauthenticated") {
    return unauthenticated();
  }

  return json(
    {
      error: RESUME_ERROR_MESSAGES.loadUnavailable,
      code: "unavailable",
    },
    503
  );
}

export async function POST(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return unauthenticated();
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  const check = validateResumeFile(
    file instanceof File ? file : null
  );

  if (!check.ok) {
    return json(
      {
        error: check.message,
        code: check.code,
      },
      check.code === "too_large" ? 413 : 400
    );
  }

  const upload = file as File;
  const bytes = new Uint8Array(await upload.arrayBuffer());

  if (!matchesResumeSignature(bytes, check.extension)) {
    return json(
      {
        error: RESUME_VALIDATION_MESSAGES.unreadable_file,
        code: "unreadable_file",
      },
      400
    );
  }

  const result = await uploadResume(idToken, {
    fileName: upload.name,
    extension: check.extension,
    bytes,
  });

  if (result.ok) {
    return json({ resume: result.resume }, 201);
  }

  if (result.reason === "unauthenticated") {
    return unauthenticated();
  }

  if (result.reason === "invalid") {
    return json(
      {
        error: result.message,
        code: result.code,
      },
      400
    );
  }

  return json(
    {
      error: RESUME_ERROR_MESSAGES.uploadUnavailable,
      code: "unavailable",
    },
    503
  );
}

export async function DELETE(request: Request) {
  const idToken = await resumeSessionToken();

  if (!idToken) {
    return unauthenticated();
  }

  const resumeId = new URL(request.url).searchParams.get("id");

  if (!resumeId) {
    return NextResponse.json(
      {
        error: "Resume id is required.",
        code: "unavailable",
      },
      { status: 400 }
    );
  }

  const result = await removeResume(idToken, resumeId);

  if (result.ok) {
    return json({ success: true });
  }

  if (result.reason === "unauthenticated") {
    return unauthenticated();
  }

  if (result.reason === "not_found") {
    return NextResponse.json(
      {
        error: "Resume not found.",
        code: "unavailable",
      },
      { status: 404 }
    );
  }

  return json(
    {
      error: RESUME_ERROR_MESSAGES.removeUnavailable,
      code: "unavailable",
    },
    503
  );
}
