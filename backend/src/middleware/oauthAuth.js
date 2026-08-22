import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/oauthTokens.js';
import { getUserWebsiteClaims } from '../lib/websiteClaims.js';

// Parallel to middleware/auth.js's requireAuth, but for the CMS's
// server-to-server calls bearing an OAuth access token (RS256, verified
// against the OAuth key pair) rather than SMS's own session token
// (symmetric JWT_SECRET). These are two different token audiences and
// must never be interchangeable — requireAuth would silently reject an
// OAuth token anyway (wrong secret/algorithm), but this exists so
// website-access routes are explicit about which one they expect, the
// same way requireAuth is explicit for SMS's own routes.
//
// Same "never trust the embedded copy alone" principle as requireAuth:
// re-fetches the user and their current claims fresh on every request,
// since website-access-management is exactly the kind of route where a
// stale claim would matter most.
export async function requireOAuthAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Missing bearer token.' });
    }

    const payload = verifyAccessToken(token);

    const clientId = process.env.OAUTH_CMS_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Token was not issued for this client.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Account is no longer active.' });
    }

    const claims = await getUserWebsiteClaims(user.id);
    req.oauthUser = user;
    req.oauthClaims = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token is invalid or expired.' });
  }
}

// Usage: requireWebsiteClaim('website_access_manage')
export function requireWebsiteClaim(claim) {
  return (req, res, next) => {
    if (!req.oauthClaims) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Missing bearer token.' });
    }
    if (!req.oauthClaims.includes(claim)) {
      return res.status(403).json({ error: 'insufficient_scope', error_description: `Missing required claim: ${claim}.` });
    }
    next();
  };
}
