import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createGuardianSchema, updateGuardianSchema } from '../validation/student.schema.js';

const router = Router();

router.use(requireAuth);

const guardianInclude = {
  studentGuardians: { include: { student: true } },
  user: { select: { id: true, email: true, mustResetPassword: true, lastLoginAt: true } },
};

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const guardians = await prisma.guardian.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: guardianInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return res.json(guardians);
  }),
);

router.get(
  '/:id',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const guardian = await prisma.guardian.findUnique({
      where: { id: req.params.id },
      include: guardianInclude,
    });
    if (!guardian) return res.status(404).json({ error: 'Guardian not found.' });
    return res.json(guardian);
  }),
);

// Standalone creation — mainly for adding a guardian ahead of enrolling a
// student, so they can be picked from a list instead of typed inline.
router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createGuardianSchema),
  asyncHandler(async (req, res) => {
    const guardian = await prisma.guardian.create({ data: req.body });

    await logAction({
      userId: req.user.id,
      action: 'guardian.create',
      entityType: 'Guardian',
      entityId: guardian.id,
    });

    return res.status(201).json(guardian);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(updateGuardianSchema),
  asyncHandler(async (req, res) => {
    const guardian = await prisma.guardian.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await logAction({
      userId: req.user.id,
      action: 'guardian.update',
      entityType: 'Guardian',
      entityId: guardian.id,
      metadata: req.body,
    });

    return res.json(guardian);
  }),
);

export default router;
