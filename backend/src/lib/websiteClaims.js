import { prisma } from './prisma.js';

// Internal (DB/Prisma enum) form — underscore-separated because Postgres
// enum values must be valid identifiers and can't contain dots. This is
// a storage detail only; every point where a claim crosses the wire to
// the CMS (JWT `claims`, /oauth/userinfo, /api/admin/website-access/*)
// must use the DOT-separated form instead — see toApiClaim/toDbClaim
// below. ADR-001 §5/§162-167 specifies the dot form as the canonical
// cross-repo contract (e.g. "website.news.write"); this array is not
// what the CMS should ever see.
export const WEBSITE_CLAIMS = [
  'website_news_write',
  'website_news_publish',
  'website_events_write',
  'website_gallery_write',
  'website_settings_write',
  'website_access_manage',
];

// External (API/wire) form — matches ADR-001 §5's claim table verbatim.
export const WEBSITE_CLAIMS_API = WEBSITE_CLAIMS.map(toApiClaim);

export function isValidWebsiteClaim(claim) {
  return WEBSITE_CLAIMS.includes(claim);
}

export function toApiClaim(dbClaim) {
  return dbClaim.replaceAll('_', '.');
}

export function toDbClaim(apiClaim) {
  return apiClaim.replaceAll('.', '_');
}

// Returns the DB/enum form, e.g. ['website_news_write', 'website_events_write'].
// Internal use only (Prisma queries, the requireWebsiteClaim() middleware
// check) — callers that are about to send this across the wire to the
// CMS MUST map through toApiClaim() first. See oauthTokens.js's
// signAccessToken and routes/oauth.routes.js's /userinfo handler for the
// two places that actually cross that boundary.
export async function getUserWebsiteClaims(userId) {
  const rows = await prisma.websiteClaim.findMany({
    where: { userId },
    select: { claim: true },
  });
  return rows.map((r) => r.claim);
}
