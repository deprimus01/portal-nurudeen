import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, generateTempPassword } from '../lib/auth.js';
import { createStudentWithGuardians } from '../lib/createStudent.js';
import { logAction } from '../lib/auditLog.js';
import { notifyNewAccount, notifyNewStudentAccount, findNotifiableGuardianForStudent } from '../lib/notify.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createStudentSchema, updateStudentSchema } from '../validation/student.schema.js';
import { generateStudentLoginEmail } from '../lib/studentLogin.js';
import { buildNameDisambiguationTags } from '../lib/nameDisambiguation.js';

const router = Router();

router.use(requireAuth);

const studentInclude = {
  currentClass: true,
  studentGuardians: { include: { guardian: true } },
  user: { select: { id: true, email: true, mustResetPassword: true, lastLoginAt: true } },
};

function buildOrderBy(sortKey, sortDir) {
  const desc = sortDir === 'desc';
  switch (sortKey) {
    case 'class':
      return [{ currentClass: { name: desc ? 'desc' : 'asc' } }];
    case 'status':
      return [{ status: desc ? 'desc' : 'asc' }];
    case 'name':
    default:
      return [{ lastName: desc ? 'desc' : 'asc' }, { firstName: desc ? 'desc' : 'asc' }];
  }
}

router.get(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { search, classId, status, page, pageSize, sortKey, sortDir } = req.query;

    const where = {
      status: status || undefined,
      currentClassId: classId || undefined,
      OR: search
        ? [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    // Legacy contract: no `page` param -> full unpaginated array, exactly
    // as this endpoint has always behaved. Nothing currently calls it
    // this way except the Enrollments picker's own smaller-scope search,
    // but keeping it means nothing depending on the old shape breaks
    // while the Students page migrates to the paginated contract below.
    if (!page) {
      const students = await prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      const tags = buildNameDisambiguationTags(students, { classKeyOf: (s) => s.currentClassId });
      const withTags = students.map((s) => ({ ...s, nameTag: tags.get(s.id) || '' }));
      return res.json(withTags);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
    const skip = (pageNum - 1) * take;
    const orderBy = buildOrderBy(sortKey, sortDir);

    const [total, students, allMatchingForTags] = await prisma.$transaction([
      prisma.student.count({ where }),
      prisma.student.findMany({ where, include: studentInclude, orderBy, skip, take }),
      // A second, much lighter pass (3 scalar fields, no joins) over
      // every student matching the current search/filter — not just this
      // page — so name-collision tags ("John Doe · 2") stay correct even
      // when the two colliding students land on different pages. Without
      // this, disambiguation would silently only work within a single
      // page of results.
      prisma.student.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, currentClassId: true, admissionNumber: true },
      }),
    ]);

    const tags = buildNameDisambiguationTags(allMatchingForTags, { classKeyOf: (s) => s.currentClassId });
    const withTags = students.map((s) => ({ ...s, nameTag: tags.get(s.id) || '' }));

    return res.json({ data: withTags, total, page: pageNum, pageSize: take });
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
// name — see lib/studentLogin.js for the exact rule and the reasoning
// behind it. Never a real mailbox, just a stable, unique login handle
// reusing the existing email+password auth flow without changes. The OTP
// itself IS delivered automatically though — relayed to the student's
// guardian (see findNotifiableGuardianForStudent), since that's the only
// real inbox/phone on file for a student.
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

    const loginEmail = await generateStudentLoginEmail(prisma, student.firstName, student.lastName);
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

    const guardian = await findNotifiableGuardianForStudent(student.id);
    if (guardian) {
      await notifyNewStudentAccount({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        guardianName: `${guardian.firstName} ${guardian.lastName}`,
        guardianEmail: guardian.email,
        guardianPhone: guardian.phone,
        loginEmail,
        tempPassword,
      });
    } else {
      // No guardian on file at all — shouldn't happen (enrollment
      // requires at least one), but don't block account creation over
      // it. Log it the same way notify.js does for a fully-failed send,
      // so it still surfaces in the admin's system activity feed.
      await prisma.notificationLog.create({
        data: {
          recipientType: 'student',
          recipientId: student.id,
          channel: 'EMAIL',
          message: 'Student portal account ready — no guardian on file to relay the OTP to.',
          status: 'FAILED',
          errorDetail: 'No linked guardian found.',
        },
      });
    }

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
