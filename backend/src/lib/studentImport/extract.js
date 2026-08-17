import { parseSpreadsheet } from './parseExcelCsv.js';
import { parseDocxTable } from './parseDocx.js';
import { parsePdfTextTable } from './parsePdfText.js';
import { parseImageTable } from './parseImageTable.js';
import { parseScannedPdfTable } from './parseScannedPdf.js';
import { FileParseError, ScannedPdfError } from './importErrors.js';

// Single entry point the rest of the pipeline calls — everything
// downstream (fieldDictionary, mapRow, matchClass, matchGuardian,
// duplicateMatcher, rowValidator) only ever sees { headers, rows } and
// has no idea which file format produced it. Every branch returns the
// same shape: { headers, rows, usedOcr, rowConfidences, cellBoxesByRow,
// pageByRow }. The last three are only meaningful when usedOcr is true —
// processBatch.js uses rowConfidences to force every row in an
// OCR-derived batch to at least WARNING status (PRD/TRD: "low-confidence
// rows never auto-pass"), and cellBoxesByRow/pageByRow to build each
// ImportRecord's fieldBoxes for visual source verification.
export async function extractFile(buffer, ext) {
  switch (ext) {
    case '.xlsx':
    case '.xls':
    case '.csv': {
      const result = parseSpreadsheet(buffer, ext);
      return { ...result, usedOcr: false, rowConfidences: undefined };
    }
    case '.docx': {
      const result = await parseDocxTable(buffer);
      return { ...result, usedOcr: false, rowConfidences: undefined };
    }
    case '.pdf': {
      try {
        const result = await parsePdfTextTable(buffer);
        return { ...result, usedOcr: false, rowConfidences: undefined };
      } catch (err) {
        if (!(err instanceof ScannedPdfError)) throw err;
        // No text layer — this is a scanned/photographed PDF. Fall back
        // to OCR (Phase 3) rather than failing outright, the way Phase 2
        // alone had to.
        const result = await parseScannedPdfTable(buffer);
        return { ...result, usedOcr: true };
      }
    }
    case '.jpg':
    case '.jpeg':
    case '.png': {
      const result = await parseImageTable(buffer);
      return { ...result, usedOcr: true };
    }
    default:
      throw new FileParseError('This file type isn\u2019t supported yet.');
  }
}

export function sourcePhaseForExt(ext) {
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') return 'excel_csv';
  if (ext === '.docx' || ext === '.pdf') return 'docx_pdf'; // .pdf may still resolve to OCR at runtime — processBatch.js corrects this after extraction if so
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return 'ocr';
  return 'unknown';
}
