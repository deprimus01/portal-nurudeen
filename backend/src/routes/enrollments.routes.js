import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { notifyNewEnrollment } from '../lib/notifications.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createEnrollmentSchema, updateEnrollmentSchema } from '../validation/academic.schema.js';

const router = Router();

router.use(requireAuth);

const enrollmentInclude = {
  student: true,
  class: true,
  section: true,
  term: { include: { session: true } },
};

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { termId, classId, studentId } = req.query;
    const enrollments = await prisma.enrollment.findMany({
      where: {
        termId: termId || undefined,
        classId: classId || undefined,
        studentId: studentId || undefined,
      },
      include: enrollmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return res.json(enrollments);
  }),
);

// Enrolling a student in a term also updates their currentClassId — this
// is how yearly promotion works: create a new Enrollment row for the new
// term/class, and the student's "current" pointer moves with it.
router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createEnrollmentSchema),
  asyncHandler(async (req, res) => {
    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.create({ data: req.body, include: enrollmentInclude });
      await tx.student.update({
        where: { id: req.body.studentId },
        data: { currentClassId: req.body.classId },
      });
      return created;
    });

    await logAction({
      userId: req.user.id,
      action: 'enrollment.create',
      entityType: 'Enrollment',
      entityId: enrollment.id,
    });

    await notifyNewEnrollment({
      actorUserId: req.user.id,
      studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      className: enrollment.class.name,
    });

    return res.status(201).json(enrollment);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(updateEnrollmentSchema),
  asyncHandler(async (req, res) => {
    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: req.body,
      include: enrollmentInclude,
    });
    await logAction({
      userId: req.user.id,
      action: 'enrollment.update',
      entityType: 'Enrollment',
      entityId: enrollment.id,
      metadata: req.body,
    });
    return res.json(enrollment);
  }),
);

export default router;
