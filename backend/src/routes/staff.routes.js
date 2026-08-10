import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, generateTempPassword } from '../lib/auth.js';
import { logAction } from '../lib/auditLog.js';
import { notifyNewAccount } from '../lib/notify.js';
import { notifyNewStaff } from '../lib/notifications.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createStaffSchema, updateStaffSchema } from '../validation/staff.schema.js';

const router = Router();

router.use(requireAuth);

const staffInclude = {
  staffSubjects: { include: { subject: true } },
  staffClasses: { include: { class: true } },
  user: { select: { id: true, email: true, mustResetPassword: true, lastLoginAt: true } },
};

router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const staff = await prisma.staff.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { employeeId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: staffInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return res.json(staff);
  }),
);

router.get(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: staffInclude,
    });
    if (!staff) return res.status(404).json({ error: 'Staff record not found.' });
    return res.json(staff);
  }),
);

// Staff accounts are provisioned directly on creation (not tied to an
// enrollment event like guardians) — PRD §1.6: "Teacher/staff accounts
// created directly by admin as part of staff onboarding."
router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createStaffSchema),
  asyncHandler(async (req, res) => {
    const { subjectIds, classIds, email, ...staffData } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to provision a staff account.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          ...staffData,
          email,
          staffSubjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
          staffClasses: { create: classIds.map((classId) => ({ classId })) },
        },
        include: staffInclude,
      });

      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      const userRole = staff.role === 'ADMIN' ? 'ADMIN' : 'TEACHER';

      await tx.user.create({
        data: {
          email,
          passwordHash,
          role: userRole,
          staffId: staff.id,
          mustResetPassword: true,
        },
      });

      return { staff, tempPassword };
    });

    await notifyNewAccount({
      recipientType: 'staff',
      recipientId: result.staff.id,
      name: `${result.staff.firstName} ${result.staff.lastName}`,
      email,
      phone: result.staff.phone,
      tempPassword: result.tempPassword,
      accountType: result.staff.role === 'ADMIN' ? 'Admin' : 'Staff',
    });

    await logAction({
      userId: req.user.id,
      action: 'staff.create',
      entityType: 'Staff',
      entityId: result.staff.id,
    });

    await notifyNewStaff({
      actorUserId: req.user.id,
      staffName: `${result.staff.firstName} ${result.staff.lastName}`,
      staffRole: result.staff.role,
    });

    return res.status(201).json(result);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(updateStaffSchema),
  asyncHandler(async (req, res) => {
    const { subjectIds, classIds, ...staffData } = req.body;

    const staff = await prisma.$transaction(async (tx) => {
      if (subjectIds) {
        await tx.staffSubject.deleteMany({ where: { staffId: req.params.id } });
        await tx.staffSubject.createMany({
          data: subjectIds.map((subjectId) => ({ staffId: req.params.id, subjectId })),
        });
      }
      if (classIds) {
        await tx.staffClass.deleteMany({ where: { staffId: req.params.id } });
        await tx.staffClass.createMany({
          data: classIds.map((classId) => ({ staffId: req.params.id, classId })),
        });
      }
      return tx.staff.update({
        where: { id: req.params.id },
        data: staffData,
        include: staffInclude,
      });
    });

    await logAction({
      userId: req.user.id,
      action: 'staff.update',
      entityType: 'Staff',
      entityId: staff.id,
      metadata: req.body,
    });

    return res.json(staff);
  }),
);

export default router;
