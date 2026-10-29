// Upload Resume (Issue #06). Checks an uploaded resume before it is stored.
// The frontend has the same rules in
// frontend/src/lib/resume/resume-validation.ts; keep the two in sync.

const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

const FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Error codes the frontend turns into messages.
const ERRORS = {
  missing_file: "Choose a resume file to upload.",
  empty_file: "That file is empty. Choose your resume file.",
  too_large: "That file is larger than 5 MB. Save a smaller version and try again.",
  unsupported_type: "Upload your resume as a PDF or Word (.docx) file.",
  unreadable_file:
    "We couldn't read that file. It may be damaged or not really a PDF or Word file. Try exporting it again.",
};

// Keep only the base name, drop control characters, and cap the length.
function cleanFileName(value) {
  const raw = typeof value === "string" ? value : "";
  const base = raw.split(/[\\/]/).pop() || "";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(-200);
}

function extensionOf(fileName) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

// Check the file's first bytes, not just its name, so a renamed file is caught.
// PDF files start with "%PDF-". DOCX files are zip archives that contain
// "word/document.xml".
function matchesSignature(buffer, extension) {
  if (extension === "pdf") {
    return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  }
  if (extension === "docx") {
    const isZip =
      buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    return isZip && buffer.includes("word/document.xml", 0, "latin1");
  }
  return false;
}

// Returns { ok: true, data } or { ok: false, code, message }.
function validateResumeUpload({ fileName, buffer }) {
  const fail = (code) => ({ ok: false, code, message: ERRORS[code] });

  const name = cleanFileName(fileName);
  if (!name || !Buffer.isBuffer(buffer)) {
    return fail("missing_file");
  }

  const extension = extensionOf(name);
  if (!FILE_TYPES[extension]) {
    return fail("unsupported_type");
  }

  if (buffer.length === 0) {
    return fail("empty_file");
  }

  if (buffer.length > MAX_RESUME_BYTES) {
    return fail("too_large");
  }

  if (!matchesSignature(buffer, extension)) {
    return fail("unreadable_file");
  }

  return {
    ok: true,
    data: {
      fileName: name,
      extension,
      contentType: FILE_TYPES[extension],
      sizeBytes: buffer.length,
    },
  };
}

module.exports = {
  MAX_RESUME_BYTES,
  FILE_TYPES,
  ERRORS,
  cleanFileName,
  validateResumeUpload,
};
