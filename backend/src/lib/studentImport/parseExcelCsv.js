import * as XLSX from 'xlsx';
import { FileParseError } from './importErrors.js';

export { FileParseError } from './importErrors.js';

// Phase 1 extractor: deterministic parsing only, no OCR/AI (PRD/TRD §3,
// §18.2). Later phases (DOCX/PDF/OCR) plug in additional extractors that
// produce this exact same shape — { headers, rows } — so nothing
// downstream of extraction needs to change as new formats are added
// (PRD/TRD's explicit architectural requirement).

const MAX_ROWS = 1000;

export function parseSpreadsheet(buffer, fileExt) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: true });
  } catch {
    throw new FileParseError(
      'We couldn\u2019t read this file. Please make sure it\u2019s a valid Excel or CSV file and try again.',
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new FileParseError('This file doesn\u2019t contain any sheets to import.');
  }
  const sheet = workbook.Sheets[sheetName];

  const rowsAsArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  if (rowsAsArrays.length === 0) {
    throw new FileParseError('This file appears to be empty.');
  }

  // First non-empty row is treated as the header row.
  const headerRowIndex = rowsAsArrays.findIndex((r) => r.some((cell) => String(cell).trim() !== ''));
  if (headerRowIndex === -1) {
    throw new FileParseError('This file appears to be empty.');
  }

  const headers = rowsAsArrays[headerRowIndex].map((h) => String(h).trim()).filter((h) => h !== '');
  if (headers.length === 0) {
    throw new FileParseError('We couldn\u2019t find any column headers in this file.');
  }

  const dataRows = rowsAsArrays
    .slice(headerRowIndex + 1)
    .filter((r) => r.some((cell) => String(cell).trim() !== ''));

  if (dataRows.length === 0) {
    throw new FileParseError('This file has headers but no student rows underneath them.');
  }

  if (dataRows.length > MAX_ROWS) {
    throw new FileParseError(
      `This file has ${dataRows.length} rows, which is over the ${MAX_ROWS}-row limit per import. Please split it into smaller files.`,
    );
  }

  const rows = dataRows.map((r) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = r[i] !== undefined ? r[i] : '';
    });
    return obj;
  });

  return { headers, rows };
}
