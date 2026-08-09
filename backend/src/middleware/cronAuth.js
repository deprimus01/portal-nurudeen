// Scheduled jobs (see routes/cron.routes.js) run outside any user session —
// there's no JWT to check. Auth here is a shared secret in a custom header
// instead, checked with a timing-safe comparison so response time can't be
// used to guess the secret byte-by-byte. Mirrors the CRON_SECRET pattern
// already used for ScholarLog's GitHub Actions cron jobs.
import { timingSafeEqual } from 'crypto';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requireCronSecret(req, res, next) {
  const provided = req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // Fail closed, not open — an unset secret must never mean "anyone can
    // trigger this," it must mean "this endpoint is unusable."
    return res.status(503).json({ error: 'Scheduled job endpoint is not configured.' });
  }
  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid or missing cron secret.' });
  }
  next();
}
