// Row-level validation for the import preview. Deliberately not a single
// Zod .parse() call the way createStudentSchema is for the manual route —
// an import row needs every problem surfaced at once (a spreadsheet row
// can be wrong in three ways simultaneously), not just the first one, so
// the user can fix them together in preview instead of one submit-and-fail
// cycle per row. The underlying rules are the same ones createStudentSchema
// enforces; commit time still re-runs the real Zod schema as the final,
// authoritative check (PRD/TRD §7).

const MIN_AGE_YEARS = 2;
const MAX_AGE_YEARS = 22;

// mappedData.dateOfBirth arrives as a real Date object when called from
// processBatch.js (fresh from the extractor/normalizer, pre-serialization)
// but as an ISO string when called from the PATCH /records/:id correction
// route (rehydrated from ImportRecord.mappedData, a JSON column — JSON has
// no Date type). This normalizer makes the validator work correctly from
// either call site instead of assuming one shape and crashing on the other
// — that mismatch was the root cause of corrections failing with a
// generic 500 on any row that already had a date of birth set.
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageInYears(dateOfBirth) {
  const diffMs = Date.now() - dateOfBirth.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

// `mappedData` shape:
// { firstName, lastName, otherNames, dateOfBirth (Date|ISO string|null),
//   gender, classInput, matchedClass (object) or matchedClassId (string), guardianFirstName,
//   guardianLastName, guardianPhone, guardianEmail, guardianRelationship, matchedGuardianId }
export function validateMappedRow(mappedData) {
  const issues = [];

  if (!mappedData.firstName) {
    issues.push({ field: 'firstName', severity: 'error', message: 'First name is required.' });
  } else if (mappedData.firstName.length > 60) {
    issues.push({ field: 'firstName', severity: 'error', message: 'First name is too long (max 60 characters).' });
  }

  if (!mappedData.lastName) {
    issues.push({ field: 'lastName', severity: 'error', message: 'Last name is required — check if the name column needs splitting.' });
  } else if (mappedData.lastName.length > 60) {
    issues.push({ field: 'lastName', severity: 'error', message: 'Last name is too long (max 60 characters).' });
  }

  const dateOfBirth = toDate(mappedData.dateOfBirth);
  // Date of birth is optional — this school doesn't collect it at
  // enrollment. If a file happens to include a DOB column it's still
  // parsed and used for fuzzy duplicate matching, but its absence is
  // never an error, and an unparseable value is a soft warning (not a
  // blocker) rather than forcing every row through manual correction.
  if (mappedData.dateOfBirth && !dateOfBirth) {
    issues.push({ field: 'dateOfBirth', severity: 'warning', message: 'Date of birth couldn\u2019t be read and will be left blank.' });
  } else if (dateOfBirth) {
    const age = ageInYears(dateOfBirth);
    if (age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) {
      issues.push({ field: 'dateOfBirth', severity: 'warning', message: 'Date of birth looks unusual \u2014 double-check it, or leave it blank.' });
    }
  }

  if (!mappedData.gender) {
    issues.push({ field: 'gender', severity: 'error', message: 'Gender must be Male or Female.' });
  }

  // matchedClass is a full object when called from processBatch.js
  // (pre-serialization); matchedClassId is the string id used in the
  // persisted/PATCH-rehydrated shape. Either indicates a resolved match.
  const classMatched = mappedData.matchedClass || mappedData.matchedClassId;
  if (!mappedData.classInput) {
    issues.push({ field: 'className', severity: 'warning', message: 'No class provided — select one before importing.' });
  } else if (!classMatched) {
    issues.push({ field: 'className', severity: 'error', message: `"${mappedData.classInput}" doesn\u2019t match any existing class. Please select the correct class.` });
  }

  // This school doesn't collect guardian info at enrollment, so its
  // absence is expected and never flagged. If a file happens to include
  // guardian columns anyway, that data is still validated and used —
  // just never required.
  const hasAnyGuardianInput =
    mappedData.guardianFirstName || mappedData.guardianLastName || mappedData.guardianPhone || mappedData.guardianEmail || mappedData.matchedGuardianId;

  if (hasAnyGuardianInput && !mappedData.matchedGuardianId) {
    // Creating a new guardian inline — same requirement as the manual form.
    if (!mappedData.guardianFirstName || !mappedData.guardianLastName || !mappedData.guardianPhone) {
      issues.push({
        field: 'guardian',
        severity: 'error',
        message: 'A new guardian needs a first name, last name, and phone number.',
      });
    }
    if (mappedData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mappedData.guardianEmail)) {
      issues.push({ field: 'guardianEmail', severity: 'warning', message: 'Guardian email doesn\u2019t look valid and will be ignored.' });
    }
  }

  const hasError = issues.some((i) => i.severity === 'error');
  const hasWarning = issues.some((i) => i.severity === 'warning');
  const status = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'OK';

  return { status, issues };
}
