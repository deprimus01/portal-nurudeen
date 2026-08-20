// Duplicate detection (PRD/TRD §6.1), revised for a school with no
// admission/serial numbers:
//   1. In-file — same name appears twice within the *same class* in the
//      uploaded file.
//   2. Exact DB — a student with that exact name already exists in that
//      same class.
//   3. Fuzzy DB — close name match + exact date-of-birth match against an
//      existing student, for records that likely refer to the same person
//      under a slightly different spelling.
//
// Crucially, none of these tiers can be a hard, guaranteed identity match
// anymore the way an admission-number collision was — two genuinely
// different students legitimately sharing a name in the same class is
// normal, expected data for this school, not an error. All three tiers
// therefore only ever produce a WARNING the importer must explicitly
// confirm or skip, never an automatic block.

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function normalizedName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Flags in-file duplicate names *within the same class*. Rows targeting
// different classes are never considered duplicates of each other even if
// they share a name. `classKey` should be the matched class id when
// resolved, falling back to the normalized raw class text when it isn't
// (so an unmatched-class row still gets meaningful in-file dedup against
// other rows naming the same unmatched class text, rather than silently
// skipping the check).
export function findInFileDuplicates(rows) {
  const seen = new Map(); // `${classKey}::${name}` -> first row index seen
  const duplicateIndices = new Set();

  rows.forEach((row, index) => {
    const name = normalizedName(row.firstName, row.lastName);
    if (!name) return;

    const classKey = row.matchedClassId || (row.classInput || '').trim().toLowerCase();
    if (!classKey) return; // no class info at all — nothing meaningful to scope against

    const key = `${classKey}::${name}`;
    if (seen.has(key)) {
      duplicateIndices.add(seen.get(key));
      duplicateIndices.add(index);
    } else {
      seen.set(key, index);
    }
  });

  return duplicateIndices;
}

// Exact (case-insensitive) name match within the same class — the closest
// equivalent to the old admission-number exact-duplicate tier, but
// necessarily a softer signal now: same name in the same class is
// plausible real data, not proof of a duplicate.
export async function findExactDbDuplicate(prisma, firstName, lastName, classId) {
  if (!firstName || !lastName || !classId) return null;
  const candidates = await prisma.student.findMany({
    where: { currentClassId: classId },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
  });
  const target = normalizedName(firstName, lastName);
  return candidates.find((c) => normalizedName(c.firstName, c.lastName) === target) || null;
}

// Sanity-bounded: only pulls students who share the same date of birth
// (a real, if imperfect, gate) before running the more expensive name
// comparison, since a school's Student table stays small enough for this
// to be cheap either way but there's no reason to compare against
// students born on a different day.
export async function findFuzzyDbDuplicate(prisma, { firstName, lastName, dateOfBirth }) {
  if (!dateOfBirth) return null;

  const candidates = await prisma.student.findMany({
    where: { dateOfBirth },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
  });

  const target = normalizedName(firstName, lastName);
  if (!target) return null;

  for (const candidate of candidates) {
    const candidateName = normalizedName(candidate.firstName, candidate.lastName);
    const distance = levenshtein(target, candidateName);
    // Distance threshold scales lightly with name length so short names
    // aren't over-matched and long names still catch typos.
    const threshold = Math.max(2, Math.round(target.length * 0.15));
    if (distance <= threshold) return candidate;
  }

  return null;
}
