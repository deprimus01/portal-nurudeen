// Validates that a file's actual bytes match what its extension claims,
// rather than trusting the client-supplied extension or MIME type alone
// (PRD/TRD §8: "server-side, content-sniffed, not just extension"). Phase
// 1 only needs to distinguish three shapes: modern Excel (zip-based),
// legacy Excel (OLE2-based), and CSV (plain text).

const ZIP_SIGNATURE = [0x50, 0x4b]; // "PK" — .xlsx and .docx are both zip archives
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .xls
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function bytesMatch(buffer, signature) {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf'];

export class FileValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

export function getExtension(filename) {
  const match = /\.[^.]+$/.exec(filename || '');
  return match ? match[0].toLowerCase() : '';
}

export function assertValidImportFile(file) {
  if (!file) {
    throw new FileValidationError('No file was uploaded.');
  }

  const ext = getExtension(file.originalname);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new FileValidationError(
      'Unsupported file type. Please upload an Excel (.xlsx, .xls), CSV, Word (.docx), or PDF file.',
    );
  }

  const buffer = file.buffer;

  if (ext === '.xlsx' && !bytesMatch(buffer, ZIP_SIGNATURE)) {
    throw new FileValidationError(
      'This file doesn\u2019t look like a valid .xlsx file. It may be corrupted or mislabeled.',
    );
  }
  if (ext === '.docx' && !bytesMatch(buffer, ZIP_SIGNATURE)) {
    throw new FileValidationError(
      'This file doesn\u2019t look like a valid .docx file. It may be corrupted or mislabeled.',
    );
  }
  if (ext === '.xls' && !bytesMatch(buffer, OLE2_SIGNATURE)) {
    throw new FileValidationError(
      'This file doesn\u2019t look like a valid .xls file. It may be corrupted or mislabeled.',
    );
  }
  if (ext === '.pdf' && !bytesMatch(buffer, PDF_SIGNATURE)) {
    throw new FileValidationError(
      'This file doesn\u2019t look like a valid PDF. It may be corrupted or mislabeled.',
    );
  }
  if (ext === '.csv') {
    // Not a strict signature check (CSV is plain text), but reject files
    // that are clearly binary under a spoofed .csv extension.
    const sample = buffer.subarray(0, Math.min(buffer.length, 2000));
    if (sample.includes(0x00)) {
      throw new FileValidationError(
        'This file doesn\u2019t look like a valid CSV file. It may be corrupted or mislabeled.',
      );
    }
  }

  return ext;
}
