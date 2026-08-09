import { prisma } from './prisma.js';

// The read-only boundary for every guardian-facing endpoint: a guardian
// can only ever see data for a student they're actually linked to via
// StudentGuardian. Admin/Teacher bypass this (they have their own
// broader authorization elsewhere); this is guardian-specific.
export async function assertGuardianOwnsStudent(user, studentId) {
  if (user.role !== 'GUARDIAN') return true; // not this check's concern

  const link = await prisma.studentGuardian.findFirst({
    where: { guardianId: user.guardianId, studentId },
  });

  if (!link) {
    const err = new Error('You are not linked to this student.');
    err.statusCode = 403;
    throw err;
  }

  return true;
}

// Every student ID currently linked to this guardian — used to scope list
// endpoints (invoices, exams) without needing a specific studentId param.
export async function guardianStudentIds(user) {
  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: user.guardianId },
    select: { studentId: true },
  });
  return links.map((l) => l.studentId);
}

// Unified read-only boundary for endpoints Admin/Teacher/Guardian/Student
// all share (attendance history, report cards, timetable): Admin/Teacher
// pass through (their own broader authorization applies elsewhere if
// needed); Guardian must be linked via StudentGuardian; Student may only
// view their own record.
export async function assertCanViewStudentRecord(user, studentId) {
  if (user.role === 'ADMIN' || user.role === 'TEACHER') return true;

  if (user.role === 'STUDENT') {
    if (user.studentId !== studentId) {
      const err = new Error('You can only view your own record.');
      err.statusCode = 403;
      throw err;
    }
    return true;
  }

  return assertGuardianOwnsStudent(user, studentId);
}
