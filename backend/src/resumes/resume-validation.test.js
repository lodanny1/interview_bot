const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_RESUME_BYTES,
  FILE_TYPES,
  cleanFileName,
  validateResumeUpload,
} = require("./resume-validation");

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
const DOCX = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("....[Content_Types].xml....word/document.xml...."),
]);
const OTHER_ZIP = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("....xl/workbook.xml...."),
]);

describe("validateResumeUpload", () => {
  it("accepts a PDF", () => {
    assert.deepEqual(validateResumeUpload({ fileName: "Resume.PDF", buffer: PDF }), {
      ok: true,
      data: {
        fileName: "Resume.PDF",
        extension: "pdf",
        contentType: FILE_TYPES.pdf,
        sizeBytes: PDF.length,
      },
    });
  });

  it("accepts a Word .docx file", () => {
    const result = validateResumeUpload({ fileName: "resume.docx", buffer: DOCX });
    assert.equal(result.ok, true);
    assert.equal(result.data.contentType, FILE_TYPES.docx);
  });

  it("requires a file", () => {
    assert.equal(validateResumeUpload({ fileName: "", buffer: PDF }).code, "missing_file");
    assert.equal(validateResumeUpload({ fileName: "a.pdf" }).code, "missing_file");
  });

  it("rejects other file types, including old .doc files", () => {
    for (const name of ["resume.doc", "resume.txt", "resume.png", "resume"]) {
      assert.equal(validateResumeUpload({ fileName: name, buffer: PDF }).code, "unsupported_type");
    }
  });

  it("rejects empty and oversized files", () => {
    assert.equal(
      validateResumeUpload({ fileName: "a.pdf", buffer: Buffer.alloc(0) }).code,
      "empty_file"
    );
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_RESUME_BYTES)]);
    assert.equal(validateResumeUpload({ fileName: "a.pdf", buffer: big }).code, "too_large");
  });

  it("rejects a file whose contents don't match its extension", () => {
    assert.equal(
      validateResumeUpload({ fileName: "resume.pdf", buffer: Buffer.from("just text") }).code,
      "unreadable_file"
    );
    assert.equal(validateResumeUpload({ fileName: "resume.docx", buffer: PDF }).code, "unreadable_file");
    assert.equal(
      validateResumeUpload({ fileName: "resume.docx", buffer: OTHER_ZIP }).code,
      "unreadable_file"
    );
  });
});

describe("cleanFileName", () => {
  it("keeps only the base name and strips control characters", () => {
    assert.equal(cleanFileName("C:\\Users\\me\\My Resume.pdf"), "My Resume.pdf");
    assert.equal(cleanFileName("../../etc/resume.pdf"), "resume.pdf");
    assert.equal(cleanFileName("res\u0000ume\n.pdf"), "resume.pdf");
    assert.equal(cleanFileName(undefined), "");
  });
});
