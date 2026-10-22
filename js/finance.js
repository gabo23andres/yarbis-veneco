/* ==========================================================================
   YARBIS - SERVICIO FINANCIERO
   Tasas de Venezuela (BCV, paralelo, euro), criptomonedas y divisas globales.
   Cada grupo de datos guarda su fuente, hora de actualización y estado:
     live    -> recién obtenido de internet
     cache   -> último valor guardado (sin conexión ahora mismo)
     default -> valor estimado de respaldo (nunca se pudo conectar)
     manual  -> fijado por el usuario
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const CACHE_KEY = 'yarbis_fin_cache_v2';
  const MANUAL_KEY = 'yarbis_fx_manual';

  // Valores de respaldo (sólo si nunca hubo conexión). Se muestran como "estimados".
  const DEFAULTS = {
    fx: { bcv: 773.31, paralelo: 889.65, eur: 896.03 },
    crypto: {
      BTC: { price: 64792, change: 0 },
      ETH: { price: 1910, change: 0 },
      SOL: { price: 76.8, change: 0 },
      BNB: { price: 645, change: 0 },
      XRP: { price: 1.45, change: 0 }
    },
    fiat: {
      USD: 1, EUR: 0.92, GBP: 0.79, JPY: 154.5, CAD: 1.38, CHF: 0.88, CNY: 7.24,
      COP: 4120, BRL: 5.65, MXN: 19.8, PEN: 3.75, CLP: 940, ARS: 1040, RUB: 98.5
    }
  };

  const CURRENCIES = [
    { code: 'USD', label: 'Dólar (USD)', flag: '🇺🇸' },
    { code: 'VES_BCV', label: 'Bolívar · tasa BCV', flag: '🇻🇪' },
    { code: 'VES_PAR', label: 'Bolívar · tasa paralela', flag: '🇻🇪' },
    { code: 'USDT', label: 'Tether (USDT)', flag: '💵' },
    { code: 'EUR', label: 'Euro (EUR)', flag: '🇪🇺' },
    { code: 'COP', label: 'Peso colombiano', flag: '🇨🇴' },
    { code: 'BRL', label: 'Real brasileño', flag: '🇧🇷' },
    { code: 'MXN', label: 'Peso mexicano', flag: '🇲🇽' },
    { code: 'PEN', label: 'Sol peruano', flag: '🇵🇪' },
    { code: 'CLP', label: 'Peso chileno', flag: '🇨🇱' },
    { code: 'ARS', label: 'Peso argentino', flag: '🇦🇷' },
    { code: 'GBP', label: 'Libra esterlina', flag: '🇬🇧' },
    { code: 'CAD', label: 'Dólar canadiense', flag: '🇨🇦' },
    { code: 'JPY', label: 'Yen japonés', flag: '🇯🇵' },
    { code: 'CNY', label: 'Yuan chino', flag: '🇨🇳' },
    { code: 'BTC', label: 'Bitcoin', flag: '₿' },
    { code: 'ETH', label: 'Ethereum', flag: '◆' },
    { code: 'SOL', label: 'Solana', flag: '◎' },
    { code: 'BNB', label: 'BNB', flag: '🟡' },
    { code: 'XRP', label: 'XRP', flag: '✕' }
  ];

  const CRYPTO_CODES = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

  function emptyGroup(data) {
    return { data, updatedAt: 0, status: 'default', source: 'Valor estimado' };
  }

  class FinanceService {
    constructor() {
      const cached = S.get(CACHE_KEY, null);
      this.groups = {
        fx: emptyGroup({ ...DEFAULTS.fx }),
        crypto: emptyGroup(JSON.parse(JSON.stringify(DEFAULTS.crypto))),
        fiat: emptyGroup({ ...DEFAULTS.fiat })
      };
      if (cached) {
        ['fx', 'crypto', 'fiat'].forEach(k => {
          if (cached[k] && cached[k].data && cached[k].updatedAt) {
            this.groups[k] = { ...cached[k], status: 'cache' };
          }
        });
      }
      this.manual = S.get(MANUAL_KEY, null);
      this.listeners = new Set();
      this.inflight = null;
      this.autoTimer = null;

      // Limpieza de claves antiguas (v10)
      S.remove('yarbis_custom_fx');
      S.remove('yarbis_custom_crypto');
    }

    onChange(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    emit() {
      const rates = this.getRates();
      this.listeners.forEach(fn => {
        try { fn(rates); } catch (e) { console.warn(e); }
      });
    }

    save() {
      S.set(CACHE_KEY, this.groups);
    }

    /* ------------------------------------------
       DESCARGA
       ------------------------------------------ */
    async getJson(url, ms = 7000) {
      const res = await U.fetchWithTimeout(url, { cache: 'no-store' }, ms);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    async fetchVenezuela(fiat) {
      const out = {};
      let source = '';
      try {
        const list = await this.getJson('https://ve.dolarapi.com/v1/dolares');
        const arr = Array.isArray(list) ? list : [];
        const pick = (name) => arr.find(x => (x.fuente || '').toLowerCase() === name) ||
          arr.find(x => (x.nombre || '').toLowerCase().includes(name));
        const of = pick('oficial');
        const par = pick('paralelo');
        const val = (x) => x && Number(x.promedio || x.venta || x.compra);
        if (val(of)) out.bcv = val(of);
        if (val(par)) out.paralelo = val(par);
        if (of && of.fechaActualizacion) out.officialDate = of.fechaActualizacion;
        source = 'DolarApi (BCV / paralelo)';
      } catch (e) {
        console.warn('DolarApi no disponible:', e.message);
      }

      try {
        const eu = await this.getJson('https://ve.dolarapi.com/v1/euros', 5000);
        const arr = Array.isArray(eu) ? eu : [eu];
        const of = arr.find(x => (x.fuente || '').toLowerCase() === 'oficial') || arr[0];
        const v = of && Number(of.promedio || of.venta);
        if (v) out.eur = v;
      } catch (e) { /* se calcula abajo */ }

      if (!out.bcv) {
        // Respaldo: tasa oficial publicada por proveedores globales
        try {
          const d = await this.getJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
          if (d && d.usd && Number(d.usd.ves)) {
            out.bcv = Number(d.usd.ves);
            source = 'Currency-API (oficial aproximada)';
          }
        } catch (e) { /* sin respaldo */ }
      }
      if (!out.bcv && fiat && Number(fiat.VES)) {
        out.bcv = Number(fiat.VES);
        source = 'ExchangeRate-API (oficial aproximada)';
      }
      if (out.bcv && !out.eur && fiat && Number(fiat.EUR)) {
        out.eur = out.bcv / Number(fiat.EUR);
      }
      return { data: out, source };
    }

    async fetchCrypto() {
      try {
        const symbols = encodeURIComponent(JSON.stringify(CRYPTO_CODES.map(c => `${c}USDT`)));
        const list = await this.getJson(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symbols}`);
        const data = {};
        (Array.isArray(list) ? list : []).forEach(item => {
          const code = String(item.symbol || '').replace(/USDT$/, '');
          const price = Number(item.lastPrice);
          if (CRYPTO_CODES.includes(code) && price) {
            data[code] = { price, change: Number(item.priceChangePercent) || 0 };
          }
        });
        if (Object.keys(data).length) return { data, source: 'Binance' };
      } catch (e) {
        console.warn('Binance no disponible:', e.message);
      }
      try {
        const ids = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple' };
        const cg = await this.getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(ids).join(',')}&vs_currencies=usd&include_24hr_change=true`);
        const data = {};
        Object.entries(ids).forEach(([code, id]) => {
          if (cg[id] && cg[id].usd) data[code] = { price: Number(cg[id].usd), change: Number(cg[id].usd_24h_change) || 0 };
        });
        if (Object.keys(data).length) return { data, source: 'CoinGecko' };
      } catch (e) {
        console.warn('CoinGecko no disponible:', e.message);
      }
      return null;
    }

    async fetchFiat() {
      try {
        const json = await this.getJson('https://open.er-api.com/v6/latest/USD');
        if (json && json.rates && json.rates.EUR) return { data: json.rates, source: 'ExchangeRate-API' };
      } catch (e) {
        console.warn('ExchangeRate-API no disponible:', e.message);
      }
      try {
        const d = await this.getJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        if (d && d.usd) {
          const data = {};
          Object.entries(d.usd).forEach(([k, v]) => { data[k.toUpperCase()] = Number(v); });
          return { data, source: 'Currency-API' };
        }
      } catch (e) { /* sin respaldo */ }
      return null;
    }

    applyGroup(key, result, merge = false) {
      const g = this.groups[key];
      if (result && result.data && Object.keys(result.data).length) {
        this.groups[key] = {
          data: merge ? { ...g.data, ...result.data } : result.data,
          updatedAt: Date.now(),
          status: 'live',
          source: result.source || g.source
        };
      } else if (g.updatedAt) {
        g.status = 'cache';
      } else {
        g.status = 'default';
      }
    }

    refresh() {
      if (this.inflight) return this.inflight;
      this.inflight = (async () => {
        const [fiat, crypto] = await Promise.all([
          this.fetchFiat().catch(() => null),
          this.fetchCrypto().catch(() => null)
        ]);
        this.applyGroup('fiat', fiat);
        this.applyGroup('crypto', crypto, true);
        const ve = await this.fetchVenezuela(this.groups.fiat.data).catch(() => null);
        // Si sólo falta el paralelo, se conserva el último conocido
        this.applyGroup('fx', ve && ve.data.bcv ? ve : null, true);
        this.save();
        this.emit();
        return this.getRates();
      })().finally(() => { this.inflight = null; });
      return this.inflight;
    }

    // Refresca sólo si los datos tienen más de maxAgeMs
    async ensureFresh(maxAgeMs = 5 * 60 * 1000) {
      const oldest = Math.min(this.groups.fx.updatedAt, this.groups.crypto.updatedAt);
      if (!oldest || Date.now() - oldest > maxAgeMs) {
        try { await this.refresh(); } catch (e) { /* se usan datos guardados */ }
      }
      return this.getRates();
    }

    startAutoRefresh(intervalMs = 60000) {
      this.stopAutoRefresh();
      this.autoTimer = setInterval(() => {
        if (!root.document || !root.document.hidden) this.refresh();
      }, intervalMs);
    }

    stopAutoRefresh() {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }

    /* ------------------------------------------
       TASAS MANUALES
       ------------------------------------------ */
    setManual(values) {
      const clean = {};
      ['bcv', 'paralelo', 'eur', 'BTC', 'ETH', 'SOL'].forEach(k => {
        const v = Number(values && values[k]);
        if (v > 0) clean[k] = v;
      });
      this.manual = Object.keys(clean).length ? clean : null;
      if (this.manual) S.set(MANUAL_KEY, this.manual);
      else S.remove(MANUAL_KEY);
      this.emit();
    }

    clearManual() {
      this.setManual(null);
    }

    /* ------------------------------------------
       LECTURA Y CONVERSIÓN
       ------------------------------------------ */
    getRates() {
      const fx = { ...DEFAULTS.fx, ...this.groups.fx.data };
      const crypto = JSON.parse(JSON.stringify({ ...DEFAULTS.crypto, ...this.groups.crypto.data }));
      const fiat = { ...DEFAULTS.fiat, ...this.groups.fiat.data };
      let fxStatus = this.groups.fx.status;
      let cryptoStatus = this.groups.crypto.status;
      const m = this.manual;
      if (m) {
        if (m.bcv) fx.bcv = m.bcv;
        if (m.paralelo) fx.paralelo = m.paralelo;
        if (m.eur) fx.eur = m.eur;
        if (m.bcv || m.paralelo || m.eur) fxStatus = 'manual';
        ['BTC', 'ETH', 'SOL'].forEach(c => {
          if (m[c]) { crypto[c] = { price: m[c], change: 0 }; cryptoStatus = 'manual'; }
        });
      }
      if (!fx.eur && fiat.EUR) fx.eur = fx.bcv / fiat.EUR;
      return {
        bcv: fx.bcv,
        paralelo: fx.paralelo,
        eur: fx.eur,
        spread: fx.bcv ? ((fx.paralelo - fx.bcv) / fx.bcv) * 100 : 0,
        crypto,
        fiat,
        fx: { status: fxStatus, updatedAt: this.groups.fx.updatedAt, source: this.groups.fx.source },
        cryptoMeta: { status: cryptoStatus, updatedAt: this.groups.crypto.updatedAt, source: this.groups.crypto.source },
        fiatMeta: { status: this.groups.fiat.status, updatedAt: this.groups.fiat.updatedAt, source: this.groups.fiat.source },
        manual: !!m
      };
    }

    toUsd(amount, code, r) {
      if (code === 'USD' || code === 'USDT' || code === 'USDC') return amount;
      if (code === 'VES_BCV' || code === 'VES') return amount / r.bcv;
      if (code === 'VES_PAR') return amount / r.paralelo;
      if (r.crypto[code]) return amount * r.crypto[code].price;
      if (r.fiat[code]) return amount / r.fiat[code];
      return null;
    }

    fromUsd(usd, code, r) {
      if (code === 'USD' || code === 'USDT' || code === 'USDC') return usd;
      if (code === 'VES_BCV' || code === 'VES') return usd * r.bcv;
      if (code === 'VES_PAR') return usd * r.paralelo;
      if (r.crypto[code]) return usd / r.crypto[code].price;
      if (r.fiat[code]) return usd * r.fiat[code];
      return null;
    }

    convert(amount, from, to, rates) {
      const r = rates || this.getRates();
      const a = Number(amount);
      if (!isFinite(a)) return null;
      // El euro contra bolívar usa la tasa oficial del euro directamente
      if (from === 'EUR' && to === 'VES_BCV') return a * r.eur;
      if (from === 'VES_BCV' && to === 'EUR') return a / r.eur;
      const usd = this.toUsd(a, from, r);
      if (usd === null) return null;
      return this.fromUsd(usd, to, r);
    }

    format(value, code) {
      if (value === null || value === undefined || !isFinite(value)) return '—';
      if (code === 'VES_BCV' || code === 'VES_PAR' || code === 'VES') return U.fmtBs(value);
      if (code === 'USD') return U.fmtUsd(value);
      if (code === 'USDT') return `${U.fmtNumber(value, 2)} USDT`;
      if (code === 'EUR') return `€${U.fmtNumber(value, 2)}`;
      if (CRYPTO_CODES.includes(code)) return `${U.fmtCrypto(value)} ${code}`;
      if (['COP', 'CLP', 'JPY', 'ARS'].includes(code)) return `${U.fmtNumber(value, 0)} ${code}`;
      return `${U.fmtNumber(value, 2)} ${code}`;
    }

    statusLabel(meta) {
      if (!meta) return '';
      if (meta.status === 'manual') return 'Tasa manual';
      if (meta.status === 'live') return `En vivo · ${U.fmtTime(meta.updatedAt)}`;
      if (meta.status === 'cache') return `Sin conexión · dato ${U.timeAgo(meta.updatedAt)}`;
      return 'Sin conexión · valor estimado';
    }
  }

  root.YarbisFinance = new FinanceService();
  root.YarbisFinance.CURRENCIES = CURRENCIES;
  root.YarbisFinance.CRYPTO_CODES = CRYPTO_CODES;
})(typeof window !== 'undefined' ? window : globalThis);
