import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';

import { prisma } from '../lib/prisma.js';
import { isOAuthKeysConfigured, getOAuthPublicJwk } from '../lib/oauthKeys.js';
import { mintAuthorizationCode, consumeAuthorizationCode } from '../lib/oauthCodes.js';
import { mintRefreshToken, rotateRefreshToken } from '../lib/oauthRefreshTokens.js';
import { signAccessToken, verifyAccessToken, ACCESS_TOKEN_TTL_SECONDS } from '../lib/oauthTokens.js';
import { getUserWebsiteClaims, toApiClaim } from '../lib/websiteClaims.js';
import { pkceChallengeFromVerifier } from '../lib/pkce.js';
import { logAction } from '../lib/auditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { oauthRateLimiter } from '../middleware/rateLimit.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { oauthAuthorizeSchema, oauthTokenSchema } from '../validation/oauth.schema.js';

const router = Router();

// The CMS's registered client. A single hardcoded client (not a DB table
// of clients) is deliberate — ADR-001 describes exactly one Relying
// Party (nurudeen-schools), not a general-purpose multi-tenant OAuth
// server. Add OAUTH_CMS_CLIENT_ID / OAUTH_CMS_REDIRECT_URI to .env once
// the CMS's real production URL is known; until then these routes 503
// rather than silently accepting an unvalidated redirect_uri.
function getRegisteredClient() {
  const clientId = process.env.OAUTH_CMS_CLIENT_ID;
  const redirectUri = process.env.OAUTH_CMS_REDIRECT_URI;
  const clientSecret = process.env.OAUTH_CMS_CLIENT_SECRET;
  if (!clientId || !redirectUri) return null;
  return { clientId, redirectUri, clientSecret };
}

// Constant-time secret comparison — a plain === would leak how many
// leading characters matched via response timing, same reasoning as
// comparing password hashes. Buffers must be equal length for
// timingSafeEqual, so a length mismatch is checked (and short-circuited)
// separately first — this alone doesn't leak anything useful since a
// wrong-length secret is invalid regardless of any character overlap.
function secretsMatch(provided, expected) {
  if (!expected || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Re-validates the OAuth params against the registered client. Shared by
// both the GET (browser entry) and POST (code-minting) handlers so the
// two can never drift out of sync with each other.
function validateAgainstRegisteredClient(params, res) {
  const client = getRegisteredClient();
  if (!client) {
    res.status(503).json({ error: 'CMS SSO client is not configured yet on this environment.' });
    return null;
  }
  if (params.client_id !== client.clientId) {
    res.status(400).json({ error: 'Unknown client_id.' });
    return null;
  }
  // Exact match only — no prefix/substring matching. A registered
  // redirect_uri allow-list is the entire point of validating it; a
  // fuzzy match would let an attacker register a lookalike callback.
  if (params.redirect_uri !== client.redirectUri) {
    res.status(400).json({ error: 'redirect_uri does not match the registered value for this client.' });
    return null;
  }
  return client;
}

// Public, unauthenticated by design — a JWKS endpoint publishes only the
// public key, never the private one. This is what the CMS (nurudeen-
// schools) fetches and caches to verify tokens issued by /oauth/token,
// per ADR-001 §2 refinement 1 (asymmetric signing — the CMS never holds
// SMS's private key). Mounted at /oauth (not /api/oauth) to match the
// paths in ADR-001 §3's diagram.
router.get(
  '/jwks.json',
  asyncHandler(async (req, res) => {
    if (!isOAuthKeysConfigured()) {
      return res.status(503).json({
        error: 'OAuth signing keys are not configured yet on this environment.',
      });
    }

    const jwk = getOAuthPublicJwk();
    if (!jwk) {
      return res.status(503).json({ error: 'OAuth signing keys could not be loaded.' });
    }

    // Cacheable — this only changes on key rotation, which is a rare,
    // deliberate operation (see scripts/generate-oauth-keys.js).
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ keys: [jwk] });
  }),
);

// Entry point for the flow the CMS's "Admin Login" button redirects the
// browser to (ADR-001 §4 diagram, step 2). This backend is a pure JSON
// API (see index.js's CSP comment) and never renders HTML itself — so
// this route's only job is to validate the request BEFORE trusting
// redirect_uri for anything, then bounce the browser on to the actual
// login UI in the SMS frontend, carrying the same OAuth params forward.
// The frontend page decides whether the visitor already has a session or
// needs to log in first (see app/oauth/authorize/page.tsx).
//
// On invalid params: respond with a plain JSON 400, NOT a redirect. The
// whole point of validating redirect_uri against the allow-list first is
// that an invalid/unregistered redirect_uri must never be treated as
// trustworthy enough to redirect the browser to — even to report an
// error. This is a client (CMS) misconfiguration and should show a
// developer, not the end user, in real operation.
router.get(
  '/authorize',
  oauthRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = oauthAuthorizeSchema.safeParse(req.query);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || 'Invalid authorization request.',
        field: firstIssue?.path?.join('.'),
      });
    }

    const client = validateAgainstRegisteredClient(parsed.data, res);
    if (!client) return; // response already sent

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const forwardParams = new URLSearchParams(parsed.data).toString();

    return res.redirect(302, `${frontendUrl}/oauth/authorize?${forwardParams}`);
  }),
);

// Called by the SMS frontend (with the visitor's existing Bearer session
// token) once it has confirmed the visitor is logged in — either they
// already had a session, or they just completed the existing SMS login
// form (ADR-001 §4 diagram: "Follows redirect, lands on existing SMS
// login... Submits credentials (unchanged SMS login flow)"). Mints a
// single-use authorization code bound to this user and this PKCE
// challenge, and hands back the URL the frontend should navigate to next
// — the browser delivering the code to the CMS's own callback route,
// exactly as the diagram shows (never a server-to-server call at this
// step; that's what /oauth/token is for).
router.post(
  '/authorize',
  oauthRateLimiter,
  requireAuth,
  validateBody(oauthAuthorizeSchema),
  asyncHandler(async (req, res) => {
    const client = validateAgainstRegisteredClient(req.body, res);
    if (!client) return; // response already sent

    const code = mintAuthorizationCode({
      userId: req.user.id,
      clientId: req.body.client_id,
      redirectUri: req.body.redirect_uri,
      codeChallenge: req.body.code_challenge,
      codeChallengeMethod: req.body.code_challenge_method,
    });

    await logAction({
      userId: req.user.id,
      action: 'oauth.authorize',
      entityType: 'OAuthAuthorization',
      metadata: { clientId: req.body.client_id },
    });

    const redirectUrl = `${req.body.redirect_uri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(req.body.state)}`;
    return res.json({ redirectUrl });
  }),
);

// Server-to-server: the CMS's own backend calls this directly (never the
// browser), trading the authorization code the browser just delivered to
// its callback route for an access token. Requires the client secret
// (RFC 6749 §2.3.1 confidential client) since there's no user Bearer
// token to authenticate this request the way /oauth/authorize's POST
// does — the caller's identity here IS "the CMS's backend", proven by
// knowing the shared secret, and the eventual user's identity comes from
// whichever user the authorization code was minted for.
//
// Also handles the refresh_token grant (RFC 6749 §6) in the same route,
// per standard OAuth2 practice — same client authentication requirement,
// different input (a refresh token instead of a code+verifier).
router.post(
  '/token',
  oauthRateLimiter,
  validateBody(oauthTokenSchema),
  asyncHandler(async (req, res) => {
    const client = getRegisteredClient();
    if (!client) {
      return res.status(503).json({ error: 'CMS SSO client is not configured yet on this environment.' });
    }
    if (req.body.client_id !== client.clientId || !secretsMatch(req.body.client_secret, client.clientSecret)) {
      // Deliberately the same generic message for "unknown client_id" and
      // "wrong secret" — distinguishing them would tell an attacker which
      // half of the credential pair they got right.
      return res.status(401).json({ error: 'invalid_client' });
    }

    let userId;
    let nextRefreshToken;

    if (req.body.grant_type === 'authorization_code') {
      // Consumed unconditionally on presentation — success or failure —
      // not only once PKCE verification passes below. This is
      // deliberate: a code must be usable exactly once regardless of
      // outcome, otherwise a stolen code without its matching verifier
      // could be replayed against /oauth/token repeatedly to brute-force
      // the verifier. One presentation, one chance.
      const entry = consumeAuthorizationCode(req.body.code);
      if (!entry) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Code is invalid, expired, or already used.' });
      }
      if (entry.clientId !== req.body.client_id || entry.redirectUri !== req.body.redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Code was not issued for this client/redirect_uri.' });
      }

      const expectedChallenge = pkceChallengeFromVerifier(req.body.code_verifier);
      const a = Buffer.from(expectedChallenge);
      const b = Buffer.from(entry.codeChallenge);
      const pkceOk = a.length === b.length && timingSafeEqual(a, b);
      if (!pkceOk) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier does not match.' });
      }

      userId = entry.userId;
      nextRefreshToken = mintRefreshToken({ userId: entry.userId, clientId: req.body.client_id });
    } else {
      // grant_type === 'refresh_token'
      const rotated = rotateRefreshToken(req.body.refresh_token);
      if (!rotated || rotated.clientId !== req.body.client_id) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token is invalid, expired, or already used.' });
      }
      userId = rotated.userId;
      nextRefreshToken = rotated.nextToken;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'This account is no longer active.' });
    }

    const claims = await getUserWebsiteClaims(user.id);
    const accessToken = signAccessToken({ user, claims, clientId: req.body.client_id });
    // Authorization-code grant mints a fresh refresh token; refresh-token
    // grant already rotated one above (see `rotated.nextToken`) — capture
    // whichever applies via a variable set in the branch above instead of
    // re-deriving it here.
    const refreshToken = nextRefreshToken;

    await logAction({
      userId: user.id,
      action: req.body.grant_type === 'authorization_code' ? 'oauth.token.issue' : 'oauth.token.refresh',
      entityType: 'OAuthAuthorization',
      metadata: { clientId: req.body.client_id },
    });

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: claims.join(' '),
    });
  }),
);

// Server-to-server: the CMS calls this on each of its own requests (or
// on a short interval) with the access token from /oauth/token, to learn
// who's making the request and what they're currently allowed to do.
// This deliberately does NOT reuse requireAuth — that middleware verifies
// SMS's own symmetric-secret session JWTs (a completely different token
// audience/purpose); this route verifies the asymmetrically-signed OAuth
// access token instead, via verifyAccessToken().
//
// Claims are re-fetched from the DB rather than trusted from the token's
// embedded copy — the token can be up to 5 minutes old, and userinfo is
// the CMS's primary channel for learning about a claim that was just
// revoked, so freshness here matters more than almost anywhere else in
// this flow (same "never trust the embedded copy alone" principle
// requireAuth already applies to SMS's own sessions).
router.get(
  '/userinfo',
  oauthRateLimiter,
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Missing bearer token.' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Token is invalid or expired.' });
    }

    const client = getRegisteredClient();
    if (client && payload.aud !== client.clientId) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Token was not issued for this client.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Account is no longer active.' });
    }

    const claims = await getUserWebsiteClaims(user.id);

    return res.json({
      sub: user.id,
      email: user.email,
      role: user.role,
      claims: claims.map(toApiClaim),
    });
  }),
);

export default router;

