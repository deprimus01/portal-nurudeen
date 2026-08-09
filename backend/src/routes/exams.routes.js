import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { assertCanViewStudentRecord } from '../lib/guardianOwnership.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createExamSchema } from '../validation/results.schema.js';

const router = Router();

router.use(requireAuth);

const examInclude = {
  term: { include: { session: true } },
  class: true,
  gradingScheme: { include: { bands: true } },
};

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { termId, classId } = req.query;
    const exams = await prisma.exam.findMany({
      where: { termId: termId || undefined, classId: classId || undefined },
      include: examInclude,
      orderBy: { createdAt: 'desc' },
    });
    return res.json(exams);
  }),
);

router.get(
  '/:id',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: examInclude,
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });
    return res.json(exam);
  }),
);

// Guardian-scoped: exams that exist for a specific child's current class,
// across any term — the picker a guardian uses before viewing a report
// card. Deliberately separate from GET / above rather than widening that
// route's access, since GET / has no per-student scoping at all.
router.get(
  '/for-student/:studentId',
  requireRole('ADMIN', 'GUARDIAN', 'STUDENT'),
  asyncHandler(async (req, res) => {
    await assertCanViewStudentRecord(req.user, req.params.studentId);

    const student = await prisma.student.findUnique({ where: { id: req.params.studentId } });
    if (!student || !student.currentClassId) return res.json([]);

    const exams = await prisma.exam.findMany({
      where: { classId: student.currentClassId },
      include: examInclude,
      orderBy: { createdAt: 'desc' },
    });
    return res.json(exams);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createExamSchema),
  asyncHandler(async (req, res) => {
    const exam = await prisma.exam.create({ data: req.body, include: examInclude });

    await logAction({ userId: req.user.id, action: 'exam.create', entityType: 'Exam', entityId: exam.id });

    return res.status(201).json(exam);
  }),
);

export default router;
