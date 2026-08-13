import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, generateTempPassword } from '../lib/auth.js';
import { createStudentWithGuardians } from '../lib/createStudent.js';
import { logAction } from '../lib/auditLog.js';
import { notifyNewAccount } from '../lib/notify.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createStudentSchema, updateStudentSchema } from '../validation/student.schema.js';

const router = Router();

router.use(requireAuth);

const studentInclude = {
  currentClass: true,
  studentGuardians: { include: { guardian: true } },
  user: { select: { id: true, email: true, mustResetPassword: true, lastLoginAt: true } },
};

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { search, classId, status } = req.query;

    const students = await prisma.student.findMany({
      where: {
        status: status || undefined,
        currentClassId: classId || undefined,
        OR: search
          ? [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { admissionNumber: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: studentInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return res.json(students);
  }),
);

router.get(
  '/:id',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { ...studentInclude, enrollments: { include: { class: true, term: true } } },
    });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    return res.json(student);
  }),
);

// Creates the student record, links/creates guardians, and auto-provisions
// a portal account per guardian who doesn't already have one — PRD §1.6:
// "Student enrolled by admin → guardian account(s) auto-generated and
// linked to that student." Temp passwords are returned in the response for
// the admin to relay too; delivery also goes out over both email (Resend)
// and SMS (Termii) — see lib/notify.js.
router.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createStudentSchema),
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction((tx) => createStudentWithGuardians(tx, req.body));

    await Promise.allSettled(
      result.provisionedCredentials.map((c) =>
        notifyNewAccount({
          recipientType: 'guardian',
          recipientId: c.guardianId,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
          tempPassword: c.tempPassword,
          accountType: 'Guardian',
        }),
      ),
    );

    await logAction({
      userId: req.user.id,
      action: 'student.create',
      entityType: 'Student',
      entityId: result.student.id,
    });

    return res.status(201).json(result);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateBody(updateStudentSchema),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: req.body,
      include: studentInclude,
    });

    await logAction({
      userId: req.user.id,
      action: 'student.update',
      entityType: 'Student',
      entityId: student.id,
      metadata: req.body,
    });

    return res.json(student);
  }),
);

// Soft-delete: students are never hard-deleted (results/attendance/fee
// history must be preserved). "Removing" a student sets status WITHDRAWN.
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { status: 'WITHDRAWN' },
    });

    await logAction({
      userId: req.user.id,
      action: 'student.withdraw',
      entityType: 'Student',
      entityId: student.id,
    });

    return res.json({ ok: true });
  }),
);

// Student portal accounts are optional at launch (PRD §1.5) and not
// auto-created on enrollment like guardian accounts — admin provisions one
// on request. Students have no email field in the schema (most won't have
// one), so the login identifier is a synthetic address derived from their
// admission number on the school's own domain — never a real mailbox, just
// a stable, unique login handle reusing the existing email+password auth
// flow without changes. The temp password is still relayed manually today,
// same as every other credential in this system.
router.post(
  '/:id/provision-account',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const existing = await prisma.user.findUnique({ where: { studentId: student.id } });
    if (existing) {
      return res.status(409).json({ error: 'This student already has a portal account.' });
    }

    // Login domain is configurable so this doesn't need a code change once
    // the real domain is purchased and connected — just set
    // STUDENT_LOGIN_EMAIL_DOMAIN on the deployment and it takes effect
    // immediately. Defaults to a clearly non-resolving placeholder for
    // now; this address is never actually emailed to either way (see
    // comment above this route), so the exact domain has no functional
    // impact until you update it.
    const loginDomain = process.env.STUDENT_LOGIN_EMAIL_DOMAIN || 'students.portal.local';
    const loginEmail = `${student.admissionNumber.toLowerCase()}@${loginDomain}`;
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.create({
      data: {
        email: loginEmail,
        passwordHash,
        role: 'STUDENT',
        studentId: student.id,
        mustResetPassword: true,
      },
    });

    await prisma.notificationLog.create({
      data: {
        recipientType: 'student',
        recipientId: student.id,
        channel: 'SMS',
        message: `Student portal account ready. Login: ${loginEmail} / Temp password: ${tempPassword}`,
        status: 'PENDING',
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'student.provisionAccount',
      entityType: 'Student',
      entityId: student.id,
    });

    return res.status(201).json({ loginEmail, tempPassword });
  }),
);

export default router;
