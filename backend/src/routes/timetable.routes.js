import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { assertCanViewStudentRecord } from '../lib/guardianOwnership.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { upsertSlotSchema, clearSlotSchema } from '../validation/timetable.schema.js';

const router = Router();

router.use(requireAuth);

const slotInclude = { subject: true, staff: true };

// Full weekly grid for one class — used by both the admin builder and any
// read-only class view. Returns every existing slot; the frontend fills in
// the empty cells for whichever day/period combinations aren't set.
router.get(
  '/class/:classId',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const slots = await prisma.timetableSlot.findMany({
      where: { classId: req.params.classId },
      include: slotInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    });
    return res.json(slots);
  }),
);

// A teacher's own schedule across every class they teach — read-only,
// per PRD §3.3 "read-only views for teachers".
router.get(
  '/me',
  requireRole('TEACHER'),
  asyncHandler(async (req, res) => {
    const slots = await prisma.timetableSlot.findMany({
      where: { staffId: req.user.staffId },
      include: { ...slotInclude, class: true },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    });
    return res.json(slots);
  }),
);

// A student/guardian's own class timetable — looks up the student's
// current class and returns that class's grid, read-only. Reuses the
// same access boundary as attendance/results (self for Student, linked
// child for Guardian).
router.get(
  '/for-student/:studentId',
  requireRole('ADMIN', 'GUARDIAN', 'STUDENT'),
  asyncHandler(async (req, res) => {
    await assertCanViewStudentRecord(req.user, req.params.studentId);

    const student = await prisma.student.findUnique({ where: { id: req.params.studentId } });
    if (!student || !student.currentClassId) return res.json([]);

    const slots = await prisma.timetableSlot.findMany({
      where: { classId: student.currentClassId },
      include: slotInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    });
    return res.json(slots);
  }),
);

// Admin-only: the builder. Upserts one cell in the grid at a time (called
// once per cell edit from the frontend, not as a bulk save) — simplest
// mental model for a drag-free click-to-edit grid.
router.put(
  '/slot',
  requireRole('ADMIN'),
  validateBody(upsertSlotSchema),
  asyncHandler(async (req, res) => {
    const { classId, dayOfWeek, period, label, subjectId, staffId } = req.body;

    const slot = await prisma.timetableSlot.upsert({
      where: { classId_dayOfWeek_period: { classId, dayOfWeek, period } },
      create: { classId, dayOfWeek, period, label, subjectId, staffId },
      update: { label: label ?? null, subjectId: subjectId ?? null, staffId: staffId ?? null },
      include: slotInclude,
    });

    await logAction({
      userId: req.user.id,
      action: 'timetable.slot.set',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      metadata: { classId, dayOfWeek, period },
    });

    return res.json(slot);
  }),
);

router.delete(
  '/slot',
  requireRole('ADMIN'),
  validateBody(clearSlotSchema),
  asyncHandler(async (req, res) => {
    const { classId, dayOfWeek, period } = req.body;

    const existing = await prisma.timetableSlot.findUnique({
      where: { classId_dayOfWeek_period: { classId, dayOfWeek, period } },
    });
    if (!existing) return res.json({ ok: true });

    await prisma.timetableSlot.delete({ where: { id: existing.id } });

    await logAction({
      userId: req.user.id,
      action: 'timetable.slot.clear',
      entityType: 'TimetableSlot',
      entityId: existing.id,
      metadata: { classId, dayOfWeek, period },
    });

    return res.json({ ok: true });
  }),
);

export default router;
