/* ==========================================================================
   YARBIS - SERVICE WORKER (OFFLINE PWA & CACHE ACCELERATOR 5.0)
   ========================================================================== */

const CACHE_NAME = 'yarbis-cache-v5.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/audioEffects.js',
  './js/arcReactor.js',
  './js/speechEngine.js',
  './js/yarbisBrain.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network first for API/dynamic requests, Cache first with network fallback for static assets
  if (event.request.url.includes('api.') || event.request.url.includes('googleapis') || event.request.url.includes('pollinations') || event.request.url.includes('wikipedia') || event.request.url.includes('open-meteo')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
