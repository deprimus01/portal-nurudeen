// Duplicate detection, three tiers (PRD/TRD §6.1):
//   1. In-file — same admissionNumber appears twice in the uploaded file.
//   2. Exact DB — admissionNumber already exists in Student.
//   3. Fuzzy DB — close name match + exact date-of-birth match against an
//      existing student, for records that likely refer to the same person
//      under a slightly different spelling.
//
// Fuzzy matching only ever produces a WARNING the user must explicitly
// confirm or skip — it never blocks a row outright the way an exact
// admissionNumber collision does, since it can be a false positive.

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

// Flags in-file duplicate admission numbers. Returns a Set of row indices
// (0-based, matching the order rows were parsed in) that share an
// admissionNumber with at least one other row.
export function findInFileDuplicates(rows) {
  const seen = new Map(); // admissionNumber -> first row index seen
  const duplicateIndices = new Set();

  rows.forEach((row, index) => {
    const admissionNumber = (row.admissionNumber || '').trim();
    if (!admissionNumber) return;

    if (seen.has(admissionNumber)) {
      duplicateIndices.add(seen.get(admissionNumber));
      duplicateIndices.add(index);
    } else {
      seen.set(admissionNumber, index);
    }
  });

  return duplicateIndices;
}

export async function findExactDbDuplicate(prisma, admissionNumber) {
  if (!admissionNumber) return null;
  return prisma.student.findUnique({ where: { admissionNumber } });
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
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, dateOfBirth: true },
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
