// Upload Resume (Issue #06). Routes:
//   GET    /me/resume       -> the saved resume's details, or null
//   PUT    /me/resume       -> upload (create or replace). Body is the raw file
//                             (Content-Type: application/octet-stream) and the
//                             X-File-Name header is the URI-encoded file name.
//   GET    /me/resume/file  -> the file itself, for viewing or downloading
//   DELETE /me/resume       -> remove the resume
// Dependencies are passed in so the routes can be tested without AWS or a database.
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

// Content-Disposition with a plain ASCII fallback and the full UTF-8 name.
function contentDisposition(type, fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function createResumeRouter({ requireActiveUser, repository, storage, logger = console }) {
  const router = express.Router();

  async function authenticate(req, res) {
    const auth = await requireActiveUser(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return null;
    }
    return auth.user;
  }

  router.get("/me/resume", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const resume = await repository.getResume(user.id);
      return res.status(200).json({ resume: toResponse(resume) });
    } catch (error) {
      logger.error("GET /me/resume failed:", error);
      return res.status(500).json({ error: "Unable to load resume" });
    }
  });

  router.put(
    "/me/resume",
    // Allow a little over the limit so the validator can return a clear message.
    express.raw({ type: "application/octet-stream", limit: MAX_RESUME_BYTES + 1024 }),
    async (req, res) => {
      const user = await authenticate(req, res);
      if (!user) return;

      const validation = validateResumeUpload({
        fileName: decodeFileName(req.get("X-File-Name")),
        buffer: Buffer.isBuffer(req.body) ? req.body : undefined,
      });

      if (!validation.ok) {
        return res.status(validation.code === "too_large" ? 413 : 400).json({
          error: validation.message,
          code: validation.code,
        });
      }

      const { fileName, extension, contentType, sizeBytes } = validation.data;
      const s3Key = `resumes/${user.id}/${crypto.randomUUID()}.${extension}`;

      let previous = null;

      try {
        previous = await repository.getResume(user.id);
        await storage.putResumeObject({ key: s3Key, body: req.body, contentType });
      } catch (error) {
        logger.error("PUT /me/resume upload failed:", error);
        return res.status(502).json({
          error: "Unable to store resume",
          code: "storage_unavailable",
        });
      }

      let saved;

      try {
        saved = await repository.upsertResume({
          userId: user.id,
          s3Key,
          fileName,
          contentType,
          sizeBytes,
        });
      } catch (error) {
        logger.error("PUT /me/resume save failed:", error);
        // Don't leave an orphaned file behind.
        await storage.deleteResumeObject(s3Key).catch(() => {});
        return res.status(500).json({ error: "Unable to save resume" });
      }

      // The new file is saved; clean up the old one.
      if (previous && previous.s3_key !== s3Key) {
        await storage.deleteResumeObject(previous.s3_key).catch((error) => {
          logger.error("Removing previous resume file failed:", error);
        });
      }

      return res.status(200).json({ resume: toResponse(saved) });
    }
  );

  router.get("/me/resume/file", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    let resume;
    let object;

    try {
      resume = await repository.getResume(user.id);

      if (!resume) {
        return res.status(404).json({ error: "No resume uploaded", code: "not_found" });
      }

      object = await storage.getResumeObject(resume.s3_key);
    } catch (error) {
      if (error && (error.name === "NoSuchKey" || error.Code === "NoSuchKey")) {
        return res.status(404).json({ error: "Resume file not found", code: "not_found" });
      }
      logger.error("GET /me/resume/file failed:", error);
      return res.status(502).json({ error: "Unable to load resume file" });
    }

    const disposition = req.query.download === "1" ? "attachment" : "inline";

    res.status(200);
    res.set("Content-Type", object.contentType || resume.content_type);
    if (object.contentLength) res.set("Content-Length", String(object.contentLength));
    res.set("Content-Disposition", contentDisposition(disposition, resume.file_name));
    res.set("Cache-Control", "private, no-store");

    object.body.on("error", (error) => {
      logger.error("Streaming resume file failed:", error);
      res.destroy(error);
    });
    object.body.pipe(res);
  });

  router.delete("/me/resume", async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    let removed;

    try {
      removed = await repository.deleteResume(user.id);
    } catch (error) {
      logger.error("DELETE /me/resume failed:", error);
      return res.status(500).json({ error: "Unable to remove resume" });
    }

    if (removed) {
      await storage.deleteResumeObject(removed.s3_key).catch((error) => {
        logger.error("Removing resume file failed:", error);
      });
    }

    return res.status(204).end();
  });

  // Body too large for express.raw, or a malformed request body.
  // eslint-disable-next-line no-unused-vars
  router.use((error, req, res, next) => {
    if (error && error.type === "entity.too.large") {
      return res.status(413).json({ error: ERRORS.too_large, code: "too_large" });
    }
    logger.error("Resume route error:", error);
    return res.status(400).json({ error: "Invalid request" });
  });

  return router;
}

module.exports = {
  createResumeRouter,
};
