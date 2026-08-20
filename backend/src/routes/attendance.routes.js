import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { assertCanActOnClass } from '../lib/classAuthorization.js';
import { assertCanViewStudentRecord } from '../lib/guardianOwnership.js';
import { notifyAttendanceUpdate } from '../lib/notifications.js';
import { buildNameDisambiguationTags } from '../lib/nameDisambiguation.js';
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

    // Roster is already scoped to a single class (classId in the query),
    // so no per-student class key is needed here — every row is in the
    // same class by construction.
    const tags = buildNameDisambiguationTags(enrollments.map((e) => e.student));

    const roster = enrollments.map((e) => ({
      studentId: e.student.id,
      nameTag: tags.get(e.student.id) || '',
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      status: recordsByStudent.get(e.student.id) || null,
    }));

    return res.json({ term, roster });
  }),
);

// School-wide attendance summary for one date — backs the admin dashboard's
// attendance widget, which previously called GET /roster once per class
// (1 + N requests, N = number of classes) purely to sum up counts client
// side. This computes the same numbers server-side with a fixed small set
// of aggregate queries, so the request count no longer scales with the
// number of classes in the school.
router.get(
  '/summary',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required.' });
    }
    const day = startOfDay(date);

    const term = await prisma.term.findFirst({ where: { isCurrent: true } });

    // No current term set — mirror the roster endpoint's graceful
    // per-class failure (the widget previously just showed an empty
    // state in this case rather than surfacing an error).
    if (!term) {
      return res.json({ totalClasses: 0, classesMarked: 0, totalStudents: 0, counts: { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } });
    }

    const [totalClasses, totalStudents, statusGroups, markedClasses] = await prisma.$transaction([
      prisma.class.count(),
      // Same population the old per-class roster loop summed up:
      // active enrollments in the current term, across every class.
      prisma.enrollment.count({ where: { termId: term.id, status: 'ACTIVE' } }),
      // Not scoped to classId — the old client code didn't filter
      // existing records by class either (a student's attendance record
      // for the day was counted regardless of which class fetched it).
      prisma.attendanceRecord.groupBy({ by: ['status'], where: { date: day }, _count: { _all: true } }),
      prisma.attendanceRecord.findMany({ where: { date: day }, distinct: ['classId'], select: { classId: true } }),
    ]);

    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const g of statusGroups) {
      counts[g.status] = g._count._all;
    }

    return res.json({
      totalClasses,
      classesMarked: markedClasses.length,
      totalStudents,
      counts,
    });
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

    // Only ABSENT/LATE are notification-worthy — PRESENT is the expected
    // default and marking a whole class present would otherwise fire a
    // notification per student, every school day, for every family.
    const flagged = records.filter((r) => r.status === 'ABSENT' || r.status === 'LATE');
    if (flagged.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: flagged.map((r) => r.studentId) } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameById = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
      const dateLabel = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      await Promise.all(
        flagged.map((r) =>
          notifyAttendanceUpdate({
            studentId: r.studentId,
            studentName: nameById.get(r.studentId),
            status: r.status,
            dateLabel,
          }),
        ),
      );
    }

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
