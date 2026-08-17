import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { hashPassword, generateTempPassword } from '../lib/auth.js';
import { logAction } from '../lib/auditLog.js';
import { notifyPasswordReset, notifyStudentPasswordReset, findNotifiableGuardianForStudent, loadProfileForUser } from '../lib/notify.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { passwordResetRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);


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

    // Students have no real email/phone of their own — same reasoning as
    // provision-account in students.routes.js — so their reset OTP is
    // relayed through a guardian instead of attempted against the
    // synthetic login address.
    if (profile.recipientType === 'student') {
      const guardian = await findNotifiableGuardianForStudent(profile.recipientId);
      if (guardian) {
        await notifyStudentPasswordReset({
          studentId: profile.recipientId,
          studentName: profile.name,
          guardianName: `${guardian.firstName} ${guardian.lastName}`,
          guardianEmail: guardian.email,
          guardianPhone: guardian.phone,
          loginEmail: user.email,
          tempPassword,
        });
      }
    } else {
      await notifyPasswordReset({
        recipientType: profile.recipientType,
        recipientId: profile.recipientId,
        name: profile.name,
        email: user.email,
        phone: profile.phone,
        tempPassword,
        accountType: profile.accountType,
      });
    }

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
