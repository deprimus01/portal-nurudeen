import { hashPassword, generateTempPassword } from './auth.js';

// Creates one Student, links/creates its Guardian(s), and auto-provisions a
// portal account per guardian who doesn't already have one.
//
// Extracted from the POST /students route so this exact logic — and only
// this logic — is what runs whether a student is created one at a time
// through the manual form, or in bulk through Smart Student Import
// (PRD/TRD §18.1: "Refactor the existing POST /students handler's
// creation logic into a shared lib/createStudent.js, used by both the
// manual route and the import committer — no duplicated guardian/
// provisioning logic."). An imported student is therefore indistinguishable
// from a manually created one: same guardian-matching rules, same
// auto-provisioned credentials, same notification/audit behavior at the
// call site.
//
// `tx` must be a Prisma transaction client (or `prisma` itself, if the
// caller doesn't need atomicity with other writes). This function does not
// open its own transaction — callers control the transaction boundary,
// since the import committer needs one sub-transaction per row (so one bad
// row doesn't roll back the whole batch) while the manual route wraps a
// single call in one transaction.
//
// Throws on the same conditions the original route threw on (missing
// required fields for a new inline guardian; unknown guardianId) — callers
// should let these propagate to asyncHandler/errorHandler as before.
export async function createStudentWithGuardians(tx, { guardians, ...studentData }) {
  const student = await tx.student.create({ data: studentData });

  const provisionedCredentials = [];

  for (const g of guardians) {
    let guardianRecord;

    if (g.guardianId) {
      guardianRecord = await tx.guardian.findUniqueOrThrow({ where: { id: g.guardianId } });
    } else {
      if (!g.firstName || !g.lastName || !g.phone) {
        throw Object.assign(
          new Error('New guardians require firstName, lastName, and phone.'),
          { statusCode: 400 },
        );
      }
      guardianRecord = await tx.guardian.create({
        data: {
          firstName: g.firstName,
          lastName: g.lastName,
          phone: g.phone,
          email: g.email,
        },
      });
    }

    await tx.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardianRecord.id,
        relationship: g.relationship,
        isPrimary: g.isPrimary,
      },
    });

    // Only provision a new User if this guardian doesn't have one yet
    // (a guardian with multiple children shares one account).
    const existingUser = await tx.user.findUnique({ where: { guardianId: guardianRecord.id } });
    if (!existingUser) {
      if (!guardianRecord.email) {
        // No email on file — skip auto-provisioning; admin can add one
        // and provision manually via a future "create portal account"
        // action. Not a hard failure, since phone-only guardians are
        // common and shouldn't block enrollment.
        continue;
      }
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      await tx.user.create({
        data: {
          email: guardianRecord.email,
          passwordHash,
          role: 'GUARDIAN',
          guardianId: guardianRecord.id,
          mustResetPassword: true,
        },
      });

      provisionedCredentials.push({
        guardianId: guardianRecord.id,
        firstName: guardianRecord.firstName,
        lastName: guardianRecord.lastName,
        email: guardianRecord.email,
        phone: guardianRecord.phone,
        tempPassword,
      });
    }
  }

  return { student, provisionedCredentials };
}
