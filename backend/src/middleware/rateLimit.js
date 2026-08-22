import rateLimit from 'express-rate-limit';

// PRD §2.4 — "Rate limiting on all public-facing routes (login, password
// reset) to prevent brute-forcing invite-only accounts."
export const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again shortly.' },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again shortly.' },
});

// AI routes (Phase 7) hit a paid external API per request — throttled
// separately from auth routes so a runaway UI loop or abusive user can't
// rack up Groq costs. Generous enough for genuine classroom/parent use.
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests this hour. Please try again later.' },
});

// ADR-001 §6 — "Rate-limit and monitor the OAuth endpoints... they become
// a new, valuable target the moment the CMS depends on them." Applied to
// every /oauth/* route (authorize, token, userinfo) as they're built.
export const oauthRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});
