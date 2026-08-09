import { prisma } from './prisma.js';
import { computeReportCard } from './reportCard.js';

// If the message recipient is a guardian, and there's exactly one student
// this sender (teacher/admin) can plausibly be messaging them about,
// pull a compact, factual snapshot to ground the AI draft — same "only
// the data provided, never invent" pattern as the parent-qa endpoint.
// If there's no single clear student (none linked, or several — e.g. a
// guardian with children in different classes), we skip context rather
// than guess, and the draft stays general.
export async function resolveDraftContext(sender, recipientUserId) {
  const recipientUser = await prisma.user.findUnique({
    where: { id: recipientUserId },
    include: { guardian: true },
  });
  if (!recipientUser?.guardian) return null;

  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: recipientUser.guardian.id },
    select: { studentId: true },
  });
  let studentIds = links.map((l) => l.studentId);
  if (studentIds.length === 0) return null;

  // Teachers only get context for a student in one of their own classes —
  // same boundary as assertCanActOnClass, applied here to what we're
  // willing to hand the model, not just what a write endpoint allows.
  if (sender.role === 'TEACHER') {
    const myClasses = await prisma.staffClass.findMany({ where: { staffId: sender.staffId }, select: { classId: true } });
    const classIds = myClasses.map((c) => c.classId);
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, classId: { in: classIds }, status: 'ACTIVE' },
      select: { studentId: true },
    });
    studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  }

  if (studentIds.length !== 1) return null;

  const student = await prisma.student.findUnique({
    where: { id: studentIds[0] },
    include: { currentClass: true },
  });
  if (!student) return null;

  const attendance = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    orderBy: { date: 'desc' },
    take: 14,
  });
  const presentish = attendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const attendanceSummary =
    attendance.length === 0 ? 'No attendance recorded yet.' : `${presentish}/${attendance.length} present in the last ${attendance.length} recorded days.`;

  let resultSummary = 'No exam results available yet.';
  if (student.currentClassId) {
    const latestExam = await prisma.exam.findFirst({ where: { classId: student.currentClassId }, orderBy: { createdAt: 'desc' } });
    if (latestExam) {
      const card = await computeReportCard(latestExam.id, student.id);
      if (card && card.average !== null) {
        resultSummary = `Latest exam (${card.examSummary.name}) average: ${card.average}.`;
      }
    }
  }

  const invoices = await prisma.invoice.findMany({ where: { studentId: student.id }, include: { payments: true } });
  const feeSummary =
    invoices.length === 0
      ? 'No fee invoices on record.'
      : invoices
          .map((i) => {
            const paid = i.payments.reduce((sum, p) => sum + p.amount, 0);
            const outstanding = Math.round((i.amount - paid) / 100);
            return outstanding > 0 ? `₦${outstanding.toLocaleString()} outstanding (${i.status})` : `Paid in full (${i.status})`;
          })
          .join('; ');

  return {
    studentName: `${student.firstName} ${student.lastName}`,
    className: student.currentClass?.name || 'not assigned',
    attendanceSummary,
    resultSummary,
    feeSummary,
  };
}
