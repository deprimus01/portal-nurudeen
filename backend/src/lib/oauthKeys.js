import { createPublicKey } from 'node:crypto';

// Asymmetric key pair used ONLY for signing OAuth tokens issued to the
// CMS (nurudeen-schools) — deliberately separate from JWT_SECRET, which
// remains a symmetric secret used only for the SMS's own session tokens.
// See ADR-001 §2 refinement 1 and §6 for why a shared secret was rejected.
//
// Generate with: node scripts/generate-oauth-keys.js
//
// These are optional at boot (unlike JWT_SECRET/DATABASE_URL in
// index.js) because Phase 0 is being rolled out incrementally — the rest
// of the SMS must keep running even before these are configured. Routes
// that need them fail with a clear 503 instead of crashing the process.

let cachedPrivateKey = null;
let cachedPublicKeyPem = null;
let cachedJwk = null;

function decode(base64Env) {
  const value = process.env[base64Env];
  if (!value) return null;
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

export function isOAuthKeysConfigured() {
  return Boolean(process.env.OAUTH_PRIVATE_KEY_BASE64 && process.env.OAUTH_PUBLIC_KEY_BASE64 && process.env.OAUTH_KEY_ID);
}

export function getOAuthKeyId() {
  return process.env.OAUTH_KEY_ID || null;
}

export function getOAuthPrivateKeyPem() {
  if (cachedPrivateKey) return cachedPrivateKey;
  cachedPrivateKey = decode('OAUTH_PRIVATE_KEY_BASE64');
  return cachedPrivateKey;
}

export function getOAuthPublicKeyPem() {
  if (cachedPublicKeyPem) return cachedPublicKeyPem;
  cachedPublicKeyPem = decode('OAUTH_PUBLIC_KEY_BASE64');
  return cachedPublicKeyPem;
}

// JWK (JSON Web Key) representation of the public key, for the JWKS
// discovery endpoint (GET /oauth/jwks.json) — the standard, rotation-
// friendly way for a Relying Party (the CMS) to fetch and cache a
// verification key, rather than the CMS hardcoding a PEM in its own env.
export function getOAuthPublicJwk() {
  if (cachedJwk) return cachedJwk;

  const pem = getOAuthPublicKeyPem();
  const kid = getOAuthKeyId();
  if (!pem || !kid) return null;

  const keyObject = createPublicKey(pem);
  const jwk = keyObject.export({ format: 'jwk' });

  cachedJwk = {
    ...jwk,
    kid,
    use: 'sig',
    alg: 'RS256',
  };
  return cachedJwk;
}
