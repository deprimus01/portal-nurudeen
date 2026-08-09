import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Backend API origin - CSP connect-src must explicitly allow this since the
// frontend calls it cross-origin (see lib/api.ts / NEXT_PUBLIC_API_URL).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const IS_DEV = process.env.NODE_ENV !== 'production';

export function middleware(request: NextRequest) {
  // Per-request nonce for inline scripts. Next.js automatically applies this
  // nonce to its own internal hydration/streaming scripts once it sees one
  // in the CSP header below, so app code never needs to reference it itself.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    // 'unsafe-eval' is only needed for Next.js dev-mode HMR/React Refresh -
    // never included in a production build.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? ` 'unsafe-eval'` : ''}`,
    // React sets element.style via the CSSOM (not markup), which most
    // browsers don't gate on style-src; 'unsafe-inline' here only backstops
    // any literal style="" usage and is far lower-risk than script-src.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob:`,
    `connect-src 'self' ${API_ORIGIN}`,
    `manifest-src 'self'`,
    `worker-src 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next.js's own renderer reads the nonce back out of this *request*
  // header (not the response) to auto-nonce its hydration/streaming
  // scripts - both sets below are required.
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Run on every route except static assets and image optimization files,
    // which don't render HTML and don't need a per-request nonce.
    '/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|sw.js).*)',
  ],
};
