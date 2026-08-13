import mammoth from 'mammoth';
import { FileParseError } from './importErrors.js';

const MAX_ROWS = 1000;

// Very small, dependency-free HTML table parser — mammoth's output for a
// simple data table is predictable enough ( <table><tr><td>...</td></tr>
// </table>, no nesting) that pulling in a full DOM/HTML parser just for
// this would be overkill. Anything genuinely irregular (merged cells,
// nested tables) is exactly the case where we want to fail loudly rather
// than guess — deterministic-only, per PRD/TRD §3/§18.3.
function extractTableRows(html) {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return null;

  const rowMatches = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  if (rowMatches.length === 0) return null;

  return rowMatches.map((rowMatch) =>
    [...rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      cellMatch[1]
        .replace(/<[^>]+>/g, ' ') // strip inline tags (e.g. <p>, <strong>) mammoth may emit inside a cell
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  );
}

// Requires a real HTML <table> in the document — a school register saved
// from Word/Excel as .docx will have one. A DOCX that's just prose (no
// table) is rejected with a clear message rather than an unreliable
// attempt to infer rows from freeform paragraphs; that kind of
// unstructured extraction is explicitly OCR/AI territory (Phase 3/4), not
// Phase 2's deterministic scope.
export async function parseDocxTable(buffer) {
  let html;
  try {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } catch {
    throw new FileParseError(
      'We couldn\u2019t read this Word document. It may be corrupted or in an unsupported format.',
    );
  }

  const tableRows = extractTableRows(html);
  if (!tableRows || tableRows.length === 0) {
    throw new FileParseError(
      'We couldn\u2019t find a table in this document. Please make sure your student list is formatted as a table (like the downloadable template), or upload it as Excel/CSV instead.',
    );
  }

  const headerRowIndex = tableRows.findIndex((row) => row.some((cell) => cell !== ''));
  if (headerRowIndex === -1) {
    throw new FileParseError('The table in this document appears to be empty.');
  }

  const headers = tableRows[headerRowIndex].filter((h) => h !== '');
  if (headers.length === 0) {
    throw new FileParseError('We couldn\u2019t find any column headers in this document\u2019s table.');
  }

  const dataRows = tableRows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => cell !== ''));

  if (dataRows.length === 0) {
    throw new FileParseError('This document\u2019s table has headers but no student rows underneath them.');
  }
  if (dataRows.length > MAX_ROWS) {
    throw new FileParseError(
      `This document has ${dataRows.length} rows, which is over the ${MAX_ROWS}-row limit per import. Please split it into smaller files.`,
    );
  }

  const rows = dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });

  return { headers, rows };
}
