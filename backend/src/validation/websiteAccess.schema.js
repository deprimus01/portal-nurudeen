import { z } from 'zod';

import { WEBSITE_CLAIMS_API } from '../lib/websiteClaims.js';

// Declarative full-set update — the body is the complete desired claim
// set for the user, not an individual grant/revoke action. Matches
// ADR-001 §14.4's "PATCH /api/access" framing on the CMS side; the route
// diffs against what's currently stored and applies only the delta.
// Accepts the ADR-001 §5 dot-separated claim names (e.g.
// "website.news.write") — this is the wire/API contract the CMS speaks.
// The route converts to this repo's internal underscore-separated
// Prisma enum form before touching the DB; see websiteClaims.js.
export const updateWebsiteClaimsSchema = z.object({
  claims: z
    .array(z.enum(WEBSITE_CLAIMS_API))
    .max(WEBSITE_CLAIMS_API.length)
    .refine((arr) => new Set(arr).size === arr.length, 'claims must not contain duplicates.'),
});
