// This school identifies students by name + class only (no admission/
// serial numbers — see lib/createStudent.js and studentLogin.js for the
// related decisions). Two students can legitimately share a name within
// the same class, which needs *some* way to tell them apart in rosters,
// report cards, and search results.
//
// Decision: tag only on an actual collision, ordered by enrollment order
// (admissionNumber ascending, since it's auto-assigned sequentially at
// creation - see nextAdmissionNumber() in createStudent.js). The
// first-enrolled student of a colliding name is shown plain; each
// subsequent one gets a small suffix: "John Doe", "John Doe · 2", "John
// Doe · 3". Non-colliding names are never decorated.
//
// Rejected: always showing date of birth. dateOfBirth is optional on
// Student and isn't even collected by the Import template (this school
// doesn't gather it at enrollment) — most rows would show nothing useful.

function normalizedName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Takes a roster (array of objects with at least firstName, lastName,
 * currentClassId or classId, and admissionNumber) and returns a Map from
 * a stable row key (studentId, or array index if no id) to the display
 * suffix — '' for no collision, ' · 2' / ' · 3' / etc. otherwise.
 *
 * Scoped per class: pass a roster that's already limited to one class
 * (the normal case — a single attendance/results roster, or one term's
 * worth of a report card) OR include a class-identifying field per
 * student so cross-class rows in the same array (e.g. a school-wide
 * search result list) aren't accidentally tagged against each other.
 */
export function buildNameDisambiguationTags(students, { classKeyOf = () => '__single_class__' } = {}) {
  const groups = new Map(); // `${classKey}::${name}` -> students, in enrollment order

  for (const s of students) {
    const name = normalizedName(s.firstName, s.lastName);
    if (!name) continue;
    const key = `${classKeyOf(s)}::${name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const tags = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue; // no collision — leave untagged
    const sorted = [...group].sort((a, b) => {
      const na = parseInt(a.admissionNumber, 10);
      const nb = parseInt(b.admissionNumber, 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return 0;
    });
    sorted.forEach((s, i) => {
      if (i === 0) return; // first-enrolled stays plain
      const rowKey = s.id ?? s.studentId ?? s;
      tags.set(rowKey, ` · ${i + 1}`);
    });
  }
  return tags;
}

/** Convenience wrapper: returns "First Last" or "First Last · 2". */
export function displayNameWithTag(student, tag) {
  return `${student.firstName} ${student.lastName}${tag || ''}`;
}
