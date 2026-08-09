/** @type {import('next').NextConfig} */

// Content-Security-Policy is set in middleware.ts (needs a per-request
// nonce). Everything else here is static and applies to every route,
// including static assets under /_next and /public.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'midi=()',
      'interest-cohort=()',
    ].join(', '),
  },
  // Only takes effect over HTTPS (browsers ignore it on plain HTTP), so it's
  // safe to always send. `preload` is optional — only submit the domain to
  // the HSTS preload list (hstspreload.org) once you're certain every
  // subdomain will always be served over HTTPS, since removal is slow.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
