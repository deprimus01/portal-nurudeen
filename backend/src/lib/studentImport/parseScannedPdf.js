import { spawn } from 'child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { FileParseError } from './importErrors.js';
import { createOcrWorker, recognizeWords } from './ocr.js';
import { groupIntoRows, assignToColumnsWithDetails, findHeaderRowIndex, clusterRowIntoCells } from './tableReconstruction.js';

const MAX_ROWS = 1000;
const MAX_PAGES = 20; // PRD/TRD §15

// Rendering a scanned PDF's pages to images for OCR turned out to be the
// hard part of Phase 3. Two npm-based approaches were tried and rejected:
//   - `canvas` (node-canvas): requires native compilation against
//     system Cairo/Pango libraries; its prebuilt-binary release for
//     v2.11.2 returned a 404 for Node 22's ABI (no matching prebuilt
//     binary exists), so it falls back to a from-source build that
//     needs system packages not guaranteed to be present in a deploy
//     environment.
//   - `@napi-rs/canvas`: installs cleanly (prebuilt binary, no
//     compilation), but its Context2D implementation isn't fully
//     compatible with what pdfjs-dist's renderer calls internally —
//     confirmed failing with an "InvalidArg" error from pdf.js's own
//     text-painting code during a real render attempt.
// `pdftoppm` (part of poppler-utils) is used instead: a plain system
// binary, not an npm native module, so there's no node-gyp/ABI
// compatibility question at all. The tradeoff is explicit and worth
// knowing: poppler-utils must be installed in the deploy environment
// (e.g. `apt-get install poppler-utils` in a Render build step or
// Dockerfile). See the ENOENT handling below for what happens if it
// isn't.
function renderPdfPagesToImages(pdfPath, outputPrefix, { firstPage, lastPage } = {}) {
  const args = ['-png', '-r', '200'];
  if (firstPage) args.push('-f', String(firstPage));
  if (lastPage) args.push('-l', String(lastPage));
  args.push(pdfPath, outputPrefix);

  return new Promise((resolve, reject) => {
    const proc = spawn('pdftoppm', args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject); // includes ENOENT when pdftoppm isn't installed
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`pdftoppm exited with code ${code}: ${stderr}`));
      else resolve();
    });
  });
}

// Exported for the visual-verification route (GET
// /:batchId/source?page=N): renders exactly one page of a stored PDF
// on-demand, rather than needing to have pre-rendered and stored every
// page's image separately — keeps the "store the source once" rule
// intact (PRD/TRD architectural requirement) since only the original PDF
// bytes are persisted, not per-page renders.
export async function renderPdfPageToImageBuffer(pdfBuffer, pageNumber) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'pdf-page-render-'));
  try {
    const pdfPath = path.join(workDir, 'input.pdf');
    await writeFile(pdfPath, pdfBuffer);
    const outputPrefix = path.join(workDir, 'page');
    await renderPdfPagesToImages(pdfPath, outputPrefix, { firstPage: pageNumber, lastPage: pageNumber });
    const files = (await readdir(workDir)).filter((f) => f.endsWith('.png'));
    if (files.length === 0) {
      throw new FileParseError('That page could not be rendered.');
    }
    return readFile(path.join(workDir, files[0]));
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function averageConfidence(items) {
  if (items.length === 0) return 0;
  return items.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / items.length;
}

export async function parseScannedPdfTable(buffer) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'scanned-pdf-'));

  try {
    const pdfPath = path.join(workDir, 'input.pdf');
    await writeFile(pdfPath, buffer);

    try {
      await renderPdfPagesToImages(pdfPath, path.join(workDir, 'page'));
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error('pdftoppm not found — poppler-utils is not installed on this server.');
        throw new FileParseError(
          'Scanned PDF processing isn\u2019t available on this server yet. Please upload an image file (JPG/PNG) instead, or ask your developer to enable it.',
        );
      }
      console.error('PDF-to-image rendering failed:', err);
      throw new FileParseError('We couldn\u2019t process this PDF. It may be corrupted or password-protected.');
    }

    const pageFiles = (await readdir(workDir)).filter((f) => f.endsWith('.png')).sort();
    if (pageFiles.length === 0) {
      throw new FileParseError('This PDF has no pages to process.');
    }
    if (pageFiles.length > MAX_PAGES) {
      throw new FileParseError(
        `This PDF has ${pageFiles.length} pages, which is over the ${MAX_PAGES}-page limit per import. Please split it into smaller files.`,
      );
    }

    const worker = await createOcrWorker();
    let headers = null;
    let columnAnchors = null;
    const dataRows = [];
    const rowConfidences = [];
    const cellBoxesByRow = [];
    const pageByRow = [];

    try {
      for (let pageIndex = 0; pageIndex < pageFiles.length; pageIndex++) {
        const pageNumber = pageIndex + 1; // pdftoppm's own numbering is 1-based and matches file sort order here
        const imageBuffer = await readFile(path.join(workDir, pageFiles[pageIndex]));
        const words = await recognizeWords(worker, imageBuffer);
        if (words.length === 0) continue; // blank page — skip, not fatal

        const wordRows = groupIntoRows(words, { ySortDescending: false });
        const rows = wordRows.map((row) => ({ ...row, items: clusterRowIntoCells(row.items) }));

        const pushRow = (row) => {
          const details = assignToColumnsWithDetails(row.items, columnAnchors);
          dataRows.push(details.map((c) => c.text));
          rowConfidences.push(averageConfidence(row.items));
          const boxes = {};
          headers.forEach((header, i) => {
            if (details[i]?.bbox) boxes[header] = { bbox: details[i].bbox, confidence: details[i].confidence };
          });
          cellBoxesByRow.push(boxes);
          pageByRow.push(pageNumber);
        };

        if (!headers) {
          const headerRowIndex = findHeaderRowIndex(rows);
          if (headerRowIndex === -1) continue; // no table found yet — try the next page
          headers = rows[headerRowIndex].items.map((i) => i.text);
          columnAnchors = rows[headerRowIndex].items.map((i) => i.x);
          rows.slice(headerRowIndex + 1).filter((r) => r.items.length > 0).forEach(pushRow);
        } else {
          // A multi-page scan often repeats the header row on every
          // page — skip it rather than importing "header text" as a
          // student row. Column anchors are reused from page 1 rather
          // than re-detected per page, since a school register
          // photographed/scanned page-by-page from the same physical
          // table almost always keeps the same column layout.
          const headerTextLower = headers.join(' ').toLowerCase();
          rows.filter((r) => r.items.length > 0).forEach((row) => {
            const rowTextLower = row.items.map((i) => i.text.toLowerCase()).join(' ');
            if (rowTextLower === headerTextLower) return;
            pushRow(row);
          });
        }
      }
    } finally {
      await worker.terminate();
    }

    if (!headers) {
      throw new FileParseError(
        'We couldn\u2019t find a table in this PDF. Please make sure your student list is laid out in columns with a clear header row.',
      );
    }
    if (dataRows.length === 0) {
      throw new FileParseError('This PDF has a header row but no student rows underneath it.');
    }
    if (dataRows.length > MAX_ROWS) {
      throw new FileParseError(
        `This file has ${dataRows.length} rows, which is over the ${MAX_ROWS}-row limit per import. Please split it into smaller files.`,
      );
    }

    const objectRows = dataRows.map((cells) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = cells[i] !== undefined ? cells[i] : '';
      });
      return obj;
    });

    return { headers, rows: objectRows, rowConfidences, cellBoxesByRow, pageByRow };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
