import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import {
  createSessionSchema,
  updateSessionSchema,
  createTermSchema,
  updateTermSchema,
} from '../validation/academic.schema.js';

const router = Router();

router.use(requireAuth);

// ---- Academic sessions ----

router.get(
  '/sessions',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const sessions = await prisma.academicSession.findMany({
      include: { terms: true },
      orderBy: { startDate: 'desc' },
    });
    return res.json(sessions);
  }),
);

router.post(
  '/sessions',
  requireRole('ADMIN'),
  validateBody(createSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await setCurrentAware(prisma.academicSession, req.body);
    await logAction({
      userId: req.user.id,
      action: 'session.create',
      entityType: 'AcademicSession',
      entityId: session.id,
    });
    return res.status(201).json(session);
  }),
);

router.patch(
  '/sessions/:id',
  requireRole('ADMIN'),
  validateBody(updateSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await setCurrentAware(prisma.academicSession, req.body, req.params.id);
    await logAction({
      userId: req.user.id,
      action: 'session.update',
      entityType: 'AcademicSession',
      entityId: session.id,
      metadata: req.body,
    });
    return res.json(session);
  }),
);

// ---- Terms ----

router.get(
  '/terms',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const terms = await prisma.term.findMany({
      where: { sessionId: req.query.sessionId || undefined },
      include: { session: true },
      orderBy: { startDate: 'desc' },
    });
    return res.json(terms);
  }),
);

router.post(
  '/terms',
  requireRole('ADMIN'),
  validateBody(createTermSchema),
  asyncHandler(async (req, res) => {
    const term = await setCurrentAware(prisma.term, req.body);
    await logAction({ userId: req.user.id, action: 'term.create', entityType: 'Term', entityId: term.id });
    return res.status(201).json(term);
  }),
);

router.patch(
  '/terms/:id',
  requireRole('ADMIN'),
  validateBody(updateTermSchema),
  asyncHandler(async (req, res) => {
    const term = await setCurrentAware(prisma.term, req.body, req.params.id);
    await logAction({
      userId: req.user.id,
      action: 'term.update',
      entityType: 'Term',
      entityId: term.id,
      metadata: req.body,
    });
    return res.json(term);
  }),
);

// Only one session/term should ever be "current" at a time. When a
// create/update sets isCurrent: true, unset it on every other row first.
async function setCurrentAware(model, data, id) {
  if (data.isCurrent) {
    await model.updateMany({ where: {}, data: { isCurrent: false } });
  }
  if (id) {
    return model.update({ where: { id }, data });
  }
  return model.create({ data });
}

export default router;
