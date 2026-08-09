import { prisma } from './prisma.js';

// Who a given user is allowed to message — the actual security boundary,
// re-checked on every send (and now on every AI-drafted message too), not
// just what a UI dropdown happens to offer. PRD §2.4 / roles table:
// Admin ↔ anyone with a portal account, Teacher ↔ colleagues + guardians of
// students in their own classes, Guardian ↔ staff teaching their child's
// class(es).
//
// Moved out of messages.routes.js so the AI message-drafting endpoint can
// import the exact same function instead of re-deriving (and risking
// drifting from) this boundary.
export function contactFromStaff(staff) {
  return {
    userId: staff.user.id,
    name: `${staff.firstName} ${staff.lastName}`,
    role: staff.user.role,
    subtitle: staff.role === 'TEACHER' ? 'Teacher' : 'Admin',
  };
}

export function contactFromGuardian(guardian) {
  return {
    userId: guardian.user.id,
    name: `${guardian.firstName} ${guardian.lastName}`,
    role: guardian.user.role,
    subtitle: 'Parent/Guardian',
  };
}

export async function getContacts(user) {
  if (user.role === 'ADMIN') {
    const [staff, guardians] = await Promise.all([
      prisma.staff.findMany({ where: { user: { isNot: null }, id: { not: user.staffId } }, include: { user: true } }),
      prisma.guardian.findMany({ where: { user: { isNot: null } }, include: { user: true } }),
    ]);
    return [...staff.map(contactFromStaff), ...guardians.map(contactFromGuardian)];
  }

  if (user.role === 'TEACHER') {
    const staff = await prisma.staff.findMany({
      where: { user: { isNot: null }, id: { not: user.staffId } },
      include: { user: true },
    });

    const myClasses = await prisma.staffClass.findMany({
      where: { staffId: user.staffId },
      select: { classId: true },
    });
    const classIds = myClasses.map((c) => c.classId);

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: classIds }, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    const links = await prisma.studentGuardian.findMany({
      where: { studentId: { in: studentIds } },
      include: { guardian: { include: { user: true } } },
    });

    const guardianById = new Map();
    for (const l of links) {
      if (l.guardian.user) guardianById.set(l.guardian.id, l.guardian);
    }

    return [...staff.map(contactFromStaff), ...[...guardianById.values()].map(contactFromGuardian)];
  }

  if (user.role === 'GUARDIAN') {
    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: user.guardianId },
      select: { studentId: true },
    });
    const studentIds = links.map((l) => l.studentId);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, status: 'ACTIVE' },
      select: { classId: true },
    });
    const classIds = [...new Set(enrollments.map((e) => e.classId))];

    const staffClasses = await prisma.staffClass.findMany({
      where: { classId: { in: classIds } },
      include: { staff: { include: { user: true } } },
    });

    const staffById = new Map();
    for (const sc of staffClasses) {
      if (sc.staff.user) staffById.set(sc.staff.id, sc.staff);
    }

    return [...staffById.values()].map(contactFromStaff);
  }

  return [];
}
