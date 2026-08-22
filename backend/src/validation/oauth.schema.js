import { z } from 'zod';

// PKCE requires S256 — plaintext code_challenge_method is intentionally
// not accepted (ADR-001 §6 lists PKCE as a hard requirement; allowing
// "plain" defeats the point of it).
export const oauthAuthorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1, 'client_id is required.'),
  redirect_uri: z.string().url('redirect_uri must be a valid URL.'),
  code_challenge: z.string().min(43, 'code_challenge is required.'),
  code_challenge_method: z.literal('S256', {
    errorMap: () => ({ message: 'code_challenge_method must be S256.' }),
  }),
  state: z.string().min(1, 'state is required.'),
});

// /oauth/token accepts two grant types (RFC 6749 §4.1.3 and §6):
// exchanging a freshly-minted authorization code for the first token
// pair, or exchanging a refresh token for a new pair once the access
// token has expired. Deliberately accepts a JSON body rather than
// application/x-www-form-urlencoded — this backend is JSON-only
// throughout (see index.js), and this is a controlled two-repo
// integration rather than a public spec-compliant multi-client IdP.
const authorizationCodeGrantSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1, 'code is required.'),
  code_verifier: z.string().min(43, 'code_verifier is required.'),
  redirect_uri: z.string().url('redirect_uri must be a valid URL.'),
  client_id: z.string().min(1, 'client_id is required.'),
  client_secret: z.string().min(1, 'client_secret is required.'),
});

const refreshTokenGrantSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1, 'refresh_token is required.'),
  client_id: z.string().min(1, 'client_id is required.'),
  client_secret: z.string().min(1, 'client_secret is required.'),
});

export const oauthTokenSchema = z.discriminatedUnion('grant_type', [
  authorizationCodeGrantSchema,
  refreshTokenGrantSchema,
]);
