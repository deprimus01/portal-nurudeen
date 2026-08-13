// Matches a free-text class column value (e.g. "JSS 1", "Jss1", "Junior
// Secondary 1") against the school's actual Class rows. Deterministic only
// — an unmatched class is left for the user to pick manually in preview,
// never guessed via AI (that's Phase 4, and even then only as a suggestion
// the user confirms).

const LEVEL_WORD_EXPANSIONS = [
  [/\bnursery\b/g, 'nur'],
  [/\bprimary\b/g, 'pri'],
  [/\bjunior\s*secondary\b/g, 'jss'],
  [/\bsenior\s*secondary\b/g, 'sss'],
  [/\bjss\b/g, 'jss'],
  [/\bsss\b/g, 'sss'],
  [/\bbasic\b/g, 'pri'],
];

function normalizeClassName(raw) {
  let text = String(raw || '').trim().toLowerCase();
  for (const [pattern, replacement] of LEVEL_WORD_EXPANSIONS) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/[^a-z0-9]/g, '');
}

// `classes` is the full Class list for the school (small — tens of rows),
// fetched once per batch and passed in rather than queried per row.
export function matchClass(rawClassName, classes) {
  if (!rawClassName) return { class: null, confidence: 'none' };

  const normalizedInput = normalizeClassName(rawClassName);
  if (!normalizedInput) return { class: null, confidence: 'none' };

  const exact = classes.find((c) => normalizeClassName(c.name) === normalizedInput);
  if (exact) return { class: exact, confidence: 'exact' };

  // Loose containment fallback — e.g. input "jss1a" (class + section
  // combined in one column) still resolves to Class "JSS1" even though
  // the section letter doesn't appear in Class.name.
  const contains = classes.find(
    (c) => normalizedInput.includes(normalizeClassName(c.name)) || normalizeClassName(c.name).includes(normalizedInput),
  );
  if (contains) return { class: contains, confidence: 'loose' };

  return { class: null, confidence: 'none' };
}
