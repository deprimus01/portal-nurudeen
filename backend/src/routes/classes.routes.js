import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createClassSchema, updateClassSchema } from '../validation/academic.schema.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const classes = await prisma.class.findMany({
      include: { sections: true, classSubjects: { include: { subject: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(classes);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createClassSchema),
  asyncHandler(async (req, res) => {
    let { sortOrder } = req.body;
    if (sortOrder === undefined) {
      // Auto-assign to the end of the list, rather than making admins pick
      // a number by hand - matches how the class list is always displayed
      // (orderBy sortOrder asc) and how Move Up/Down maintain it below.
      const last = await prisma.class.findFirst({ orderBy: { sortOrder: 'desc' } });
      sortOrder = last ? last.sortOrder + 1 : 0;
    }
    const klass = await prisma.class.create({ data: { ...req.body, sortOrder } });
    await logAction({ userId: req.user.id, action: 'class.create', entityType: 'Class', entityId: klass.id });
    return res.status(201).json(klass);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(updateClassSchema),
  asyncHandler(async (req, res) => {
    const klass = await prisma.class.update({ where: { id: req.params.id }, data: req.body });
    await logAction({
      userId: req.user.id,
      action: 'class.update',
      entityType: 'Class',
      entityId: klass.id,
      metadata: req.body,
    });
    return res.json(klass);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.class.delete({ where: { id: req.params.id } });
    await logAction({ userId: req.user.id, action: 'class.delete', entityType: 'Class', entityId: req.params.id });
    return res.json({ ok: true });
  }),
);

// Syncs which subjects are taught in this class — replaces the full set
// each call (delete-then-recreate) rather than diffing, since this is a
// low-frequency admin action, not something called per-keystroke.
router.put(
  '/:id/subjects',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { subjectIds } = req.body;
    if (!Array.isArray(subjectIds)) {
      return res.status(400).json({ error: 'subjectIds must be an array.' });
    }

    await prisma.$transaction([
      prisma.classSubject.deleteMany({ where: { classId: req.params.id } }),
      prisma.classSubject.createMany({
        data: subjectIds.map((subjectId) => ({ classId: req.params.id, subjectId })),
      }),
    ]);

    const updated = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: { classSubjects: { include: { subject: true } } },
    });

    await logAction({
      userId: req.user.id,
      action: 'class.subjects.sync',
      entityType: 'Class',
      entityId: req.params.id,
      metadata: { subjectIds },
    });

    return res.json(updated);
  }),
);

export default router;
