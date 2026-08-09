import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createGradingSchemeSchema } from '../validation/results.schema.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const schemes = await prisma.gradingScheme.findMany({
      include: { bands: { orderBy: { minScore: 'desc' } } },
      orderBy: { name: 'asc' },
    });
    return res.json(schemes);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createGradingSchemeSchema),
  asyncHandler(async (req, res) => {
    const { bands, ...schemeData } = req.body;
    const scheme = await prisma.gradingScheme.create({
      data: { ...schemeData, bands: { create: bands } },
      include: { bands: true },
    });

    await logAction({
      userId: req.user.id,
      action: 'gradingScheme.create',
      entityType: 'GradingScheme',
      entityId: scheme.id,
    });

    return res.status(201).json(scheme);
  }),
);

export default router;
