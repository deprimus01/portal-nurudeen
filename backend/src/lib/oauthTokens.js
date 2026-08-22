import jwt from 'jsonwebtoken';

import { getOAuthPrivateKeyPem, getOAuthPublicKeyPem, getOAuthKeyId, isOAuthKeysConfigured } from './oauthKeys.js';
import { toApiClaim } from './websiteClaims.js';

// Short-lived by design (ADR-001 §6: "Short-lived access tokens
// (minutes), refreshed against SMS"). The CMS is expected to hold this
// in memory only and re-mint via the refresh_token grant, never persist
// it long-term.
export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

const ISSUER = 'portal-nurudeen';

// `claims` is the plain string array from getUserWebsiteClaims() — in
// this repo's internal DB/enum form (underscore-separated). Translated
// to the ADR-001 §5 dot-separated wire form (e.g. "website.news.write")
// before it ever leaves this process — the CMS should never see or need
// to know that the underscore form exists. The CMS treats the result as
// an opaque permission set and must never infer anything from `role`
// beyond what's actually listed here (ADR-001 §169's core rule: an SMS
// ADMIN does not automatically get any website.* claim).
export function signAccessToken({ user, claims, clientId }) {
  const privateKey = getOAuthPrivateKeyPem();
  const kid = getOAuthKeyId();
  if (!privateKey || !kid) {
    throw new Error('OAuth signing keys are not configured.');
  }

  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      claims: claims.map(toApiClaim),
    },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: kid,
      issuer: ISSUER,
      audience: clientId,
      subject: user.id,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
  );
}

// Used by /oauth/userinfo (this repo verifying its own previously-issued
// token). The CMS does its own independent verification against
// GET /oauth/jwks.json — this is NOT what the CMS calls.
export function verifyAccessToken(token) {
  const publicKey = getOAuthPublicKeyPem();
  if (!publicKey) {
    throw new Error('OAuth signing keys are not configured.');
  }
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: ISSUER,
  });
}

export { isOAuthKeysConfigured };
