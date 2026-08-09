import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// Surfaces the NotificationLog table — previously write-only from the
// admin's perspective (see lib/notify.js: every send/failure is logged,
// but nothing ever read it back). Without this, a misconfigured sender
// (e.g. Resend's sandbox address, which can only deliver to the account
// owner's own inbox) fails silently: the request that triggered the email
// still succeeds, so there's no error anywhere in the UI — just a staff
// member who never got their credentials.
router.get(
  '/log',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { status, limit } = req.query;
    const take = Math.min(Number(limit) || 50, 200);

    const entries = await prisma.notificationLog.findMany({
      where: status ? { status: String(status).toUpperCase() } : undefined,
      orderBy: { sentAt: 'desc' },
      take,
    });

    const failedCount = await prisma.notificationLog.count({ where: { status: 'FAILED' } });

    return res.json({ entries, failedCount });
  }),
);

export default router;
