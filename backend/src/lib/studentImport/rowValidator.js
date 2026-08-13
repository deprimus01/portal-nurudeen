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

function ageInYears(dateOfBirth) {
  const diffMs = Date.now() - dateOfBirth.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

// `mappedData` shape:
// { firstName, lastName, otherNames, admissionNumber, dateOfBirth (Date|null),
//   gender, classInput, matchedClass, guardianFirstName, guardianLastName,
//   guardianPhone, guardianEmail, guardianRelationship, matchedGuardianId }
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

  if (!mappedData.admissionNumber) {
    issues.push({ field: 'admissionNumber', severity: 'error', message: 'Admission number is required.' });
  } else if (mappedData.admissionNumber.length > 30) {
    issues.push({ field: 'admissionNumber', severity: 'error', message: 'Admission number is too long (max 30 characters).' });
  }

  if (!mappedData.dateOfBirth) {
    issues.push({ field: 'dateOfBirth', severity: 'error', message: 'Date of birth could not be read. Please enter it manually.' });
  } else {
    const age = ageInYears(mappedData.dateOfBirth);
    if (age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) {
      issues.push({ field: 'dateOfBirth', severity: 'error', message: 'Date of birth looks incorrect — please double-check it.' });
    }
  }

  if (!mappedData.gender) {
    issues.push({ field: 'gender', severity: 'error', message: 'Gender must be Male or Female.' });
  }

  if (!mappedData.classInput) {
    issues.push({ field: 'className', severity: 'warning', message: 'No class provided — select one before importing.' });
  } else if (!mappedData.matchedClass) {
    issues.push({ field: 'className', severity: 'error', message: `"${mappedData.classInput}" doesn\u2019t match any existing class. Please select the correct class.` });
  }

  // Guardian is optional at the row level (unlike the manual-entry form,
  // which requires at least one) — a messy bulk file may be missing
  // guardian details for some rows without that blocking the otherwise-
  // clean student data. Rows with no guardian info at all are flagged as
  // a warning, not an error, and can be completed later from the Guardians
  // page.
  const hasAnyGuardianInput =
    mappedData.guardianFirstName || mappedData.guardianLastName || mappedData.guardianPhone || mappedData.guardianEmail || mappedData.matchedGuardianId;

  if (!hasAnyGuardianInput) {
    issues.push({ field: 'guardian', severity: 'warning', message: 'No guardian information found for this student.' });
  } else if (!mappedData.matchedGuardianId) {
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
