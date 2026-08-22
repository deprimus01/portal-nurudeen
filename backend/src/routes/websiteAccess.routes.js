import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { requireOAuthAuth, requireWebsiteClaim } from '../middleware/oauthAuth.js';
import { oauthRateLimiter } from '../middleware/rateLimit.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { updateWebsiteClaimsSchema } from '../validation/websiteAccess.schema.js';
import { toApiClaim, toDbClaim } from '../lib/websiteClaims.js';

const router = Router();

// Both routes here are called by the CMS's own backend, server-to-server,
// carrying the visiting SMS admin's OAuth access token — never called
// directly by a browser. ADR-001 §252: "there is no 'Add Staff' flow in
// the CMS that creates a new login... the CMS's only staff-facing action
// is granting or revoking website claims for an SMS account that already
// exists." Accordingly this is read-only against the user directory
// itself (search only, never create/edit a User row) and the only
// mutation is the claims list.
router.use(oauthRateLimiter, requireOAuthAuth, requireWebsiteClaim('website_access_manage'));

function displayName(user) {
  return user.staff ? `${user.staff.firstName} ${user.staff.lastName}` : null;
}

// GET /api/admin/website-access/users?query=<term>
// Search is scoped to ADMIN/TEACHER roles only — website content
// management is a staff function, and there's no reason this CMS-facing
// endpoint should ever be able to browse guardian or student accounts.
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';

    const users = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'TEACHER'] },
        isActive: true,
        ...(query
          ? {
              OR: [
                { email: { contains: query, mode: 'insensitive' } },
                { staff: { firstName: { contains: query, mode: 'insensitive' } } },
                { staff: { lastName: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { staff: true, websiteClaims: true },
      orderBy: { email: 'asc' },
      take: 20,
    });

    return res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: displayName(u),
        role: u.role,
        claims: u.websiteClaims.map((c) => toApiClaim(c.claim)),
      })),
    });
  }),
);

// PATCH /api/admin/website-access/users/:id/claims
// Body is the complete desired claim set (see websiteAccess.schema.js) —
// this route diffs it against what's stored and applies only the delta.
router.patch(
  '/users/:id/claims',
  validateBody(updateWebsiteClaimsSchema),
  asyncHandler(async (req, res) => {
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { staff: true, websiteClaims: true },
    });

    if (!targetUser || !['ADMIN', 'TEACHER'].includes(targetUser.role)) {
      // Same shape whether the id doesn't exist or belongs to a
      // guardian/student — no reason to distinguish those for the CMS.
      return res.status(404).json({ error: 'User not found.' });
    }

    const current = new Set(targetUser.websiteClaims.map((c) => c.claim));
    const desired = new Set(req.body.claims.map(toDbClaim));

    const toAdd = [...desired].filter((c) => !current.has(c));
    const toRemove = [...current].filter((c) => !desired.has(c));

    if (toAdd.length > 0 || toRemove.length > 0) {
      await prisma.$transaction([
        ...(toRemove.length > 0
          ? [prisma.websiteClaim.deleteMany({ where: { userId: targetUser.id, claim: { in: toRemove } } })]
          : []),
        ...(toAdd.length > 0
          ? [
              prisma.websiteClaim.createMany({
                data: toAdd.map((claim) => ({ userId: targetUser.id, claim, grantedById: req.oauthUser.id })),
              }),
            ]
          : []),
      ]);

      await logAction({
        userId: req.oauthUser.id,
        action: 'website_claim.update',
        entityType: 'WebsiteClaim',
        entityId: targetUser.id,
        metadata: { added: toAdd.map(toApiClaim), removed: toRemove.map(toApiClaim) },
      });
    }

    return res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: displayName(targetUser),
        role: targetUser.role,
        claims: [...desired].map(toApiClaim),
      },
    });
  }),
);

export default router;
