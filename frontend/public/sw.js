// SmartBuy service worker — minimal offline shell + install support.
// Caches static assets for instant repeat loads and bypasses API calls
// so stale data is never served to an online user.
const CACHE_VERSION = 'smartbuy-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k !== CACHE_VERSION)
        .map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Strategy:
//   * API requests (anything under /api/) → always network, never cache.
//   * Navigations → network first, fall back to cached index.
//   * Same-origin GETs for static assets → stale-while-revalidate.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Push notifications — wiring for the follow-up VAPID integration. Safe
// no-op if nothing is delivered.
self.addEventListener('push', (event) => {
  let data = { title: 'SmartBuy', body: 'You have an update.' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* text payload */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(target));
});
