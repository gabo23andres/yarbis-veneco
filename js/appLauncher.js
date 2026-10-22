/* ==========================================================================
   YARBIS - LANZADOR DE APPS DEL TELÉFONO
   Convierte enlaces web (wa.me, open.spotify.com, youtube.com…) en enlaces
   que abren la APP instalada:
   - Android: "intent://…#Intent;package=…" con la web como respaldo si la
     app no está instalada.
   - iPhone: los enlaces universales https ya abren la app al tocarlos.
   - Computadora: se abre la web.
   ========================================================================== */

(function (root) {
  'use strict';

  // host (o host + ruta) -> paquete de Android
  const ANDROID_APPS = [
    { test: /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, pkg: 'com.whatsapp', name: 'WhatsApp' },
    { test: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, pkg: 'com.google.android.youtube', name: 'YouTube' },
    { test: /^open\.spotify\.com$/, pkg: 'com.spotify.music', name: 'Spotify' },
    { test: /(^|\.)instagram\.com$/, pkg: 'com.instagram.android', name: 'Instagram' },
    { test: /(^|\.)tiktok\.com$/, pkg: 'com.zhiliaoapp.musically', name: 'TikTok' },
    { test: /(^|\.)facebook\.com$/, pkg: 'com.facebook.katana', name: 'Facebook' },
    { test: /(^|\.)(x|twitter)\.com$/, pkg: 'com.twitter.android', name: 'X' },
    { test: /^(t\.me|web\.telegram\.org)$/, pkg: 'org.telegram.messenger', name: 'Telegram' },
    { test: /^mail\.google\.com$/, pkg: 'com.google.android.gm', name: 'Gmail' },
    { test: /^maps\.google\.com$|^www\.google\.com\/maps/, pkg: 'com.google.android.apps.maps', name: 'Google Maps' },
    { test: /(^|\.)waze\.com$/, pkg: 'com.waze', name: 'Waze' },
    { test: /(^|\.)uber\.com$/, pkg: 'com.ubercab', name: 'Uber' },
    { test: /(^|\.)netflix\.com$/, pkg: 'com.netflix.mediaclient', name: 'Netflix' },
    { test: /(^|\.)mercadolibre\.com(\.ve)?$/, pkg: 'com.mercadolibre', name: 'Mercado Libre' },
    { test: /(^|\.)pedidosya\.com(\.ve)?$/, pkg: 'com.pedidosya', name: 'PedidosYa' },
    { test: /^chatgpt\.com$/, pkg: 'com.openai.chatgpt', name: 'ChatGPT' },
    { test: /^gemini\.google\.com$/, pkg: 'com.google.android.apps.bard', name: 'Gemini' },
    { test: /^drive\.google\.com$/, pkg: 'com.google.android.apps.docs', name: 'Google Drive' },
    { test: /^calendar\.google\.com$/, pkg: 'com.google.android.calendar', name: 'Calendario' },
    { test: /(^|\.)discord\.com$/, pkg: 'com.discord', name: 'Discord' },
    { test: /(^|\.)zoom\.us$/, pkg: 'us.zoom.videomeetings', name: 'Zoom' },
    { test: /(^|\.)canva\.com$/, pkg: 'com.canva.editor', name: 'Canva' },
    { test: /^play\.google\.com$/, pkg: 'com.android.vending', name: 'Play Store' }
  ];

  function platform() {
    const nav = root.navigator || {};
    const ua = nav.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
    return 'desktop';
  }

  function matchApp(url) {
    let u;
    try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const hostPath = `${u.hostname}${u.pathname}`;
    return ANDROID_APPS.find(a => a.test.test(u.hostname) || a.test.test(hostPath)) || null;
  }

  // Enlace que abre la app instalada (o la web si no está)
  function href(url, plat = platform()) {
    if (plat !== 'android') return url;
    const app = matchApp(url);
    if (!app) return url;
    const u = new URL(url);
    const rest = `${u.host}${u.pathname}${u.search}`;
    return `intent://${rest}#Intent;scheme=https;package=${app.pkg};S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }

  // Abre automáticamente si el navegador lo permite (requiere un toque reciente)
  function open(url) {
    const plat = platform();
    const target = href(url, plat);
    const active = !root.navigator.userActivation || root.navigator.userActivation.isActive;
    if (/^(tel|sms|mailto):/i.test(url)) {
      root.location.href = url;
      return true;
    }
    if (plat === 'android' && target !== url) {
      if (!active) return false;
      root.location.href = target;
      return true;
    }
    let win = null;
    try { win = root.open(url, '_blank'); } catch (e) { win = null; }
    if (win) {
      try { win.opener = null; } catch (e) { /* ignorar */ }
      return true;
    }
    return false;
  }

  function appName(url) {
    const app = matchApp(url);
    return app ? app.name : null;
  }

  // Búsqueda en la tienda de apps del teléfono
  function storeSearch(query, plat = platform()) {
    const q = encodeURIComponent(query);
    if (plat === 'ios') return `https://apps.apple.com/search?term=${q}`;
    return `https://play.google.com/store/search?q=${q}&c=apps`;
  }

  const Apps = { platform, matchApp, href, open, appName, storeSearch, ANDROID_APPS };
  root.YarbisApps = Apps;
  if (typeof module !== 'undefined' && module.exports) module.exports = Apps;
})(typeof window !== 'undefined' ? window : globalThis);
