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
    await assertTermWithinSession(req.body.sessionId, req.body.startDate, req.body.endDate);
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
    const existing = await prisma.term.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      const err = new Error('Term not found.');
      err.statusCode = 404;
      throw err;
    }
    // The patch may only touch some fields (e.g. just isCurrent) - merge
    // with the existing row so the range check always sees the term's
    // *effective* dates, not just whatever this one request happened to send.
    await assertTermWithinSession(
      req.body.sessionId ?? existing.sessionId,
      req.body.startDate ?? existing.startDate,
      req.body.endDate ?? existing.endDate,
    );
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

// A term's dates must fall within its parent session's dates - can't be
// expressed in the Zod schema alone since it needs a DB lookup. Formats
// dates as plain YYYY-MM-DD (not toLocaleDateString) so the message reads
// the same regardless of server locale.
async function assertTermWithinSession(sessionId, startDate, endDate) {
  const session = await prisma.academicSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    const err = new Error('Selected academic session does not exist.');
    err.statusCode = 400;
    throw err;
  }
  if (startDate < session.startDate || endDate > session.endDate) {
    const fmt = (d) => d.toISOString().slice(0, 10);
    const err = new Error(
      `Term dates must fall within the session's dates (${fmt(session.startDate)} to ${fmt(session.endDate)}).`,
    );
    err.statusCode = 400;
    throw err;
  }
}

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
