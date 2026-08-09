// Minimal service worker — just enough to satisfy installability criteria
// (Android requires an active SW + manifest to show the install prompt).
// Deliberately does NOT cache API responses itself — that's handled at
// the app layer instead (see frontend/lib/db.ts and lib/api.ts), which
// can make an informed per-request decision (GET vs write, cache-aside
// with a visible "offline" label) that a blanket SW cache can't. This SW
// only ever caches the app shell.

const CACHE_NAME = 'nuruddeen-sms-shell-v1';
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

// Network-first for everything — this is a data-correctness-first app
// (PRD §2.5), so we never want to silently serve stale cached data.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
