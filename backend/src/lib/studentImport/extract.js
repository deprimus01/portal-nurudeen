import { parseSpreadsheet } from './parseExcelCsv.js';
import { parseDocxTable } from './parseDocx.js';
import { parsePdfTextTable } from './parsePdfText.js';
import { FileParseError } from './importErrors.js';

// Single entry point the rest of the pipeline calls — everything
// downstream (fieldDictionary, mapRow, matchClass, matchGuardian,
// duplicateMatcher, rowValidator) only ever sees { headers, rows } and
// has no idea which file format produced it. This is the seam the
// PRD/TRD's phased roadmap depends on: OCR (Phase 3) plugs in here as
// another case, without touching anything after extraction.
export async function extractFile(buffer, ext) {
  switch (ext) {
    case '.xlsx':
    case '.xls':
    case '.csv':
      return parseSpreadsheet(buffer, ext);
    case '.docx':
      return parseDocxTable(buffer);
    case '.pdf':
      return parsePdfTextTable(buffer);
    default:
      throw new FileParseError('This file type isn\u2019t supported yet.');
  }
}

export function sourcePhaseForExt(ext) {
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') return 'excel_csv';
  if (ext === '.docx' || ext === '.pdf') return 'docx_pdf';
  return 'unknown';
}
