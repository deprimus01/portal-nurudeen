// Shared by parsePdfText.js (Phase 2) and ocr.js (Phase 3): both produce
// a flat list of positioned text items — { text, x, y, confidence? } —
// from very different sources (pdf.js text runs vs. Tesseract word
// boxes), but the problem of turning "text scattered at x/y coordinates"
// into "rows and columns" is identical either way. One implementation
// here means a fix or improvement to the reconstruction algorithm
// benefits both extractors at once, and the two can never silently drift
// apart in behavior.

const ROW_Y_TOLERANCE = 6; // a little looser than Phase 2's PDF-only 3px — OCR word boxes jitter more

// `ySortDescending` matters because coordinate spaces differ: PDF space
// has y increasing *upward* (top of page = highest y), so rows sort by
// descending y to read top-to-bottom. Image/OCR space has y increasing
// *downward* (top of image = y0), so rows sort by ascending y instead.
export function groupIntoRows(items, { ySortDescending }) {
  const sorted = [...items].sort((a, b) => (ySortDescending ? b.y - a.y : a.y - b.y) || a.x - b.x);
  const rows = [];

  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= ROW_Y_TOLERANCE);
    if (row) {
      row.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows.map((r) => ({ ...r, items: r.items.sort((a, b) => a.x - b.x) }));
}

// Assigns each item in a row to the header column whose anchor x is
// closest, then joins same-column items (in left-to-right order) with a
// space — reassembles a cell whose text arrived as multiple runs/words.
export function assignToColumns(rowItems, columnAnchors) {
  const cells = columnAnchors.map(() => []);
  for (const item of rowItems) {
    let closestIndex = 0;
    let closestDistance = Infinity;
    columnAnchors.forEach((anchorX, i) => {
      const distance = Math.abs(item.x - anchorX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    });
    cells[closestIndex].push(item);
  }
  return cells.map((cellItems) => cellItems.map((i) => i.text).join(' ').trim());
}

// A plain paragraph/title line above a table is usually a single
// positioned item, but not always — e.g. a title split by a dash can
// accidentally cluster into 2+ "cells" too (confirmed: "Nuruddeen
// Schools — JSS Register 2026" clustered into exactly 2 cells around the
// dash and was wrongly picked as the header row by a naive ">=2 items"
// check). A real table's header row and every data row underneath it
// share the same column count, while a stray title line won't — so
// instead of just checking for >=2 items, this finds the most common
// item-count across all rows (the table's real column count) and
// returns the first row matching it.
export function findHeaderRowIndex(rows) {
  const frequency = new Map();
  for (const row of rows) {
    const count = row.items.length;
    if (count < 2) continue;
    frequency.set(count, (frequency.get(count) || 0) + 1);
  }
  if (frequency.size === 0) return -1;

  let modeCount = 0;
  let modeFrequency = 0;
  for (const [count, freq] of frequency) {
    if (freq > modeFrequency) {
      modeFrequency = freq;
      modeCount = count;
    }
  }

  return rows.findIndex((r) => r.items.length === modeCount);
}

// OCR (Phase 3) tokenizes text into individual words, unlike pdf.js text
// runs which are usually already one-per-cell — confirmed empirically: a
// two-word header "Student Name" OCR'd as two separate word-items with a
// small gap between them, and without this step they'd be wrongly
// treated as two separate columns. Adjacent words in a row are merged
// into one cell when the gap between them is small relative to the
// row's own text height — a threshold that scales with the text size
// actually detected, rather than a fixed pixel value that would only
// suit one specific image resolution. Genuine column boundaries have
// much larger gaps than inter-word spacing within a cell, so this
// reliably tells the two apart in practice.
//
// Only used by the OCR extractors (parseImageTable.js,
// parseScannedPdf.js) — deliberately not applied to parsePdfText.js's
// already-verified-working Phase 2 behavior, since pdf.js text runs
// don't have the same word-splitting problem and retrofitting this
// there risks merging genuinely separate, tightly-laid-out cells.
export function clusterRowIntoCells(rowItems) {
  if (rowItems.length === 0) return [];
  const sorted = [...rowItems].sort((a, b) => a.x - b.x);

  const heights = sorted.map((i) => i.height).filter((h) => h > 0).sort((a, b) => a - b);
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 20;
  const gapThreshold = medianHeight * 1.2;

  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevRightEdge = prev.x + (prev.width || 0);
    const gap = curr.x - prevRightEdge;
    if (gap > gapThreshold) {
      clusters.push([curr]);
    } else {
      clusters[clusters.length - 1].push(curr);
    }
  }

  return clusters.map((cluster) => {
    const minX = Math.min(...cluster.map((i) => i.x));
    const minY = Math.min(...cluster.map((i) => i.y));
    const maxX = Math.max(...cluster.map((i) => i.x + (i.width || 0)));
    const maxY = Math.max(...cluster.map((i) => i.y + (i.height || 0)));
    return {
      text: cluster.map((i) => i.text).join(' ').trim(),
      x: cluster[0].x, // left edge of the cell — used as its column anchor
      confidence: cluster.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / cluster.length,
      bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    };
  });
}

// Visual-verification variant of assignToColumns: instead of collapsing
// a column's items down to a plain joined string, this keeps the
// bounding box (union of every item merged into that cell) and average
// confidence alongside the text. Used only where the caller intends to
// persist per-field source-image coordinates (processBatch.js, when the
// batch came from OCR) — assignToColumns itself is untouched so Phase
// 1/2's already-verified plain-text callers are unaffected.
export function assignToColumnsWithDetails(rowItems, columnAnchors) {
  const cells = columnAnchors.map(() => []);
  for (const item of rowItems) {
    let closestIndex = 0;
    let closestDistance = Infinity;
    columnAnchors.forEach((anchorX, i) => {
      const distance = Math.abs(item.x - anchorX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    });
    cells[closestIndex].push(item);
  }
  return cells.map((cellItems) => {
    if (cellItems.length === 0) {
      return { text: '', bbox: null, confidence: 0 };
    }
    const text = cellItems.map((i) => i.text).join(' ').trim();
    const confidence = cellItems.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / cellItems.length;
    // Cell items here are already-clustered "cells" from
    // clusterRowIntoCells (each carrying its own bbox), or raw
    // positioned items — support both by falling back to x/y/width/height
    // directly when a cell-level bbox isn't already present.
    const boxed = cellItems.map((i) => i.bbox || { x: i.x, y: i.y, width: i.width || 0, height: i.height || 0 });
    const minX = Math.min(...boxed.map((b) => b.x));
    const minY = Math.min(...boxed.map((b) => b.y));
    const maxX = Math.max(...boxed.map((b) => b.x + b.width));
    const maxY = Math.max(...boxed.map((b) => b.y + b.height));
    return { text, confidence, bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
  });
}
