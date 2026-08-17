import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, signSessionToken, generateTempPassword } from '../lib/auth.js';
import { logAction } from '../lib/auditLog.js';
import { notifyPasswordReset, notifyStudentPasswordReset, findNotifiableGuardianForStudent, loadProfileForUser } from '../lib/notify.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimit.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, updateContactSchema, updatePreferencesSchema } from '../validation/auth.schema.js';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic error whether the email doesn't exist or the password
    // is wrong — never reveal which one, that's an enumeration leak.
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await logAction({ userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id });

    const token = signSessionToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
      },
    });
  }),
);

// Self-service "forgot password". Deliberately generic in what it reveals:
// the response is identical whether or not the email matches an account,
// so this can't be used to check who has a portal login (PRD §2.4 rate
// limiting + this response shape are the two mitigations for a public,
// unauthenticated endpoint). Reuses the exact same OTP + mustResetPassword
// machinery as admin-triggered force-reset (users.routes.js) — a fresh
// account and "I forgot mine" are the same underlying operation, just
// triggered by a different actor. Students relay through their guardian,
// same reasoning as everywhere else this comes up (Student has no
// email/phone of its own — see schema.prisma).
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const GENERIC_RESPONSE = { ok: true, message: 'If an account exists for that email, a login code has been sent to it.' };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.json(GENERIC_RESPONSE);
    }

    const profile = await loadProfileForUser(user);
    if (!profile) {
      // Same defensive fallback as force-reset-password — every User
      // should link to exactly one profile, but don't 500 a public
      // endpoint over inconsistent data. Just decline to send anything.
      return res.json(GENERIC_RESPONSE);
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustResetPassword: true },
    });

    // Fire-and-forget from here down: outbound email/SMS calls can take
    // seconds, and awaiting them would make this endpoint's response time
    // a much bigger tell for "does this email have an account" than
    // bcrypt's fixed ~100ms already is. notifyPasswordReset/
    // notifyStudentPasswordReset are internally fire-and-forget-safe
    // (never throw, always log to NotificationLog), so nothing here needs
    // the result.
    if (profile.recipientType === 'student') {
      findNotifiableGuardianForStudent(profile.recipientId)
        .then((guardian) => {
          if (!guardian) return;
          return notifyStudentPasswordReset({
            studentId: profile.recipientId,
            studentName: profile.name,
            guardianName: `${guardian.firstName} ${guardian.lastName}`,
            guardianEmail: guardian.email,
            guardianPhone: guardian.phone,
            loginEmail: user.email,
            tempPassword,
          });
        })
        .catch(() => {});
    } else {
      notifyPasswordReset({
        recipientType: profile.recipientType,
        recipientId: profile.recipientId,
        name: profile.name,
        email: user.email,
        phone: profile.phone,
        tempPassword,
        accountType: profile.accountType,
      }).catch(() => {});
    }

    await logAction({
      userId: user.id,
      action: 'auth.forgot_password_requested',
      entityType: 'User',
      entityId: user.id,
    });

    return res.json(GENERIC_RESPONSE);
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;

    // Pull the role-specific profile so the frontend has a display name
    // without a second round trip.
    let profile = null;
    if (user.role === 'ADMIN' || user.role === 'TEACHER') {
      profile = await prisma.staff.findUnique({
        where: { id: user.staffId },
        include: {
          staffClasses: { include: { class: true } },
          staffSubjects: { include: { subject: true } },
        },
      });
    } else if (user.role === 'GUARDIAN') {
      profile = await prisma.guardian.findUnique({
        where: { id: user.guardianId },
        include: {
          studentGuardians: { include: { student: { include: { currentClass: true } } } },
        },
      });
    } else if (user.role === 'STUDENT') {
      profile = await prisma.student.findUnique({
        where: { id: user.studentId },
        include: { currentClass: true },
      });
    }

    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
      profile,
      notificationPreferences: {
        emailAnnouncements: user.notifyEmailAnnouncements,
        smsAnnouncements: user.notifySmsAnnouncements,
        emailMessages: user.notifyEmailMessages,
        smsMessages: user.notifySmsMessages,
      },
    });
  }),
);

router.post(
  '/reset-password',
  requireAuth,
  passwordResetRateLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustResetPassword: false },
    });

    await logAction({ userId: user.id, action: 'auth.password_reset', entityType: 'User', entityId: user.id });

    return res.json({ ok: true });
  }),
);

// Self-service contact info — phone/email for staff and guardians (the
// role-managed records), address for guardians only. Students have no
// editable contact fields on their own record (Student has no phone/
// email), so this route 404s for them rather than silently no-opping.
router.patch(
  '/me/contact',
  requireAuth,
  validateBody(updateContactSchema),
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { phone, email, address } = req.body;

    let updated;
    if (user.role === 'ADMIN' || user.role === 'TEACHER') {
      if (!user.staffId) return res.status(404).json({ error: 'No staff record on this account.' });
      updated = await prisma.staff.update({
        where: { id: user.staffId },
        data: { ...(phone !== undefined && { phone }), ...(email !== undefined && { email }) },
      });
    } else if (user.role === 'GUARDIAN') {
      if (!user.guardianId) return res.status(404).json({ error: 'No guardian record on this account.' });
      updated = await prisma.guardian.update({
        where: { id: user.guardianId },
        data: {
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
          ...(address !== undefined && { address }),
        },
      });
    } else {
      return res.status(404).json({ error: 'There is no editable contact info for this account type.' });
    }

    await logAction({ userId: user.id, action: 'auth.contact_updated', entityType: 'User', entityId: user.id });

    return res.json(updated);
  }),
);

router.patch(
  '/me/preferences',
  requireAuth,
  validateBody(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { notifyEmailAnnouncements, notifySmsAnnouncements, notifyEmailMessages, notifySmsMessages } = req.body;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(notifyEmailAnnouncements !== undefined && { notifyEmailAnnouncements }),
        ...(notifySmsAnnouncements !== undefined && { notifySmsAnnouncements }),
        ...(notifyEmailMessages !== undefined && { notifyEmailMessages }),
        ...(notifySmsMessages !== undefined && { notifySmsMessages }),
      },
    });

    await logAction({ userId: user.id, action: 'auth.preferences_updated', entityType: 'User', entityId: user.id });

    return res.json({
      emailAnnouncements: updated.notifyEmailAnnouncements,
      smsAnnouncements: updated.notifySmsAnnouncements,
      emailMessages: updated.notifyEmailMessages,
      smsMessages: updated.notifySmsMessages,
    });
  }),
);

export default router;
