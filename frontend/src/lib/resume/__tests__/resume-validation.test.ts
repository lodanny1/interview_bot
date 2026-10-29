import { describe, expect, it } from "vitest";
import {
  MAX_RESUME_BYTES,
  RESUME_VALIDATION_MESSAGES as MSG,
  fileTypeLabel,
  formatFileSize,
  matchesResumeSignature,
  validateResumeFile,
} from "@/lib/resume/resume-validation";

const bytes = (text: string, prefix: number[] = []) =>
  new Uint8Array([...prefix, ...new TextEncoder().encode(text)]);

describe("validateResumeFile", () => {
  it("accepts PDF and Word .docx files of any letter case", () => {
    expect(validateResumeFile({ name: "Resume.PDF", size: 1000 })).toEqual({
      ok: true,
      extension: "pdf",
    });
    expect(validateResumeFile({ name: "resume.docx", size: 1000 })).toEqual({
      ok: true,
      extension: "docx",
    });
  });

  it("requires a file", () => {
    expect(validateResumeFile(null)).toEqual({
      ok: false,
      code: "missing_file",
      message: MSG.missing_file,
    });
  });

  it("rejects other file types, including old .doc files (Scenario 3)", () => {
    for (const name of ["resume.doc", "resume.txt", "photo.png", "resume"]) {
      expect(validateResumeFile({ name, size: 1000 })).toMatchObject({ code: "unsupported_type" });
    }
  });

  it("rejects empty files and files over 5 MB", () => {
    expect(validateResumeFile({ name: "a.pdf", size: 0 })).toMatchObject({ code: "empty_file" });
    expect(validateResumeFile({ name: "a.pdf", size: MAX_RESUME_BYTES })).toMatchObject({ ok: true });
    expect(validateResumeFile({ name: "a.pdf", size: MAX_RESUME_BYTES + 1 })).toMatchObject({
      code: "too_large",
      message: MSG.too_large,
    });
  });
});

describe("matchesResumeSignature", () => {
  it("recognizes real PDF and DOCX contents", () => {
    expect(matchesResumeSignature(bytes("%PDF-1.7 ..."), "pdf")).toBe(true);
    expect(
      matchesResumeSignature(bytes("..word/document.xml..", [0x50, 0x4b, 0x03, 0x04]), "docx")
    ).toBe(true);
  });

  it("catches renamed files", () => {
    expect(matchesResumeSignature(bytes("plain text"), "pdf")).toBe(false);
    expect(matchesResumeSignature(bytes("%PDF-1.7"), "docx")).toBe(false);
    // A zip that isn't a Word document, like a renamed spreadsheet.
    expect(
      matchesResumeSignature(bytes("..xl/workbook.xml..", [0x50, 0x4b, 0x03, 0x04]), "docx")
    ).toBe(false);
  });
});

describe("display helpers", () => {
  it("formats file sizes", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(240 * 1024)).toBe("240 KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("labels file types", () => {
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
    expect(
      fileTypeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).toBe("Word document");
  });
});
