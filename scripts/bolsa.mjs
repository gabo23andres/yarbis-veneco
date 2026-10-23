// YARBIS - Datos de la bolsa para la app.
// Lo ejecuta GitHub Actions (.github/workflows/bolsa.yml) cada 20 minutos en
// horario de mercado: baja precios de la Bolsa de Caracas y de Yahoo Finance
// (EE. UU., fondos, oro, divisas y cripto), calcula indicadores técnicos y
// señales, y escribe bolsa.json en la rama "datos". La app lo lee desde
// raw.githubusercontent.com (esas páginas no dejan leerse desde otra web).
//
// Uso: node scripts/bolsa.mjs <salida.json> [anterior.json]
import { readFileSync, writeFileSync } from 'node:fs';

const [OUT = 'bolsa.json', PREV] = process.argv.slice(2);
const UA = { 'User-Agent': 'Mozilla/5.0 (YARBIS; +https://gabo23andres.github.io/yarbis-veneco/)' };

export const GROUPS = {
  us: { title: 'EE. UU.', items: [['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'Nvidia'], ['TSLA', 'Tesla'], ['AMZN', 'Amazon'], ['GOOGL', 'Google'], ['META', 'Meta'], ['NFLX', 'Netflix'], ['AMD', 'AMD'], ['JPM', 'JPMorgan'], ['KO', 'Coca-Cola'], ['MCD', "McDonald's"]] },
  etf: { title: 'Fondos', items: [['SPY', 'S&P 500 (SPY)'], ['VOO', 'S&P 500 (VOO)'], ['QQQ', 'Nasdaq 100 (QQQ)'], ['DIA', 'Dow Jones (DIA)'], ['IWM', 'Pequeñas empresas (IWM)'], ['VT', 'Todo el mundo (VT)']] },
  commodities: { title: 'Oro y divisas', items: [['GC=F', 'Oro (onza)'], ['SI=F', 'Plata (onza)'], ['CL=F', 'Petróleo WTI'], ['EURUSD=X', 'Euro / Dólar'], ['COP=X', 'Dólar / Peso colombiano']] },
  crypto: { title: 'Cripto', items: [['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum'], ['SOL-USD', 'Solana'], ['BNB-USD', 'BNB'], ['XRP-USD', 'XRP']] }
};

/* ---------- Indicadores ---------- */
export function sma(values, n) {
  if (values.length < n) return null;
  const s = values.slice(-n);
  return s.reduce((a, b) => a + b, 0) / n;
}

export function rsi(values, n = 14) {
  if (values.length <= n) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function ret(values, days) {
  if (values.length <= days) return null;
  const a = values[values.length - 1 - days];
  return a ? ((values[values.length - 1] - a) / a) * 100 : null;
}

const r1 = (x) => (x === null || x === undefined || !isFinite(x) ? null : Math.round(x * 100) / 100);
const fmt = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(2));

// Señal técnica educativa: suma puntos a favor y en contra, con las razones
export function signal(closes) {
  const price = closes[closes.length - 1];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const r = rsi(closes);
  const m1 = ret(closes, 21);
  const m3 = ret(closes, 63);
  const reasons = [];
  let score = 0;
  if (closes.length < 20) {
    return { signal: 'mantener', score: 0, reasons: ['Aún hay pocos días de historial para dar una señal.'] };
  }
  if (s50 !== null) {
    if (price > s50) { score += 1; reasons.push(`Precio por encima de su promedio de 50 días (${fmt(s50)}): tendencia alcista.`); }
    else { score -= 1; reasons.push(`Precio por debajo de su promedio de 50 días (${fmt(s50)}): tendencia bajista.`); }
  }
  if (s20 !== null && s50 !== null) {
    if (s20 > s50) { score += 1; reasons.push('El promedio de 20 días está sobre el de 50: el impulso reciente es positivo.'); }
    else { score -= 1; reasons.push('El promedio de 20 días está bajo el de 50: el impulso reciente es negativo.'); }
  } else if (s20 !== null) {
    if (price > s20) { score += 0.5; reasons.push('Precio sobre su promedio de 20 días.'); } else { score -= 0.5; reasons.push('Precio bajo su promedio de 20 días.'); }
  }
  if (r !== null) {
    if (r < 30) { score += 1.5; reasons.push(`RSI ${r.toFixed(0)}: sobrevendido, podría rebotar.`); }
    else if (r > 70) { score -= 1.5; reasons.push(`RSI ${r.toFixed(0)}: sobrecomprado, podría corregir.`); }
    else reasons.push(`RSI ${r.toFixed(0)}: zona neutral.`);
  }
  if (m1 !== null) {
    if (m1 > 8) { score += 0.5; reasons.push(`Subió ${m1.toFixed(1)} % en el último mes.`); }
    else if (m1 < -10) { score -= 0.5; reasons.push(`Bajó ${Math.abs(m1).toFixed(1)} % en el último mes.`); }
  }
  if (m3 !== null && m3 < -25) { score -= 0.5; reasons.push(`Cayó ${Math.abs(m3).toFixed(1)} % en 3 meses.`); }
  const sig = score >= 1.5 ? 'comprar' : score <= -1.5 ? 'vender' : 'mantener';
  return { signal: sig, score: r1(score), reasons };
}

export function describe(symbol, name, closes, extra = {}) {
  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const year = closes.slice(-252);
  return {
    symbol, name,
    price: r1(price),
    changePct: extra.changePct !== undefined ? r1(extra.changePct) : (prev ? r1(((price - prev) / prev) * 100) : null),
    sma20: r1(sma(closes, 20)), sma50: r1(sma(closes, 50)), rsi: r1(rsi(closes)),
    ret1m: r1(ret(closes, 21)), ret3m: r1(ret(closes, 63)),
    high52: r1(Math.max(...year)), low52: r1(Math.min(...year)),
    spark: closes.slice(-60).map(r1),
    ...signal(closes),
    ...extra
  };
}

/* ---------- Yahoo Finance ---------- */
async function yahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const data = await res.json();
  const r = data.chart && data.chart.result && data.chart.result[0];
  if (!r) throw new Error(`${symbol}: sin datos`);
  const closes = (r.indicators.quote[0].close || []).filter(x => typeof x === 'number');
  const meta = r.meta || {};
  // El precio de ahora (si el mercado está abierto) y la variación contra el cierre anterior
  const live = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
  const prevClose = meta.chartPreviousClose || meta.previousClose;
  if (live && closes.length && Math.abs(live - closes[closes.length - 1]) / live > 0.0001) closes[closes.length - 1] = live;
  return { closes, currency: meta.currency || 'USD', changePct: live && meta.previousClose ? ((live - meta.previousClose) / meta.previousClose) * 100 : undefined, prevClose };
}

/* ---------- Bolsa de Caracas ---------- */
const BVC = 'https://www.bolsadecaracas.com/wp-admin/admin-ajax.php';
async function bvcPost(body) {
  const res = await fetch(BVC, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`BVC: HTTP ${res.status}`);
  const text = await res.text();
  let data = JSON.parse(text);
  if (typeof data === 'string') data = JSON.parse(data);
  return data;
}

const num = (x) => (x === null || x === undefined || x === '' ? null : Number(String(x).replace(',', '.')));
const today = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); // hora de Venezuela

async function bolsaCaracas(prev) {
  const history = { ...((prev && prev.bvcHistory) || {}) };
  const out = { title: 'Caracas', currency: 'VES', items: [] };
  // Índices (IBC, financiero, industrial) con un año de historia diaria
  try {
    const charts = await bvcPost('action=chartsData&indice=ibc&variacion=');
    const index = (key, name, code) => {
      const daily = (charts[key] || []).map(p => num(p.PRECIO)).filter(x => x > 0);
      if (daily.length < 2) return null;
      const intraday = (charts[key.replace('_ANUAL', '')] || []).map(p => num(p.PRECIO)).filter(x => x > 0);
      const closes = daily.slice();
      if (intraday.length) closes.push(intraday[intraday.length - 1]);
      return describe(code, name, closes, { currency: 'VES', isIndex: true });
    };
    out.indices = [index('CUR_IBC_ANUAL', 'Índice Bursátil Caracas (IBC)', 'IBC'), index('CUR_FIN_ANUAL', 'Índice Financiero', 'IFC'), index('CUR_IND_ANUAL', 'Índice Industrial', 'IIC')].filter(Boolean);
  } catch (e) {
    out.error = `Índices: ${e.message}`;
  }
  // Acciones que se negociaron hoy, más las conocidas que no
  try {
    const rows = await bvcPost('action=resumenMercadoRentaVariable');
    const d = today();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const sym = row.COD_SIMB;
      const price = num(row.PRECIO);
      if (!sym || !(price > 0)) return;
      const h = (history[sym] || []).filter(([day]) => day !== d);
      h.push([d, price]);
      history[sym] = h.slice(-260);
      out.items.push(describe(sym, String(row.DESC_SIMB || sym).replace(/\s+/g, ' ').trim(), h.map(x => x[1]), {
        currency: 'VES', changePct: num(row.VAR_REL), volume: num(row.VOLUMEN), amountBs: num(row.MONTO_EFECTIVO), time: row.HORA || null, tradedToday: true
      }));
    });
  } catch (e) {
    out.error = [out.error, `Acciones: ${e.message}`].filter(Boolean).join(' · ');
  }
  // Las que no se negociaron hoy siguen en la lista con su último precio
  const seen = new Set(out.items.map(x => x.symbol));
  ((prev && prev.groups && prev.groups.bvc && prev.groups.bvc.items) || []).forEach(old => {
    if (seen.has(old.symbol) || !history[old.symbol]) return;
    const h = history[old.symbol].map(x => x[1]);
    out.items.push(describe(old.symbol, old.name, h, { currency: 'VES', changePct: 0, tradedToday: false }));
  });
  out.items.sort((a, b) => (b.amountBs || 0) - (a.amountBs || 0));
  return { group: out, history };
}

async function main() {
  let prev = {};
  try { if (PREV) prev = JSON.parse(readFileSync(PREV, 'utf8')); } catch (e) { prev = {}; }
  const groups = {};
  const errors = [];
  const { group: bvc, history } = await bolsaCaracas(prev);
  groups.bvc = bvc;
  if (bvc.error) errors.push(bvc.error);
  for (const [key, g] of Object.entries(GROUPS)) {
    const items = [];
    for (const [symbol, name] of g.items) {
      try {
        const y = await yahoo(symbol);
        if (y.closes.length < 2) throw new Error(`${symbol}: muy pocos datos`);
        items.push(describe(symbol, name, y.closes, { currency: y.currency, ...(y.changePct !== undefined ? { changePct: y.changePct } : {}) }));
      } catch (e) {
        errors.push(e.message);
        const old = prev.groups && prev.groups[key] && prev.groups[key].items.find(x => x.symbol === symbol);
        if (old) items.push({ ...old, stale: true });
      }
    }
    groups[key] = { title: g.title, items };
  }
  const data = {
    updatedAt: new Date().toISOString(),
    disclaimer: 'Señales automáticas con indicadores técnicos (promedios móviles, RSI y rendimiento). Son educativas, no son asesoría financiera: invierte sólo lo que puedas perder.',
    groups,
    bvcHistory: history,
    errors
  };
  writeFileSync(OUT, JSON.stringify(data));
  const count = Object.values(groups).reduce((a, g) => a + g.items.length + ((g.indices && g.indices.length) || 0), 0);
  console.log(`bolsa.json: ${count} instrumentos, ${errors.length} errores${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  if (!count) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
