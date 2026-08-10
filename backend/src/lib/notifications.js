import { prisma } from './prisma.js';

// In-app notification feed. Deliberately separate from lib/notify.js
// (SMS/email delivery + NotificationLog) — this is what a signed-in user
// sees inside the portal (bell icon / dropdown), written at the moment
// the source event happens so read/unread state is stable once created.
//
// Every writer below is fire-and-forget-safe (never throws into the
// caller) — same philosophy as logAction: a notification failing to
// write should never break the request that triggered it.

// Inserts one row per recipient. `rows` is an array of
// { userId, type, title, body, entityType?, entityId? }. Silently drops
// rows with no userId (e.g. a student/guardian with no linked User yet).
async function writeNotifications(rows) {
  const data = rows.filter((r) => r.userId);
  if (data.length === 0) return;
  try {
    await prisma.notification.createMany({ data });
  } catch {
    // Swallow — notifications are a convenience layer, never a hard
    // dependency of the action that triggered them.
  }
}

// Single-recipient convenience wrapper.
export async function notifyUser({ userId, type, title, body, entityType, entityId }) {
  return writeNotifications([{ userId, type, title, body, entityType, entityId }]);
}

// ---- Recipient resolution ----
// Mirrors the boundaries already enforced in the routes/middleware (StaffClass
// for "which teacher", StudentGuardian for "which guardian") so a
// notification recipient list can never be broader than what that person
// could already see via the regular read endpoints.

export async function adminUserIds({ excludeUserId } = {}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, id: excludeUserId ? { not: excludeUserId } : undefined },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function teacherUserIdsForClass(classId) {
  const assignments = await prisma.staffClass.findMany({
    where: { classId, staff: { user: { isNot: null } } },
    select: { staff: { select: { user: { select: { id: true } } } } },
  });
  return assignments.map((a) => a.staff.user?.id).filter(Boolean);
}

export async function studentUserIdForStudent(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { id: true } } },
  });
  return student?.user?.id || null;
}

export async function guardianUserIdsForStudent(studentId) {
  const links = await prisma.studentGuardian.findMany({
    where: { studentId, guardian: { user: { isNot: null } } },
    select: { guardian: { select: { user: { select: { id: true } } } } },
  });
  return links.map((l) => l.guardian.user?.id).filter(Boolean);
}

// Student + all linked guardians in one call — the common case for
// results/attendance, which both roles care about for the same child.
export async function studentAndGuardianUserIds(studentId) {
  const [studentUserId, guardianIds] = await Promise.all([
    studentUserIdForStudent(studentId),
    guardianUserIdsForStudent(studentId),
  ]);
  return [studentUserId, ...guardianIds].filter(Boolean);
}

// Every student currently in a class + every one of their guardians —
// used for class-scoped announcements/exams. De-duplicated.
export async function classAudienceUserIds(classId) {
  const students = await prisma.student.findMany({
    where: { currentClassId: classId },
    select: { id: true, user: { select: { id: true } } },
  });
  const studentUserIds = students.map((s) => s.user?.id).filter(Boolean);
  const guardianLists = await Promise.all(students.map((s) => guardianUserIdsForStudent(s.id)));
  return [...new Set([...studentUserIds, ...guardianLists.flat()])];
}

export async function allActiveUserIdsByRole(role, { excludeUserId } = {}) {
  const users = await prisma.user.findMany({
    where: { role, isActive: true, id: excludeUserId ? { not: excludeUserId } : undefined },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ---- Event-specific writers ----
// Each mirrors a logAction() call site 1:1. Kept as named exports so the
// route file stays readable — one extra line next to the existing
// logAction call, not a new pattern to learn.

export async function notifyNewEnrollment({ actorUserId, studentName, className }) {
  const recipients = await adminUserIds({ excludeUserId: actorUserId });
  await writeNotifications(
    recipients.map((userId) => ({
      userId,
      type: 'enrollment',
      title: 'New enrollment',
      body: `${studentName} was enrolled in ${className}.`,
      entityType: 'Enrollment',
    })),
  );
}

export async function notifyNewStaff({ actorUserId, staffName, staffRole }) {
  const recipients = await adminUserIds({ excludeUserId: actorUserId });
  await writeNotifications(
    recipients.map((userId) => ({
      userId,
      type: 'staff',
      title: 'New staff record',
      body: `${staffName} was added as ${staffRole === 'ADMIN' ? 'an admin' : 'a teacher'}.`,
      entityType: 'Staff',
    })),
  );
}

export async function notifyAnnouncement({ actorUserId, announcement }) {
  const isSchoolWide = announcement.audience === 'SCHOOL_WIDE';

  const [admins, teachers, classAudience] = await Promise.all([
    adminUserIds({ excludeUserId: actorUserId }),
    isSchoolWide
      ? allActiveUserIdsByRole('TEACHER', { excludeUserId: actorUserId })
      : teacherUserIdsForClass(announcement.classId),
    isSchoolWide
      ? Promise.all([
          allActiveUserIdsByRole('STUDENT'),
          allActiveUserIdsByRole('GUARDIAN'),
        ]).then(([s, g]) => [...s, ...g])
      : classAudienceUserIds(announcement.classId),
  ]);

  const recipients = new Set([...admins, ...teachers, ...classAudience]);
  recipients.delete(actorUserId);

  const audienceLabel = isSchoolWide ? 'School-wide' : announcement.class?.name || 'Class';
  const body = `"${announcement.title}" — ${audienceLabel}`;

  await writeNotifications(
    [...recipients].map((userId) => ({
      userId,
      type: 'announcement',
      title: 'New announcement',
      body,
      entityType: 'Announcement',
      entityId: announcement.id,
    })),
  );
}

export async function notifyFeeActivity({ actorUserId, title, body, invoiceId }) {
  const recipients = await adminUserIds({ excludeUserId: actorUserId });
  await writeNotifications(
    recipients.map((userId) => ({
      userId,
      type: 'fee',
      title,
      body,
      entityType: 'Invoice',
      entityId: invoiceId,
    })),
  );
}

export async function notifyFeeUpdateForStudent({ studentId, studentName, body, invoiceId }) {
  const recipients = await guardianUserIdsForStudent(studentId);
  await writeNotifications(
    recipients.map((userId) => ({
      userId,
      type: 'fee',
      title: `Fee update — ${studentName}`,
      body,
      entityType: 'Invoice',
      entityId: invoiceId,
    })),
  );
}

export async function notifyResultsPublished({ studentId, studentName, subjectName, examName, examId }) {
  const recipients = await studentAndGuardianUserIds(studentId);
  await writeNotifications(
    recipients.map((userId) => ({
      userId,
      type: 'result',
      title: 'Results published',
      body: `${subjectName} result for ${examName} is now available${studentName ? ` for ${studentName}` : ''}.`,
      entityType: 'Exam',
      entityId: examId,
    })),
  );
}

// Only called for ABSENT/LATE — a PRESENT mark is the expected default
// and would turn this into a daily popup for every family, which the PRD
// for this feature explicitly rules out.
export async function notifyAttendanceUpdate({ studentId, studentName, status, dateLabel }) {
  const recipients = await studentAndGuardianUserIds(studentId);
  const statusLabel = status === 'ABSENT' ? 'absent' : status === 'LATE' ? 'late' : status.toLowerCase();
  await writeNotifications(
    recipients.map((userId) => ({
      userId,
      type: 'attendance',
      title: 'Attendance update',
      body: `${studentName ? `${studentName} was` : 'Marked'} marked ${statusLabel} on ${dateLabel}.`,
      entityType: 'AttendanceRecord',
    })),
  );
}

export async function notifyUpcomingExam({ exam }) {
  const [teachers, classAudience] = await Promise.all([
    teacherUserIdsForClass(exam.classId),
    classAudienceUserIds(exam.classId),
  ]);
  const recipients = new Set([...teachers, ...classAudience]);

  await writeNotifications(
    [...recipients].map((userId) => ({
      userId,
      type: 'exam',
      title: 'Upcoming exam',
      body: `${exam.name} has been scheduled for ${exam.class?.name || 'your class'}.`,
      entityType: 'Exam',
      entityId: exam.id,
    })),
  );
}

export async function notifyNewMessage({ recipientUserId, senderName, preview }) {
  await notifyUser({
    userId: recipientUserId,
    type: 'message',
    title: `Message from ${senderName}`,
    body: preview.length > 140 ? `${preview.slice(0, 140)}\u2026` : preview,
    entityType: 'Message',
  });
}

// System activity — kept narrow on purpose (see lib/notify.js) so it only
// fires for a genuinely actionable failure, not every transient blip.
export async function notifySystemActivity({ title, body, entityType, entityId }) {
  const recipients = await adminUserIds();
  await writeNotifications(
    recipients.map((userId) => ({ userId, type: 'system', title, body, entityType, entityId })),
  );
}
