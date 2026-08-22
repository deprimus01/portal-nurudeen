import { randomBytes } from 'node:crypto';

// Authorization codes are single-use and short-lived (60s — plenty for
// the browser to bounce from SMS back to the CMS's callback route, per
// ADR-001 §4's flow). An in-memory Map is deliberately sufficient: unlike
// WebsiteClaim (durable, needs to survive restarts), a code that dies on
// a redeploy is fine — the person just retries the login, same as any
// OAuth IdP mid-flow restart.
//
// Caveat: this assumes a single backend process/instance. If the SMS
// backend is ever scaled to multiple instances behind a load balancer
// without sticky sessions, move this to Redis (or reuse Postgres with a
// short TTL) — a code minted on instance A won't be visible to instance
// B's /oauth/token handler otherwise. Fine for the current single-Render-
// service deployment.

const CODE_TTL_MS = 60 * 1000;
const codes = new Map();

// Sweep expired codes periodically so the Map doesn't grow unbounded if
// some codes are never redeemed (abandoned logins, etc).
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codes) {
    if (entry.expiresAt < now) codes.delete(code);
  }
}, CODE_TTL_MS).unref();

export function mintAuthorizationCode({ userId, clientId, redirectUri, codeChallenge, codeChallengeMethod }) {
  const code = randomBytes(32).toString('base64url');
  codes.set(code, {
    userId,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    expiresAt: Date.now() + CODE_TTL_MS,
    used: false,
  });
  return code;
}

// Consumes (single-use) and returns the code's data, or null if the code
// is missing, expired, or already used. Callers in /oauth/token still
// need to separately verify the PKCE code_verifier against codeChallenge.
export function consumeAuthorizationCode(code) {
  const entry = codes.get(code);
  if (!entry) return null;
  if (entry.used || entry.expiresAt < Date.now()) {
    codes.delete(code);
    return null;
  }
  entry.used = true;
  // Deleted rather than left marked-used — a burned code should never be
  // presentable again, and there's no need to keep it around for the
  // sweep to find later.
  codes.delete(code);
  return entry;
}
