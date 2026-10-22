/* ==========================================================================
   YARBIS - PANEL "HOY"
   Resumen en tarjetas (estilo bento) cuando el chat está vacío:
   tasa del dólar, clima, próximos avisos, pendientes, gastos y accesos rápidos.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const WEATHER_KEY = 'yarbis_home_weather';

  const QUICK = [
    { icon: '💱', label: 'Convertir', run: (app) => { app.showView('finance'); setTimeout(() => U.$('#convAmount') && U.$('#convAmount').focus(), 150); } },
    { icon: '⏱️', label: 'Timer 5 min', run: (app) => app.submit('Pon un temporizador de 5 minutos') },
    { icon: '🛒', label: 'Compras', run: (app) => app.runCommand('open-list', 'Compras') },
    { icon: '💸', label: 'Gasto', run: (app) => app.openTool('expense') },
    { icon: '📱', label: 'Escanear QR', run: () => root.YarbisCamera.open('qr') },
    { icon: '🌐', label: 'Traductor', run: (app) => app.openTool('translate') },
    { icon: '🎙️', label: 'Dictado', run: (app) => app.openTool('dictation') },
    { icon: '📲', label: 'Pago Móvil', run: (app) => app.openTool('pagomovil') }
  ];

  const Home = {
    mount(app) {
      this.app = app;
      this.grid = U.$('#homeGrid');
      if (!this.grid) return;
      const rerender = () => { if (!U.$('#welcome').hidden) this.render(); };
      root.YarbisFinance.onChange(rerender);
      root.YarbisReminders.notes.onChange(rerender);
      root.YarbisReminders.schedule.onChange((e) => { if (!e || e.type !== 'tick') rerender(); });
      if (root.YarbisExpenses) root.YarbisExpenses.store.onChange(rerender);
      this.render();
      this.loadWeather();
      setInterval(() => { if (!document.hidden) rerender(); }, 30000);
    },

    card(cls, onClick, ...children) {
      const props = { class: `bento ${cls}` };
      if (onClick) {
        props.role = 'button';
        props.tabindex = '0';
        props.onClick = onClick;
        props.onKeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
      }
      return U.el('div', props, ...children);
    },

    render() {
      if (!this.grid || !this.app) return;
      const el = U.el;
      const app = this.app;
      const F = root.YarbisFinance;
      const r = F.getRates();
      const cards = [];

      // Sin clave de IA: invitar a activar el cerebro Gemini (gratis)
      const P = root.YarbisAIProviders;
      if (app.brain && !app.brain.geminiApiKey && !(P && P.isReady())) {
        cards.push(this.card('bento-brain', () => root.YarbisSettings && root.YarbisSettings.open(),
          el('span', { class: 'bento-label', text: '🧠 Activa el cerebro Gemini' }),
          el('span', { class: 'bento-sub', text: 'Gratis: entiende todo lo que le pidas, actúa por ti (alarmas, notas, mensajes…), busca en Google y recuerda tus datos. Toca para pegar tu clave.' })));
      }

      // Tasa del dólar
      const hist = F.getHistory(30).map(p => p.bcv);
      const ch = F.change('bcv', 7);
      cards.push(this.card('bento-rate', () => app.showView('finance'),
        el('span', { class: 'bento-label', text: '💵 Dólar BCV' }),
        el('span', { class: 'bento-big', text: U.fmtBs(r.bcv) }),
        el('span', { class: 'bento-sub' },
          `Paralelo ${U.fmtBs(r.paralelo)}`,
          ch === null ? null : el('span', { class: ch >= 0 ? 'down' : 'up', text: ` · ${ch >= 0 ? '▲' : '▼'} ${U.fmtNumber(Math.abs(ch), 1)} % 7d` })),
        hist.length > 1 && root.YarbisCharts ? root.YarbisCharts.sparkline(hist, { width: 200, height: 40, className: 'bento-spark' }) : null,
        el('span', { class: 'bento-foot', text: F.statusLabel(r.fx) })));

      // Clima
      const w = S.get(WEATHER_KEY, null);
      cards.push(this.card('bento-weather', () => app.submit(`¿Cómo está el clima en ${(w && w.city) || 'Caracas'}?`),
        el('span', { class: 'bento-label', text: `🌤️ ${(w && w.city) || 'Clima'}` }),
        el('span', { class: 'bento-big', text: w ? `${Math.round(w.temp)}°` : '—' }),
        el('span', { class: 'bento-sub', text: w ? U.capitalize(U.toSpeech(String(w.desc))) : 'Toca para consultar' })));

      // Próximos avisos
      const up = root.YarbisReminders.schedule.upcoming(3);
      cards.push(this.card('bento-upcoming', () => app.showView('notes'),
        el('span', { class: 'bento-label', text: '⏰ Próximos avisos' }),
        up.length
          ? el('ul', { class: 'bento-list' }, up.map(x => el('li', null,
            el('strong', { text: x.kind === 'timer' ? U.fmtDuration((x.at - Date.now()) / 1000) : U.fmtTime(x.at) }),
            ` ${x.label}`)))
          : el('span', { class: 'bento-sub', text: 'Nada programado. Di "alarma a las 6".' })));

      // Pendientes
      const pending = root.YarbisReminders.notes.pending();
      cards.push(this.card('bento-notes', null,
        el('div', { class: 'bento-row' },
          el('span', { class: 'bento-label', text: `📝 Pendientes (${pending.length})` }),
          el('button', { type: 'button', class: 'bento-link', text: 'Ver todo', onClick: () => app.showView('notes') })),
        pending.length
          ? el('ul', { class: 'bento-checks' }, pending.slice(0, 3).map(n => el('li', null,
            el('button', {
              type: 'button', class: 'note-check', 'aria-label': `Marcar "${n.text}" como hecha`,
              onClick: (e) => { e.stopPropagation(); root.YarbisReminders.notes.toggle(n.id, true); U.toast(`✅ ${n.text}`); }
            }),
            el('span', { text: n.text }))))
          : el('span', { class: 'bento-sub', text: '¡Todo al día! 🎉' })));

      // Gastos del mes
      const E = root.YarbisExpenses && root.YarbisExpenses.store;
      if (E) {
        const s = E.summary();
        const b = E.budgetStatus();
        cards.push(this.card('bento-expenses', () => app.openTool('expense'),
          el('span', { class: 'bento-label', text: '💸 Gastos del mes' }),
          el('span', { class: 'bento-big', text: U.fmtUsd(s.totalUsd) }),
          b.budget
            ? el('div', { class: `progress ${b.level}` }, el('div', { class: 'progress-fill', style: { width: `${Math.min(100, b.pct)}%` } }))
            : el('span', { class: 'bento-sub', text: s.count ? `${s.count} gasto${s.count === 1 ? '' : 's'}` : 'Di "gasté 5 dólares en café"' })));
      }

      // Accesos rápidos
      cards.push(el('div', { class: 'bento bento-quick' },
        QUICK.map(q => el('button', { type: 'button', class: 'quick-btn', onClick: () => q.run(app) },
          el('span', { class: 'quick-icon', text: q.icon }), el('span', { text: q.label })))));

      this.grid.replaceChildren(...cards);
    },

    // Clima breve para la tarjeta (caché de 30 minutos)
    async loadWeather(force = false) {
      const cached = S.get(WEATHER_KEY, null);
      if (!force && cached && Date.now() - cached.t < 30 * 60 * 1000) return;
      const brain = this.app && this.app.brain;
      if (!brain || !brain.fetchForecast) return;
      const cityName = S.getRaw('yarbis_weather_city', '') || 'Caracas';
      try {
        let place = S.get('yarbis_home_place', null);
        if (!place || place.name !== cityName) {
          const geo = await brain.fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=es&format=json`);
          const p = brain.pickPlace(geo && geo.results, U.normalize(cityName));
          if (!p) return;
          place = { name: p.name, latitude: p.latitude, longitude: p.longitude };
          S.set('yarbis_home_place', place);
        }
        const w = await brain.fetchForecast(place);
        S.set(WEATHER_KEY, {
          t: Date.now(),
          city: place.name,
          temp: w.current.temperature_2m,
          desc: brain.weatherCode(w.current.weather_code)
        });
        this.render();
      } catch (e) {
        console.warn('Clima del inicio:', e.message);
      }
    }
  };

  root.YarbisHome = Home;
})(typeof window !== 'undefined' ? window : globalThis);
