import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireCronSecret } from '../middleware/cronAuth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// PRD §5 gap: InvoiceStatus.OVERDUE is defined in the schema but nothing
// ever transitions a PENDING/PARTIALLY_PAID invoice into it after its due
// date passes. Intended to be hit by a daily scheduled job (see
// .github/workflows/mark-invoices-overdue.yml) — not user-triggered, so it
// sits behind requireCronSecret rather than requireAuth/requireRole.
//
// PAID invoices are untouched regardless of due date (nothing to chase).
// An invoice that later receives a payment is recomputed by
// fees.routes.js's statusFromPayments() on that request — this job only
// handles the "time passed, nothing happened" direction.
//
// Not logged to AuditLog: that table's userId is a required, non-nullable
// relation to a real admin User, and attributing an automated transition
// to a specific admin would be misleading in the audit trail. The response
// body (count + IDs) is the record of what this run did.
router.post(
  '/mark-overdue-invoices',
  requireCronSecret,
  asyncHandler(async (req, res) => {
    const overdue = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
      select: { id: true },
    });

    if (overdue.length === 0) {
      return res.json({ updated: 0, invoiceIds: [] });
    }

    await prisma.invoice.updateMany({
      where: { id: { in: overdue.map((i) => i.id) } },
      data: { status: 'OVERDUE' },
    });

    return res.json({ updated: overdue.length, invoiceIds: overdue.map((i) => i.id) });
  }),
);

// Smart Student Import — purges expired batches (and their cascaded
// ImportRecord rows, which hold raw uploaded student data as JSON) past
// their retention window. PRD/TRD §8 / §11.1: uploaded student data is
// temporary and must not be retained indefinitely. Not logged to
// AuditLog for the same reason mark-overdue-invoices isn't — this is an
// automated transition, not attributable to a specific admin.
router.post(
  '/purge-expired-imports',
  requireCronSecret,
  asyncHandler(async (req, res) => {
    const expired = await prisma.importBatch.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true },
    });

    if (expired.length === 0) {
      return res.json({ purged: 0, batchIds: [] });
    }

    await prisma.importBatch.deleteMany({ where: { id: { in: expired.map((b) => b.id) } } }); // cascades to ImportRecord

    return res.json({ purged: expired.length, batchIds: expired.map((b) => b.id) });
  }),
);

export default router;
