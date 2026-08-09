import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, signSessionToken } from '../lib/auth.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimit.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { loginSchema, resetPasswordSchema } from '../validation/auth.schema.js';

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

export default router;
