import { createRequire } from 'module';
import path from 'path';
import { createWorker, PSM } from 'tesseract.js';
import { FileParseError } from './importErrors.js';

const require = createRequire(import.meta.url);

// Tesseract.js's default trained-data source is a CDN
// (cdn.jsdelivr.net) fetched at OCR-run time — fragile for a production
// server (an outage or network hiccup would break every OCR import) and
// untestable in a network-restricted environment. @tesseract.js-data/eng
// is the same trained-data file published as an ordinary npm package, so
// it installs locally via `npm install` like any other dependency and
// OCR never needs network access at runtime. Resolved via
// require.resolve rather than a hand-built relative path so this keeps
// working regardless of how the package manager lays out node_modules.
function resolveLangPath() {
  const pkgJsonPath = require.resolve('@tesseract.js-data/eng/package.json');
  return path.join(path.dirname(pkgJsonPath), '4.0.0');
}

// Tesseract's default page-segmentation mode assumes prose-like text and
// can misread a bordered table as a non-text region, silently skipping
// it — confirmed empirically: a real rendered table image OCR'd with the
// default mode returned only a title line above the table (6 words);
// switching to SPARSE_TEXT correctly picked up all 77 words including
// every table cell. SPARSE_TEXT is used for exactly that reason — it
// doesn't assume any particular layout and just finds text wherever it
// is, which suits a scanned register far better than the default.
export async function createOcrWorker() {
  let worker;
  try {
    worker = await createWorker('eng', 1, { langPath: resolveLangPath(), gzip: true });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  } catch (err) {
    console.error('Failed to start OCR worker:', err);
    throw new FileParseError('OCR isn\u2019t available right now. Please try again shortly, or use Excel/CSV instead.');
  }
  return worker;
}

// Recognizes one image (a Buffer of JPEG/PNG bytes, or a PNG file path)
// and returns positioned words in the same shape parsePdfText.js
// produces — { text, x, y, confidence } — so both feed the same shared
// reconstruction logic (tableReconstruction.js). Uses each word's
// top-left corner (bbox.x0/y0) as its position, matching how pdf.js text
// items are anchored.
export async function recognizeWords(worker, imageInput) {
  const { data } = await worker.recognize(imageInput);
  return (data.words || [])
    .filter((w) => w.text && w.text.trim())
    .map((w) => ({
      text: w.text.trim(),
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
      confidence: w.confidence, // 0–100, from Tesseract directly
    }));
}
