/* ==========================================================================
   YARBIS - SERVICE WORKER
   Red primero para los archivos de la app (siempre la versión más nueva si
   hay internet) y caché como respaldo para que funcione sin conexión.
   Nunca guarda llamadas a APIs externas.
   ========================================================================== */

const VERSION = 'yarbis-v11.0.0';
const CORE = [
  './',
  './index.html',
  './styles.css?v=11.0.0',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/utils.js?v=11.0.0',
  './js/audioEffects.js?v=11.0.0',
  './js/mathEngine.js?v=11.0.0',
  './js/finance.js?v=11.0.0',
  './js/reminders.js?v=11.0.0',
  './js/cleaner.js?v=11.0.0',
  './js/camera.js?v=11.0.0',
  './js/voiceOrb.js?v=11.0.0',
  './js/speechEngine.js?v=11.0.0',
  './js/yarbisBrain.js?v=11.0.0',
  './js/financeView.js?v=11.0.0',
  './js/settings.js?v=11.0.0',
  './js/app.js?v=11.0.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs y CDNs: directo a la red

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Sin conexión' });
        })
      )
  );
});

// Al tocar una notificación de alarma, volver a la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => 'focus' in c);
      if (client) return client.focus();
      return self.clients.openWindow('./');
    })
  );
});
