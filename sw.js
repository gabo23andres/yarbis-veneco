/* ==========================================================================
   YARBIS - SERVICE WORKER
   Red primero para los archivos de la app (siempre la versión más nueva si
   hay internet) y caché como respaldo para que funcione sin conexión.
   Nunca guarda llamadas a APIs externas.
   ========================================================================== */

const VERSION = 'yarbis-v15.7.1';
const CORE = [
  './',
  './index.html',
  './styles.css?v=15.7.1',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  './icons/icon-512.png',
  './js/utils.js?v=15.7.1',
  './js/audioEffects.js?v=15.7.1',
  './js/mathEngine.js?v=15.7.1',
  './js/finance.js?v=15.7.1',
  './js/reminders.js?v=15.7.1',
  './js/cleaner.js?v=15.7.1',
  './js/camera.js?v=15.7.1',
  './js/voiceOrb.js?v=15.7.1',
  './js/voiceRecorder.js?v=15.7.1',
  './js/speechEngine.js?v=15.7.1',
  './js/charts.js?v=15.7.1',
  './js/stocks.js?v=15.7.1',
  './js/expenses.js?v=15.7.1',
  './js/pagomovil.js?v=15.7.1',
  './js/appLauncher.js?v=15.7.1',
  './js/aiProviders.js?v=15.7.1',
  './js/geminiAgent.js?v=15.7.1',
  './js/yarbisBrain.js?v=15.7.1',
  './js/financeView.js?v=15.7.1',
  './js/settings.js?v=15.7.1',
  './js/home.js?v=15.7.1',
  './js/voicetools.js?v=15.7.1',
  './js/app.js?v=15.7.1',
  './js/vendor/jsQR.js',
  './js/vendor/qrcode.js'
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'yarbis-share').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// "Compartir → YARBIS" con una foto: se guarda en caché y se abre la app
async function handleShareTarget(req) {
  const form = await req.formData();
  const params = new URLSearchParams();
  ['title', 'text', 'url'].forEach((k) => {
    const v = form.get(k);
    if (v) params.set(k, String(v).slice(0, 2000));
  });
  const file = form.get('media');
  if (file && typeof file === 'object' && file.size) {
    const cache = await caches.open('yarbis-share');
    await cache.put('shared-media', new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
    params.set('media', '1');
  }
  return Response.redirect(`./?${params.toString()}`, 303);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'POST' && new URL(req.url).searchParams.has('share-target')) {
    event.respondWith(handleShareTarget(req));
    return;
  }
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
