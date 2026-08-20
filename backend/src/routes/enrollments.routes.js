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

// School-wide enrollment overview — backs the admin dashboard's enrollment
// widget, which previously fetched all terms then called GET /
// (unfiltered by termId) once per recent term (1 + up to 6 requests) to
// build a trend line and a class-distribution chart client side. This
// computes the same two things with a fixed small number of aggregate
// queries, so it no longer scales with how many terms the school has run.
router.get(
  '/summary',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const allTerms = await prisma.term.findMany({
      include: { session: true },
      orderBy: { startDate: 'asc' },
    });

    if (allTerms.length === 0) {
      return res.json({ terms: [], currentTermId: null, classDistribution: [] });
    }

    const recentTerms = allTerms.slice(-6);
    const termIds = recentTerms.map((t) => t.id);
    const currentTerm = recentTerms.find((t) => t.isCurrent) || recentTerms[recentTerms.length - 1];

    const [enrollmentCountsByTerm, classGroups] = await prisma.$transaction([
      prisma.enrollment.groupBy({ by: ['termId'], where: { termId: { in: termIds } }, _count: { _all: true } }),
      prisma.enrollment.groupBy({ by: ['classId'], where: { termId: currentTerm.id }, _count: { _all: true } }),
    ]);

    const countByTermId = new Map(enrollmentCountsByTerm.map((g) => [g.termId, g._count._all]));

    const classIds = classGroups.map((g) => g.classId);
    const classes = classIds.length
      ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));

    const classDistribution = classGroups
      .map((g) => ({ label: classNameById.get(g.classId) || 'Unassigned', value: g._count._all }))
      .sort((a, b) => b.value - a.value);

    const terms = recentTerms.map((t) => ({
      id: t.id,
      name: t.name,
      sessionName: t.session?.name || '',
      isCurrent: t.isCurrent,
      enrollmentCount: countByTermId.get(t.id) || 0,
    }));

    return res.json({ terms, currentTermId: currentTerm.id, classDistribution });
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
