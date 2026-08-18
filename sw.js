/* ==========================================================================
   YARBIS - SERVICE WORKER (AUTO-CLEANUP & ZERO-CACHE NETWORK DIRECT)
   ========================================================================== */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch directly from network to guarantee fresh version
  event.respondWith(fetch(event.request));
});
