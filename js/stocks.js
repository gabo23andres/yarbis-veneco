/* ==========================================================================
   YARBIS - BOLSA DE VALORES
   Lee bolsa.json, que prepara cada 20 minutos un robot de GitHub Actions
   (scripts/bolsa.mjs): Bolsa de Caracas, acciones de EE. UU., fondos, oro,
   divisas y cripto, con señales técnicas de comprar / mantener / vender.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const URL_DATA = 'https://raw.githubusercontent.com/gabo23andres/yarbis-veneco/datos/bolsa.json';
  const CACHE_KEY = 'yarbis_bolsa';
  const MAX_AGE = 10 * 60 * 1000;
  const TABS = [['bvc', '🇻🇪 Caracas'], ['us', '🇺🇸 EE. UU.'], ['etf', '📦 Fondos'], ['commodities', '🥇 Oro y divisas'], ['crypto', '🪙 Cripto']];
  const SIGNALS = {
    comprar: { label: 'Comprar', emoji: '🟢', cls: 'buy' },
    mantener: { label: 'Mantener', emoji: '🟡', cls: 'hold' },
    vender: { label: 'Vender', emoji: '🔴', cls: 'sell' }
  };

  const Stocks = {
    data: null,
    listeners: new Set(),

    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit() { this.listeners.forEach(fn => { try { fn(this.data); } catch (e) { console.warn(e); } }); },

    cached() {
      const c = S.get(CACHE_KEY, null);
      return c && c.data && c.data.groups ? c : null;
    },

    // Datos de la bolsa (de la caché si tienen menos de 10 minutos)
    async load(force = false) {
      const c = this.cached();
      if (!this.data && c) this.data = c.data;
      if (!force && c && Date.now() - c.t < MAX_AGE) return this.data;
      if (this.loading) return this.loading;
      this.loading = (async () => {
        try {
          const res = await U.fetchWithTimeout(`${URL_DATA}?t=${Math.floor(Date.now() / 60000)}`, {}, 12000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!data || !data.groups) throw new Error('datos incompletos');
          this.data = data;
          S.set(CACHE_KEY, { t: Date.now(), data });
          this.emit();
        } catch (e) {
          if (!this.data) throw new Error(`No pude cargar la bolsa (${e.message}).`);
        } finally {
          this.loading = null;
        }
        return this.data;
      })();
      return this.loading;
    },

    signal(name) {
      return SIGNALS[name] || SIGNALS.mantener;
    },

    all(data = this.data) {
      if (!data) return [];
      return Object.entries(data.groups).flatMap(([group, g]) =>
        [...(g.indices || []), ...(g.items || [])].map(x => ({ ...x, group, groupTitle: g.title })));
    },

    // Busca un instrumento por símbolo o nombre ("apple", "ibc", "banco provincial", "oro")
    find(query, data = this.data) {
      const q = U.normalize(query).replace(/^(el|la|los|las)\s+/, '').trim();
      if (!q || q.length < 2) return null;
      const items = this.all(data);
      return items.find(x => U.normalize(x.symbol.replace(/[-=].*$/, '')) === q) ||
        items.find(x => U.normalize(x.name) === q) ||
        items.find(x => U.normalize(x.name).split(/[\s().]+/).includes(q)) ||
        (q.length >= 4 ? items.find(x => U.normalize(x.name).includes(q)) : null) || null;
    },

    // Instrumento nombrado en cualquier parte de una frase ("¿me conviene comprar bitcoin ya?").
    // Sólo nombres completos y símbolos de 3+ letras; "plata", "euro" y "dia" son palabras comunes.
    mentioned(text, data = this.data) {
      const t = ` ${U.normalize(text).replace(/[^a-z0-9&]+/g, ' ').trim()} `;
      const COMMON = new Set(['plata', 'euro', 'dia', 'env', 'oro y divisas']);
      const ALIAS = { btc: 'bitcoin', eth: 'ethereum', ether: 'ethereum', sol: 'solana', ripple: 'xrp', petroleo: 'petroleo wti', sp500: 's&p 500 (spy)', 's p 500': 's&p 500 (spy)', 'sp 500': 's&p 500 (spy)', nasdaq: 'nasdaq 100 (qqq)' };
      const items = this.all(data);
      for (const [alias, name] of Object.entries(ALIAS)) {
        if (t.includes(` ${alias} `)) {
          const x = items.find(i => U.normalize(i.name) === name);
          if (x) return x;
        }
      }
      let best = null;
      for (const x of items) {
        const names = [U.normalize(x.name).replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9&]+/g, ' ').trim(), U.normalize(x.symbol.replace(/[-=.].*$/, ''))];
        for (const k of names) {
          if (!k || k.length < 3 || COMMON.has(k)) continue;
          if (t.includes(` ${k} `) && (!best || k.length > best.k.length)) best = { x, k };
        }
      }
      return best ? best.x : null;
    },

    // Las mejores señales de compra y de venta (sin índices)
    recommendations(n = 3, data = this.data, group = null) {
      const items = this.all(data).filter(x => !x.isIndex && !x.stale && (!group || x.group === group));
      const buy = items.filter(x => x.signal === 'comprar').sort((a, b) => b.score - a.score || (b.ret1m || 0) - (a.ret1m || 0)).slice(0, n);
      const sell = items.filter(x => x.signal === 'vender').sort((a, b) => a.score - b.score || (a.ret1m || 0) - (b.ret1m || 0)).slice(0, n);
      return { buy, sell };
    },

    fmtPrice(x) {
      if (x.price === null || x.price === undefined) return '—';
      if (x.currency === 'VES') return U.fmtBs(x.price);
      const dec = Math.abs(x.price) < 10 ? 4 : 2;
      return x.currency === 'USD' ? `$${U.fmtNumber(x.price, dec)}` : `${U.fmtNumber(x.price, dec)} ${x.currency || ''}`.trim();
    },

    fmtChange(x) {
      if (x.changePct === null || x.changePct === undefined) return '';
      return `${x.changePct >= 0 ? '▲' : '▼'} ${U.fmtNumber(Math.abs(x.changePct), 2)} %`;
    },

    updatedLabel(data = this.data) {
      if (!data) return '';
      return `Actualizado ${U.timeAgo ? U.timeAgo(new Date(data.updatedAt).getTime()) : U.fmtDateTime(new Date(data.updatedAt).getTime())}`;
    },

    /* ---------- Tarjeta en Finanzas ---------- */
    mountUI() {
      const card = U.$('#stocksCard');
      if (!card || this.mounted) return;
      this.mounted = true;
      this.tab = S.getRaw('yarbis_bolsa_tab', 'bvc');
      const tabs = U.$('#stocksTabs');
      tabs.replaceChildren(...TABS.map(([id, label]) => U.el('button', {
        type: 'button', class: id === this.tab ? 'active' : '', dataset: { tab: id }, role: 'tab', 'aria-selected': id === this.tab ? 'true' : 'false',
        onClick: () => {
          this.tab = id;
          S.setRaw('yarbis_bolsa_tab', id);
          U.$$('#stocksTabs button').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === id);
            b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false');
          });
          this.render();
        }
      }, label)));
      U.$('#stocksRefresh').addEventListener('click', () => this.refreshUI(true));
      this.onChange(() => this.render());
      this.refreshUI(false);
    },

    async refreshUI(force) {
      const status = U.$('#stocksStatus');
      if (status) status.textContent = 'Cargando…';
      try {
        await this.load(force);
      } catch (e) {
        if (status) status.textContent = e.message;
      }
      this.render();
    },

    render() {
      if (!this.mounted) return;
      const el = U.el;
      const data = this.data;
      const list = U.$('#stocksList');
      const recs = U.$('#stocksRecs');
      U.$('#stocksStatus').textContent = data ? this.updatedLabel(data) : 'Sin datos todavía.';
      if (!data) {
        list.replaceChildren(el('p', { class: 'empty-state small', text: 'Toca "Actualizar" para cargar la bolsa.' }));
        recs.replaceChildren();
        return;
      }
      const g = data.groups[this.tab] || { items: [] };
      const r = this.recommendations(3, data, this.tab);
      const chips = (arr, sig) => arr.map(x => el('button', {
        type: 'button', class: `stock-chip ${SIGNALS[sig].cls}`, onClick: () => this.openDetail(x.symbol)
      }, `${x.name.length > 22 ? `${x.symbol}` : x.name}`));
      recs.replaceChildren(
        el('div', { class: 'stock-recs-row' }, el('span', { class: 'stock-recs-label', text: '🟢 Señales de compra' }),
          r.buy.length ? el('div', { class: 'chip-row' }, ...chips(r.buy, 'comprar')) : el('span', { class: 'muted small', text: 'Ninguna ahora' })),
        el('div', { class: 'stock-recs-row' }, el('span', { class: 'stock-recs-label', text: '🔴 Señales de venta' }),
          r.sell.length ? el('div', { class: 'chip-row' }, ...chips(r.sell, 'vender')) : el('span', { class: 'muted small', text: 'Ninguna ahora' })));

      const rows = [...(g.indices || []), ...(g.items || [])];
      list.replaceChildren(...(rows.length ? rows.map(x => this.row(x)) : [el('p', { class: 'empty-state small', text: g.error || 'Sin datos para este mercado.' })]));
      U.$('#stocksDisclaimer').textContent = `⚠️ ${data.disclaimer}`;
    },

    row(x) {
      const el = U.el;
      const sig = this.signal(x.signal);
      const open = this.openSymbol === x.symbol;
      const item = el('li', { class: `stock-item${x.isIndex ? ' index' : ''}${open ? ' open' : ''}`, dataset: { symbol: x.symbol } },
        el('button', { type: 'button', class: 'stock-main', 'aria-expanded': open ? 'true' : 'false', onClick: () => this.openDetail(x.symbol) },
          el('span', { class: 'stock-name' },
            el('strong', { text: x.name }),
            el('span', { class: 'note-meta', text: `${x.symbol}${x.tradedToday === false ? ' · sin operaciones hoy' : ''}${x.stale ? ' · dato anterior' : ''}` })),
          x.spark && x.spark.length > 2 && root.YarbisCharts ? root.YarbisCharts.sparkline(x.spark, { width: 72, height: 26, className: 'stock-spark' }) : el('span'),
          el('span', { class: 'stock-price' },
            el('strong', { text: this.fmtPrice(x) }),
            el('span', { class: x.changePct >= 0 ? 'up' : 'down', text: this.fmtChange(x) })),
          el('span', { class: `stock-signal ${sig.cls}`, text: sig.label })));
      if (open) item.appendChild(this.detail(x));
      return item;
    },

    detail(x) {
      const el = U.el;
      const fmt = (v) => (v === null || v === undefined ? '—' : this.fmtPrice({ ...x, price: v }));
      const pct = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${U.fmtNumber(v, 1)} %`);
      return el('div', { class: 'stock-detail' },
        el('ul', { class: 'stock-reasons' }, ...(x.reasons || []).map(t => el('li', { text: t }))),
        el('div', { class: 'stock-stats' },
          ...[['Promedio 20 días', fmt(x.sma20)], ['Promedio 50 días', fmt(x.sma50)], ['RSI (14)', x.rsi === null || x.rsi === undefined ? '—' : U.fmtNumber(x.rsi, 0)],
            ['1 mes', pct(x.ret1m)], ['3 meses', pct(x.ret3m)], ['Rango 1 año', `${fmt(x.low52)} – ${fmt(x.high52)}`]]
            .map(([k, v]) => el('div', { class: 'stock-stat' }, el('span', { class: 'muted small', text: k }), el('strong', { text: v })))));
    },

    openDetail(symbol) {
      const x = this.all().find(i => i.symbol === symbol);
      if (x && x.group !== this.tab) {
        const btn = U.$(`#stocksTabs button[data-tab="${x.group}"]`);
        if (btn) btn.click();
      }
      this.openSymbol = this.openSymbol === symbol ? null : symbol;
      this.render();
      const node = U.$(`#stocksList [data-symbol="${CSS.escape(symbol)}"]`);
      if (node && this.openSymbol) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  root.YarbisStocks = Stocks;
})(typeof window !== 'undefined' ? window : globalThis);
