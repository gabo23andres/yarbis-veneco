/* ==========================================================================
   YARBIS - LANZADOR DE APPS DEL TELÉFONO
   Convierte enlaces web (wa.me, open.spotify.com, youtube.com…) en enlaces
   que abren la APP instalada:
   - Android: "intent://…#Intent;package=…" con la web como respaldo si la
     app no está instalada.
   - iPhone: se intenta el esquema de la app (whatsapp://, spotify:…) y, si
     no está instalada, se abre la web.
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

  // iPhone: enlace web -> esquema de la app (null si no aplica)
  const q = (u, name) => u.searchParams.get(name) || '';
  const IOS_SCHEMES = [
    {
      test: /(^|\.)wa\.me$/,
      to: (u) => {
        const phone = u.pathname.replace(/\D/g, '');
        const text = q(u, 'text');
        return `whatsapp://send?${phone ? `phone=${phone}` : ''}${phone && text ? '&' : ''}${text ? `text=${encodeURIComponent(text)}` : ''}`;
      }
    },
    { test: /(^|\.)whatsapp\.com$/, to: () => 'whatsapp://' },
    {
      test: /^open\.spotify\.com$/,
      to: (u) => {
        const m = u.pathname.match(/^\/(search|track|album|artist|playlist)\/(.+)$/);
        return m ? `spotify:${m[1]}:${m[2]}` : 'spotify:';
      }
    },
    {
      test: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/,
      to: (u) => `youtube://${u.hostname === 'youtu.be' ? `watch?v=${u.pathname.slice(1)}` : `${u.pathname.replace(/^\//, '')}${u.search}`}`
    },
    {
      test: /^(maps\.google\.com|www\.google\.com)$/,
      when: (u) => u.hostname === 'maps.google.com' || u.pathname.startsWith('/maps'),
      // Apple Maps viene en todos los iPhone
      to: (u) => {
        if (u.pathname.startsWith('/maps/dir')) {
          const dest = q(u, 'destination') || decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
          return dest && dest !== 'dir' ? `maps://?daddr=${encodeURIComponent(dest)}` : 'maps://';
        }
        const search = u.pathname.match(/^\/maps\/search\/([^/]+)(?:\/@(-?[\d.]+),(-?[\d.]+))?/);
        if (search) return `maps://?q=${search[1]}${search[2] ? `&sll=${search[2]},${search[3]}` : ''}`;
        const query = q(u, 'query') || q(u, 'q');
        return query ? `maps://?q=${encodeURIComponent(query)}` : 'maps://';
      }
    },
    { test: /(^|\.)waze\.com$/, to: (u) => `waze://${u.search || ''}` },
    {
      test: /(^|\.)instagram\.com$/,
      to: (u) => {
        const user = u.pathname.split('/').filter(Boolean)[0];
        return user ? `instagram://user?username=${user}` : 'instagram://app';
      }
    },
    {
      test: /^t\.me$/,
      to: (u) => {
        const name = u.pathname.split('/').filter(Boolean)[0];
        return name ? `tg://resolve?domain=${name}` : 'tg://';
      }
    },
  ];
  // Las demás apps (Uber, Netflix, TikTok…) abren con su enlace universal https

  function iosScheme(url) {
    let u;
    try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const rule = IOS_SCHEMES.find(r => r.test.test(u.hostname) && (!r.when || r.when(u)));
    return rule ? rule.to(u) : null;
  }

  // SMS con texto: iPhone usa "&body=", Android y los demás "?body="
  function smsUrl(number, body, plat = platform()) {
    const num = String(number || '').replace(/[^\d+]/g, '');
    if (!body) return `sms:${num}`;
    return `sms:${num}${plat === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
  }

  // Intenta abrir la app con su esquema; si sigue visible la página, abre la web
  function tryScheme(scheme, fallback) {
    let left = false;
    const onLeave = () => { left = true; };
    root.addEventListener('pagehide', onLeave, { once: true });
    root.addEventListener('blur', onLeave, { once: true });
    const onVis = () => { if (root.document.hidden) left = true; };
    root.document.addEventListener('visibilitychange', onVis);
    setTimeout(() => {
      root.removeEventListener('pagehide', onLeave);
      root.removeEventListener('blur', onLeave);
      root.document.removeEventListener('visibilitychange', onVis);
      if (!left && fallback) {
        let win = null;
        try { win = root.open(fallback, '_blank'); } catch (e) { win = null; }
        if (!win) root.location.href = fallback;
      }
    }, 1300);
    root.location.href = scheme;
  }

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
    if (plat === 'ios') {
      const scheme = iosScheme(url);
      if (scheme) {
        tryScheme(scheme, url);
        return true;
      }
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

  const Apps = { platform, matchApp, href, open, appName, storeSearch, ANDROID_APPS, iosScheme, smsUrl };
  root.YarbisApps = Apps;
  if (typeof module !== 'undefined' && module.exports) module.exports = Apps;
})(typeof window !== 'undefined' ? window : globalThis);
