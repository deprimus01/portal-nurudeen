import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, generateTempPassword } from '../lib/auth.js';
import { logAction } from '../lib/auditLog.js';
import { notifyPasswordReset } from '../lib/notify.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { passwordResetRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// Resolves the display name + notification routing for whichever profile
// this User is attached to (Staff / Guardian / Student — see the three
// optional 1:1 relations on User in schema.prisma). Kept local to this
// route rather than reused from notify.js's recipientRefForUser because
// this also needs a human name and an accountType label for the email.
async function loadProfileForUser(user) {
  if (user.staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: user.staffId } });
    return {
      name: `${staff.firstName} ${staff.lastName}`,
      recipientType: 'staff',
      recipientId: staff.id,
      phone: staff.phone,
      accountType: staff.role === 'ADMIN' ? 'Admin' : 'Staff',
    };
  }
  if (user.guardianId) {
    const guardian = await prisma.guardian.findUnique({ where: { id: user.guardianId } });
    return {
      name: `${guardian.firstName} ${guardian.lastName}`,
      recipientType: 'guardian',
      recipientId: guardian.id,
      phone: guardian.phone,
      accountType: 'Guardian',
    };
  }
  if (user.studentId) {
    const student = await prisma.student.findUnique({ where: { id: user.studentId } });
    return {
      name: `${student.firstName} ${student.lastName}`,
      recipientType: 'student',
      recipientId: student.id,
      accountType: 'Student',
    };
  }
  return null;
}

// Closes the recovery gap flagged during the auth audit: there was no way
// to regain access to an account once its one-time temp-password banner
// was dismissed, since only a bcrypt hash is stored (auth.js) and the only
// self-serve reset route requires already knowing the current password
// (auth.routes.js POST /reset-password). This generates a fresh temp
// password, flags mustResetPassword so the recipient is forced to change
// it on next login (same as a brand-new account), and returns it once in
// the response for the admin to relay — mirroring how initial account
// creation already works in staff.routes.js / students.routes.js.
router.post(
  '/:id/force-reset-password',
  requireRole('ADMIN'),
  passwordResetRateLimiter,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const profile = await loadProfileForUser(user);
    if (!profile) {
      // Shouldn't happen — every User row is required to link to exactly
      // one of Staff/Guardian/Student — but fail loudly rather than
      // sending an email with no name if the data is ever inconsistent.
      return res.status(409).json({ error: 'This account has no linked profile.' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustResetPassword: true },
    });

    await notifyPasswordReset({
      recipientType: profile.recipientType,
      recipientId: profile.recipientId,
      name: profile.name,
      email: user.email,
      phone: profile.phone,
      tempPassword,
      accountType: profile.accountType,
    });

    await logAction({
      userId: req.user.id,
      action: 'user.forcePasswordReset',
      entityType: 'User',
      entityId: user.id,
    });

    return res.json({
      email: user.email,
      tempPassword,
      name: profile.name,
      accountType: profile.accountType,
    });
  }),
);

export default router;
