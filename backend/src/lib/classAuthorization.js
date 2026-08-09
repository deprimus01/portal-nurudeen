import { prisma } from './prisma.js';

// Admins can act on any class. Teachers can only act on classes they're
// assigned to via StaffClass — PRD Roles & Permissions: "Take attendance:
// Teacher Yes (own classes)". This is the actual security boundary; the
// frontend only filtering the dropdown to "my classes" is a UX nicety, not
// something to trust.
export async function assertCanActOnClass(user, classId) {
  if (user.role === 'ADMIN') return true;

  if (user.role !== 'TEACHER') {
    const err = new Error('You do not have permission to do that.');
    err.statusCode = 403;
    throw err;
  }

  const assignment = await prisma.staffClass.findFirst({
    where: { staffId: user.staffId, classId },
  });

  if (!assignment) {
    const err = new Error('You are not assigned to this class.');
    err.statusCode = 403;
    throw err;
  }

  return true;
}
