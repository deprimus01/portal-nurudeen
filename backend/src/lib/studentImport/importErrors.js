// Thrown by any extractor (Excel/CSV, DOCX, PDF, future OCR) when a file
// can't be turned into rows. The message is always safe to show the user
// as-is — processBatch.js relies on that (see its catch block).
export class FileParseError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}
