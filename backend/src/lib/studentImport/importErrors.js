// Thrown by any extractor (Excel/CSV, DOCX, PDF, OCR) when a file can't
// be turned into rows. The message is always safe to show the user as-is
// — processBatch.js relies on that (see its catch block).
export class FileParseError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

// A specific case of FileParseError: the PDF has no extractable text
// layer at all, meaning it's a scanned/photographed document rather than
// one exported from a spreadsheet or word processor. extract.js catches
// this specifically to fall back to the OCR path (Phase 3) instead of
// just failing outright the way Phase 2 alone would.
export class ScannedPdfError extends FileParseError {}
