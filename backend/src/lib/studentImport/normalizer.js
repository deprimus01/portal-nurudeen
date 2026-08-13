// Deterministic normalization of raw cell values into the shapes
// createStudentSchema/createGuardianSchema expect. Nothing here calls out
// to AI — Phase 1 is fully deterministic (PRD/TRD §18.2).

const GENDER_MAP = {
  m: 'MALE',
  male: 'MALE',
  boy: 'MALE',
  f: 'FEMALE',
  female: 'FEMALE',
  girl: 'FEMALE',
};

export function normalizeGender(raw) {
  if (raw === null || raw === undefined) return null;
  const key = String(raw).trim().toLowerCase();
  return GENDER_MAP[key] || null;
}

// Excel stores dates as a serial day-count from 1899-12-30 when a cell is
// formatted as a date; SheetJS gives us that raw number when the parser
// isn't told to convert it. Handled here so "just paste your register into
// Excel" files work without the user reformatting date columns first.
function fromExcelSerial(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 86400000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Accepts ISO (yyyy-mm-dd), Excel serials, and day/month/year text with
// '/', '-', or '.' separators — day-first, since that's the convention in
// Nigerian school records (matches the rest of this app's date handling).
// Deliberately does NOT guess month-first for ambiguous values like
// "03/04/2015" — day-first is applied consistently, and a resulting date
// that fails a basic sanity check (see validator.js) surfaces as a
// per-row error the user corrects in preview rather than a silent
// misparse.
export function normalizeDateOfBirth(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

  if (typeof raw === 'number') return fromExcelSerial(raw);

  const text = String(raw).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmyMatch = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    if (y.length === 2) y = Number(y) < 50 ? `20${y}` : `19${y}`;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function titleCase(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Splits "Ahmad Bello Musa" → { firstName: "Ahmad", lastName: "Musa",
// otherNames: "Bello" }. Two-word names have no otherNames. A single word
// can't be split safely — returned as firstName only, with lastName left
// empty so it fails validation and gets flagged in preview rather than
// guessed.
export function splitFullName(raw) {
  const parts = String(raw || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '', otherNames: '' };
  if (parts.length === 1) return { firstName: titleCase(parts[0]), lastName: '', otherNames: '' };
  if (parts.length === 2) return { firstName: titleCase(parts[0]), lastName: titleCase(parts[1]), otherNames: '' };
  return {
    firstName: titleCase(parts[0]),
    lastName: titleCase(parts[parts.length - 1]),
    otherNames: titleCase(parts.slice(1, -1).join(' ')),
  };
}

export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  // Keep a leading + if present, strip everything else non-numeric.
  const text = String(raw).trim();
  const plus = text.startsWith('+') ? '+' : '';
  return plus + text.replace(/[^0-9]/g, '');
}

export function normalizeEmail(raw) {
  const text = String(raw || '').trim().toLowerCase();
  return text || undefined;
}

export function cleanText(raw, { titleCased = false } = {}) {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return titleCased ? titleCase(text) : text;
}
