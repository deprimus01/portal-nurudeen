import { FileParseError } from './importErrors.js';
import { createOcrWorker, recognizeWords } from './ocr.js';
import { groupIntoRows, assignToColumnsWithDetails, findHeaderRowIndex, clusterRowIntoCells } from './tableReconstruction.js';

const MAX_ROWS = 1000;

export async function parseImageTable(buffer) {
  const worker = await createOcrWorker();
  let words;
  try {
    words = await recognizeWords(worker, buffer);
  } catch (err) {
    console.error('OCR recognition failed:', err);
    throw new FileParseError('We couldn\u2019t read the text in this image. Please make sure it\u2019s clear and try again.');
  } finally {
    await worker.terminate();
  }

  if (words.length === 0) {
    throw new FileParseError(
      'We couldn\u2019t find any readable text in this image. Please make sure it\u2019s clear, well-lit, and not blurry.',
    );
  }

  // Image space has y increasing *downward* (top of image = smallest y)
  // — rows sort top-to-bottom by ascending y, the opposite of PDF space.
  const wordRows = groupIntoRows(words, { ySortDescending: false });
  // OCR tokenizes into individual words — cluster each row into cells
  // (e.g. "Student" + "Name" → one "Student Name" cell) before treating
  // anything as a column boundary. See clusterRowIntoCells's own
  // comment for why this only applies to the OCR path.
  const rows = wordRows.map((row) => ({ ...row, items: clusterRowIntoCells(row.items) }));

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    throw new FileParseError(
      'We couldn\u2019t find a table in this image. Please make sure your student list is laid out in columns with a clear header row.',
    );
  }

  const headerRow = rows[headerRowIndex];
  const columnAnchors = headerRow.items.map((i) => i.x);
  const headers = headerRow.items.map((i) => i.text);

  const dataRowEntries = rows.slice(headerRowIndex + 1).filter((row) => row.items.length > 0);
  // assignToColumnsWithDetails keeps each cell's bounding box and
  // confidence alongside its text — used to build ImportRecord.fieldBoxes
  // for visual verification (PRD/TRD: "preview UI extended to show the
  // source image/region alongside OCR-guessed text"). rowConfidences
  // (row-level average, already used for the mandatory-review WARNING)
  // stays derived the same way as before.
  const dataRowDetails = dataRowEntries.map((row) => assignToColumnsWithDetails(row.items, columnAnchors));
  const dataRows = dataRowDetails.map((cells) => cells.map((c) => c.text));
  const rowConfidences = dataRowEntries.map((row) => averageConfidence(row.items));

  if (dataRows.length === 0) {
    throw new FileParseError('This image has a header row but no student rows underneath it.');
  }
  if (dataRows.length > MAX_ROWS) {
    throw new FileParseError(
      `This image has ${dataRows.length} rows, which is over the ${MAX_ROWS}-row limit per import. Please split it into smaller files.`,
    );
  }

  const objectRows = dataRows.map((cells) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = cells[i] !== undefined ? cells[i] : '';
    });
    return obj;
  });

  // cellBoxesByRow[i][header] = { bbox, confidence } — looked up by
  // processBatch.js once it knows which header maps to which canonical
  // field name, to build fieldBoxes. page is always 1 for a direct image
  // upload (only meaningful for multi-page scanned PDFs).
  const cellBoxesByRow = dataRowDetails.map((cells) => {
    const boxes = {};
    headers.forEach((header, i) => {
      if (cells[i]?.bbox) boxes[header] = { bbox: cells[i].bbox, confidence: cells[i].confidence };
    });
    return boxes;
  });
  const pageByRow = dataRows.map(() => 1);

  return { headers, rows: objectRows, rowConfidences, cellBoxesByRow, pageByRow };
}

function averageConfidence(items) {
  if (items.length === 0) return 0;
  return items.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / items.length;
}
