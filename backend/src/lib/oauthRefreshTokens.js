import { randomBytes } from 'node:crypto';

// Same single-process caveat as oauthCodes.js — see that file's comment.
// Refresh tokens are longer-lived (30 days) than authorization codes, so
// losing them on a restart/redeploy is more noticeable, but the effect
// is only "the CMS's background session-refresh fails once and it sends
// the person through /oauth/authorize again" — consistent with ADR-001
// §9's stated tolerance ("if SMS is down... new logins fail; already-
// authenticated CMS sessions continue until their access token expires").
// Move to a durable store only if that turns out to be too disruptive in
// practice.

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const tokens = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokens) {
    if (entry.expiresAt < now) tokens.delete(token);
  }
}, 60 * 60 * 1000).unref();

function mint(userId, clientId) {
  const token = randomBytes(32).toString('base64url');
  tokens.set(token, { userId, clientId, expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS });
  return token;
}

export function mintRefreshToken({ userId, clientId }) {
  return mint(userId, clientId);
}

// Rotation (issue a new refresh token and invalidate the old one on every
// use) is a standard defense against a leaked refresh token being reused
// silently — if the legitimate client's next refresh fails because the
// token was already consumed by someone else, that's a detectable signal
// rather than a silent compromise. Returns null if the token is missing,
// expired, or already used.
export function rotateRefreshToken(token) {
  const entry = tokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token);
  const nextToken = mint(entry.userId, entry.clientId);
  return { userId: entry.userId, clientId: entry.clientId, nextToken };
}
