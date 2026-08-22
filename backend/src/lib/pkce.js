import { createHash } from 'node:crypto';

// RFC 7636 §4.2 — code_challenge = BASE64URL(SHA256(code_verifier)).
// Only S256 is supported anywhere in this flow (see oauth.schema.js —
// "plain" is rejected at /oauth/authorize already), so this is the only
// derivation this codebase ever needs.
export function pkceChallengeFromVerifier(codeVerifier) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}
