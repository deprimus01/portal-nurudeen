// One-time setup script — generates the RS256 key pair the SMS uses to
// sign OAuth tokens for the CMS (ADR-001 §2, refinement 1: "asymmetric
// token signing... a shared symmetric secret was explicitly rejected").
//
// Run once per environment (local dev, staging, production each get
// their OWN key pair — never share one across environments):
//
//   node scripts/generate-oauth-keys.js
//
// Paste the three printed values into that environment's .env as
// OAUTH_PRIVATE_KEY_BASE64, OAUTH_PUBLIC_KEY_BASE64, and OAUTH_KEY_ID.
// The private key never leaves the SMS backend. The public key is served
// automatically at GET /oauth/jwks.json once those vars are set — the CMS
// fetches it from there, it is never pasted into the CMS's own env.
//
// Rotating later: generate a new pair with a NEW OAUTH_KEY_ID, add it
// alongside (not replacing) the old one in the key list this script's
// output implies, keep both public keys published in the JWKS response
// until every previously-issued token has expired (JWT_EXPIRES_IN below
// in lib/oauth.js), then remove the old one.

import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keyId = `sms-${randomBytes(6).toString('hex')}`;

console.log('Add these to this environment\'s .env file:\n');
console.log(`OAUTH_KEY_ID=${keyId}`);
console.log(`OAUTH_PRIVATE_KEY_BASE64=${Buffer.from(privateKey).toString('base64')}`);
console.log(`OAUTH_PUBLIC_KEY_BASE64=${Buffer.from(publicKey).toString('base64')}`);
console.log('\nKeep the private key value out of source control, logs, and chat — treat it like JWT_SECRET.');
