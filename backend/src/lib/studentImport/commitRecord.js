import { createStudentWithGuardians } from '../createStudent.js';

// Converts one ImportRecord's staged mappedData into a real Student (+
// Guardian/User as applicable) via the exact same shared function the
// manual POST /students route uses (PRD/TRD §18.1) — an imported student
// is indistinguishable from a manually created one.
//
// Throws on failure (missing class, race-condition duplicate, etc.);
// callers catch per-row so one bad row never aborts the rest of the batch
// (PRD/TRD §2 / §6: partial commit failure is isolated per row).
export async function commitImportRecord(prisma, record) {
  const m = record.mappedData;

  if (!m.matchedClassId) {
    const err = new Error('No class selected for this row.');
    err.statusCode = 400;
    throw err;
  }
  if (!m.dateOfBirth) {
    const err = new Error('Missing or invalid date of birth.');
    err.statusCode = 400;
    throw err;
  }

  const guardians = [];
  if (m.matchedGuardianId) {
    guardians.push({
      guardianId: m.matchedGuardianId,
      relationship: m.guardianRelationship || 'GUARDIAN',
      isPrimary: true,
    });
  } else if (m.guardianFirstName && m.guardianLastName && m.guardianPhone) {
    guardians.push({
      firstName: m.guardianFirstName,
      lastName: m.guardianLastName,
      phone: m.guardianPhone,
      email: m.guardianEmail || undefined,
      relationship: m.guardianRelationship || 'GUARDIAN',
      isPrimary: true,
    });
  }
  // Rows with no guardian info at all commit with an empty guardians
  // array — createStudentWithGuardians's for-loop simply doesn't run.
  // This is a deliberate Phase 1 relaxation versus the manual form (which
  // requires at least one guardian): a bulk file missing guardian details
  // for some students shouldn't block the otherwise-clean student record
  // from being created; the guardian can be linked later from the
  // Guardians page. rowValidator.js already flags this as a WARNING so
  // it's never silent.

  return prisma.$transaction((tx) =>
    createStudentWithGuardians(tx, {
      admissionNumber: m.admissionNumber,
      firstName: m.firstName,
      lastName: m.lastName,
      otherNames: m.otherNames || undefined,
      dateOfBirth: new Date(m.dateOfBirth),
      gender: m.gender,
      currentClassId: m.matchedClassId,
      guardians,
    }),
  );
}
