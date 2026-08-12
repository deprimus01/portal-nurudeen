// Minimal service worker — just enough to satisfy installability criteria
// (Android requires an active SW + manifest to show the install prompt)
// AND to let the app actually boot with no connection.
// Deliberately does NOT cache API responses itself — that's handled at
// the app layer instead (see frontend/lib/db.ts and lib/api.ts), which
// can make an informed per-request decision (GET vs write, cache-aside
// with a visible "offline" label) that a blanket SW cache can't.

const CACHE_NAME = 'nuruddeen-sms-shell-v2';
const SHELL_ASSETS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Next's build output - filenames are content-hashed (immutable), so
  // caching them indefinitely is safe. Cache-first: instant on repeat
  // visits, and means they're still there once the device goes offline.
  // This was the actual gap before - without it, the cached '/' document
  // below still couldn't render, because the JS/CSS it references had
  // never been cached anywhere.
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Full-page navigations (hard reload, deep link, or cold-launching the
  // installed PWA) - network-first for a live, correctly-authed page, but
  // fall back to the cached shell ('/') rather than the exact URL when
  // offline. This is a client-rendered SPA behind an auth check (every
  // page is 'use client'), so the shell's own JS handles routing to the
  // right page/auth state once it boots - it doesn't need a matching
  // cached document for /admin/students specifically, just *a* booted
  // shell to render into.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Everything else (other same-origin assets, cross-origin API calls) -
  // network-first with a matching-URL cache fallback. API responses are
  // deliberately NOT cached here (see comment above); a real network
  // failure here surfaces as a rejected fetch to the page, which
  // lib/api.ts already treats as the signal to use its own IndexedDB
  // cache instead.
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});

