import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { guardianStudentIds } from '../lib/guardianOwnership.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import {
  createFeeStructureSchema,
  generateInvoicesSchema,
  recordPaymentSchema,
} from '../validation/fees.schema.js';

const router = Router();

router.use(requireAuth);

// PRD Roles & Permissions: "View / pay fees" is Admin (yes) and Parent
// (own child only) — Teacher has no fee visibility at all, unlike
// attendance/results. That's why every route below is ADMIN/GUARDIAN only.

function statusFromPayments(totalPaid, invoiceAmount) {
  if (totalPaid <= 0) return 'PENDING';
  if (totalPaid >= invoiceAmount) return 'PAID';
  return 'PARTIALLY_PAID';
}

// ---- Fee structures ----

router.get(
  '/structures',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { classId, termId } = req.query;
    const structures = await prisma.feeStructure.findMany({
      where: { classId: classId || undefined, termId: termId || undefined },
      include: { class: true, term: { include: { session: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(structures);
  }),
);

router.post(
  '/structures',
  requireRole('ADMIN'),
  validateBody(createFeeStructureSchema),
  asyncHandler(async (req, res) => {
    const structure = await prisma.feeStructure.create({
      data: req.body,
      include: { class: true, term: { include: { session: true } } },
    });
    await logAction({
      userId: req.user.id,
      action: 'feeStructure.create',
      entityType: 'FeeStructure',
      entityId: structure.id,
    });
    return res.status(201).json(structure);
  }),
);

// ---- Invoices ----

const invoiceInclude = {
  student: true,
  term: { include: { session: true } },
  payments: true,
};

router.get(
  '/invoices',
  requireRole('ADMIN', 'GUARDIAN'),
  asyncHandler(async (req, res) => {
    const { termId, classId } = req.query;

    let where;
    if (req.user.role === 'ADMIN') {
      where = {
        termId: termId || undefined,
        student: classId ? { currentClassId: classId } : undefined,
      };
    } else {
      const studentIds = await guardianStudentIds(req.user);
      where = { studentId: { in: studentIds }, termId: termId || undefined };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return res.json(invoices);
  }),
);

// Bulk-generates one invoice per actively-enrolled student in a class/term,
// summing that class/term's fee structures for the amount. Skips students
// who already have an invoice for this term, so it's safe to re-run (e.g.
// after adding a late-enrolling student) without duplicating charges.
router.post(
  '/invoices/generate',
  requireRole('ADMIN'),
  validateBody(generateInvoicesSchema),
  asyncHandler(async (req, res) => {
    const { classId, termId, dueDate } = req.body;

    const structures = await prisma.feeStructure.findMany({ where: { classId, termId } });
    if (structures.length === 0) {
      return res.status(400).json({ error: 'No fee structure exists for this class/term yet.' });
    }
    const totalAmount = structures.reduce((sum, s) => sum + s.amount, 0);

    const enrollments = await prisma.enrollment.findMany({
      where: { classId, termId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const existingInvoices = await prisma.invoice.findMany({
      where: { termId, studentId: { in: enrollments.map((e) => e.studentId) } },
      select: { studentId: true },
    });
    const alreadyInvoiced = new Set(existingInvoices.map((i) => i.studentId));

    const toCreate = enrollments
      .map((e) => e.studentId)
      .filter((studentId) => !alreadyInvoiced.has(studentId));

    if (toCreate.length === 0) {
      return res.json({ created: 0, message: 'Every enrolled student already has an invoice for this term.' });
    }

    await prisma.invoice.createMany({
      data: toCreate.map((studentId) => ({
        studentId,
        termId,
        amount: totalAmount,
        dueDate,
        status: 'PENDING',
      })),
    });

    await logAction({
      userId: req.user.id,
      action: 'invoice.generate',
      entityType: 'Invoice',
      metadata: { classId, termId, count: toCreate.length, amount: totalAmount },
    });

    return res.status(201).json({ created: toCreate.length });
  }),
);

// ---- Payments ----

router.post(
  '/payments',
  requireRole('ADMIN'),
  validateBody(recordPaymentSchema),
  asyncHandler(async (req, res) => {
    const { invoiceId, amount, method, reference } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: { invoiceId, amount, method, reference } });

      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
      const status = statusFromPayments(totalPaid, invoice.amount);

      return tx.invoice.update({
        where: { id: invoiceId },
        data: { status },
        include: invoiceInclude,
      });
    });

    await logAction({
      userId: req.user.id,
      action: 'payment.record',
      entityType: 'Invoice',
      entityId: invoiceId,
      metadata: { amount, method },
    });

    return res.status(201).json(updated);
  }),
);

export default router;
