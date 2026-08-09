import { prisma } from '../lib/prisma.js';
import { verifySessionToken } from '../lib/auth.js';

// Every protected route runs this first. It independently re-verifies the
// token and re-fetches the user's current role/active status from the DB
// on every request — PRD §2.4: "Every protected route independently
// re-checks the authenticated user's role before acting, regardless of
// what the UI shows." We don't trust the JWT's embedded role alone in case
// it was revoked/changed since the token was issued.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const payload = verifySessionToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Session is no longer valid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

// Usage: requireRole('ADMIN') or requireRole('ADMIN', 'TEACHER')
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}
