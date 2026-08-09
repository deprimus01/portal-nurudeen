import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { assertCanActOnClass } from '../lib/classAuthorization.js';
import { assertCanViewStudentRecord } from '../lib/guardianOwnership.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { markAttendanceSchema } from '../validation/attendance.schema.js';

const router = Router();

router.use(requireAuth);

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Returns the class roster (students currently enrolled) merged with any
// attendance already marked for that date — the teacher's entry screen
// fetches this once, shows existing marks pre-filled, and re-submits via
// POST /api/attendance below.
router.get(
  '/roster',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { classId, date } = req.query;
    if (!classId || !date) {
      return res.status(400).json({ error: 'classId and date are required.' });
    }

    await assertCanActOnClass(req.user, classId);

    const day = startOfDay(date);

    const term = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) {
      return res.status(400).json({ error: 'No current term is set. Set one under Sessions & Terms first.' });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { classId, termId: term.id, status: 'ACTIVE' },
      include: { student: true },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const existingRecords = await prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds }, date: day },
    });
    const recordsByStudent = new Map(existingRecords.map((r) => [r.studentId, r.status]));

    const roster = enrollments.map((e) => ({
      studentId: e.student.id,
      admissionNumber: e.student.admissionNumber,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      status: recordsByStudent.get(e.student.id) || null,
    }));

    return res.json({ term, roster });
  }),
);

router.post(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  validateBody(markAttendanceSchema),
  asyncHandler(async (req, res) => {
    const { classId, date, records } = req.body;

    await assertCanActOnClass(req.user, classId);

    const day = startOfDay(date);

    await prisma.$transaction(
      records.map((r) =>
        prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: r.studentId, date: day } },
          create: {
            studentId: r.studentId,
            classId,
            date: day,
            status: r.status,
            markedById: req.user.staffId,
          },
          update: {
            status: r.status,
            classId,
            markedById: req.user.staffId,
          },
        }),
      ),
    );

    await logAction({
      userId: req.user.id,
      action: 'attendance.mark',
      entityType: 'AttendanceRecord',
      metadata: { classId, date: day.toISOString(), count: records.length },
    });

    return res.json({ ok: true, count: records.length });
  }),
);

// History for one student. Admin/Teacher can view any student; Guardian
// must be linked to the student; Student may only view their own record.
router.get(
  '/student/:studentId',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN', 'STUDENT'),
  asyncHandler(async (req, res) => {
    await assertCanViewStudentRecord(req.user, req.params.studentId);

    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { date: 'desc' },
      take: 90,
    });
    return res.json(records);
  }),
);

export default router;
