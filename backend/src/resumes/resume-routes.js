// Upload Resume (Issue #06).
//
// A user may own zero-to-many resumes.
//
// Routes:
//   GET    /me/resumes                  -> list saved resumes
//   POST   /me/resumes                  -> upload a new resume
//   GET    /me/resumes/:resumeId/file   -> view/download one resume
//   DELETE /me/resumes/:resumeId        -> delete one resume
//
// Dependencies are injected so these routes can be tested without AWS
// or a live database.

const crypto = require("crypto");
const express = require("express");

const {
  MAX_RESUME_BYTES,
  ERRORS,
  validateResumeUpload,
} = require("./resume-validation");

function toResponse(row) {
  return row
    ? {
        id: row.id,
        fileName: row.file_name,
        contentType: row.content_type,
        sizeBytes: Number(row.size_bytes),
        uploadedAt: row.uploaded_at,
      }
    : null;
}

function decodeFileName(header) {
  if (typeof header !== "string") return "";

  try {
    return decodeURIComponent(header);
  } catch {
    return "";
  }
}

// Content-Disposition with an ASCII fallback and full UTF-8 filename.
function contentDisposition(type, fileName) {
  const ascii = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");

  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    fileName
  )}`;
}

function createResumeRouter({
  requireActiveUser,
  repository,
  storage,
  logger = console,
}) {
  const router = express.Router();

  async function authenticate(req, res) {
    const auth = await requireActiveUser(req);

    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return null;
    }

    return auth.user;
  }

  // List every resume owned by the authenticated user.
  router.get("/me/resumes", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const resumes = await repository.getResumes(user.id);

      return res.status(200).json({
        resumes: resumes.map(toResponse),
      });
    } catch (error) {
      logger.error("GET /me/resumes failed:", error);

      return res.status(500).json({
        error: "Unable to load resumes",
      });
    }
  });

  // Upload a new resume. Existing resumes are not replaced.
  router.post(
    "/me/resumes",

    // Allow slightly more than the configured limit so validation
    // can return a useful application-level error.
    express.raw({
      type: "application/octet-stream",
      limit: MAX_RESUME_BYTES + 1024,
    }),

    async (req, res) => {
      const user = await authenticate(req, res);
      if (!user) return;

      const validation = validateResumeUpload({
        fileName: decodeFileName(req.get("X-File-Name")),
        buffer: Buffer.isBuffer(req.body) ? req.body : undefined,
      });

      if (!validation.ok) {
        return res
          .status(validation.code === "too_large" ? 413 : 400)
          .json({
            error: validation.message,
            code: validation.code,
          });
      }

      const {
        fileName,
        extension,
        contentType,
        sizeBytes,
      } = validation.data;

      // Each uploaded resume receives its own S3 object.
      const s3Key =
        `resumes/${user.id}/${crypto.randomUUID()}.${extension}`;

      try {
        await storage.putResumeObject({
          key: s3Key,
          body: req.body,
          contentType,
        });
      } catch (error) {
        logger.error("POST /me/resumes storage upload failed:", error);

        return res.status(502).json({
          error: "Unable to store resume",
          code: "storage_unavailable",
        });
      }

      let saved;

      try {
        saved = await repository.createResume({
          userId: user.id,
          s3Key,
          fileName,
          contentType,
          sizeBytes,
        });
      } catch (error) {
        logger.error("POST /me/resumes database save failed:", error);

        // If the DB insert fails, remove the S3 object so we don't
        // leave an orphaned file behind.
        await storage.deleteResumeObject(s3Key).catch(() => {});

        return res.status(500).json({
          error: "Unable to save resume",
        });
      }

      return res.status(201).json({
        resume: toResponse(saved),
      });
    }
  );

  // View or download one resume.
  router.get("/me/resumes/:resumeId/file", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const { resumeId } = req.params;

    let resume;
    let object;

    try {
      // userId is included so a user cannot access another user's resume.
      resume = await repository.getResume(user.id, resumeId);

      if (!resume) {
        return res.status(404).json({
          error: "Resume not found",
          code: "not_found",
        });
      }

      object = await storage.getResumeObject(resume.s3_key);
    } catch (error) {
      if (
        error &&
        (error.name === "NoSuchKey" || error.Code === "NoSuchKey")
      ) {
        return res.status(404).json({
          error: "Resume file not found",
          code: "not_found",
        });
      }

      logger.error(
        "GET /me/resumes/:resumeId/file failed:",
        error
      );

      return res.status(502).json({
        error: "Unable to load resume file",
      });
    }

    const disposition =
      req.query.download === "1" ? "attachment" : "inline";

    res.status(200);
    res.set(
      "Content-Type",
      object.contentType || resume.content_type
    );

    if (object.contentLength) {
      res.set("Content-Length", String(object.contentLength));
    }

    res.set(
      "Content-Disposition",
      contentDisposition(disposition, resume.file_name)
    );

    res.set("Cache-Control", "private, no-store");

    object.body.on("error", (error) => {
      logger.error("Streaming resume file failed:", error);
      res.destroy(error);
    });

    object.body.pipe(res);
  });

  // Delete one resume owned by the authenticated user.
  router.delete("/me/resumes/:resumeId", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const { resumeId } = req.params;

    let removed;

    try {
      removed = await repository.deleteResume(user.id, resumeId);
    } catch (error) {
      logger.error(
        "DELETE /me/resumes/:resumeId failed:",
        error
      );

      return res.status(500).json({
        error: "Unable to remove resume",
      });
    }

    if (!removed) {
      return res.status(404).json({
        error: "Resume not found",
        code: "not_found",
      });
    }

    await storage
      .deleteResumeObject(removed.s3_key)
      .catch((error) => {
        logger.error("Removing resume file failed:", error);
      });

    return res.status(204).end();
  });

  // Handle oversized or malformed request bodies.
  // eslint-disable-next-line no-unused-vars
  router.use((error, req, res, next) => {
    if (error && error.type === "entity.too.large") {
      return res.status(413).json({
        error: ERRORS.too_large,
        code: "too_large",
      });
    }

    logger.error("Resume route error:", error);

    return res.status(400).json({
      error: "Invalid request",
    });
  });

  return router;
}

module.exports = {
  createResumeRouter,
};
