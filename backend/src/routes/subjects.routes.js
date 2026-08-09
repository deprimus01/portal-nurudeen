import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createSubjectSchema, updateSubjectSchema } from '../validation/academic.schema.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return res.json(subjects);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createSubjectSchema),
  asyncHandler(async (req, res) => {
    const subject = await prisma.subject.create({ data: req.body });
    await logAction({ userId: req.user.id, action: 'subject.create', entityType: 'Subject', entityId: subject.id });
    return res.status(201).json(subject);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(updateSubjectSchema),
  asyncHandler(async (req, res) => {
    const subject = await prisma.subject.update({ where: { id: req.params.id }, data: req.body });
    await logAction({
      userId: req.user.id,
      action: 'subject.update',
      entityType: 'Subject',
      entityId: subject.id,
      metadata: req.body,
    });
    return res.json(subject);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.subject.delete({ where: { id: req.params.id } });
    await logAction({
      userId: req.user.id,
      action: 'subject.delete',
      entityType: 'Subject',
      entityId: req.params.id,
    });
    return res.json({ ok: true });
  }),
);

export default router;
