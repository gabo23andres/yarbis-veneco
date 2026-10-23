'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { loadApp } = require('./setup.js');

const { brain, win } = loadApp();
const B = win.YarbisStocks;
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'bolsa.json'), 'utf8'));
// Datos de prueba en la caché: la app no sale a internet
win.localStorage.setItem('yarbis_bolsa', JSON.stringify({ t: Date.now(), data: FIXTURE }));
const ask = (text) => brain.process(text);

test.after(() => win.YarbisReminders.schedule.stopTicking());

test('indicadores y señales del robot de la bolsa', async () => {
  const m = await import(path.join(__dirname, '..', 'scripts', 'bolsa.mjs'));
  assert.strictEqual(m.sma([1, 2, 3, 4], 2), 3.5);
  assert.strictEqual(m.sma([1, 2], 3), null);
  assert.strictEqual(m.ret([100, 110], 1), 10);
  assert.strictEqual(m.rsi(Array.from({ length: 20 }, (_, i) => i + 1)), 100);

  // Sube con altibajos (como un mercado real)
  const up = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5 + Math.sin(i * 0.9) * 5);
  const down = up.slice().reverse();
  assert.strictEqual(m.signal(up).signal, 'comprar');
  assert.strictEqual(m.signal(down).signal, 'vender');
  assert.match(m.signal(up).reasons.join(' '), /por encima de su promedio de 50 días/);
  // Subida perfecta sin pausas: sobrecomprada, mejor esperar
  const steep = Array.from({ length: 80 }, (_, i) => 100 + i * 0.6);
  assert.strictEqual(m.signal(steep).signal, 'mantener');
  assert.match(m.signal(steep).reasons.join(' '), /sobrecomprado/);
  // Pocos datos: no se arriesga
  const few = m.signal([10, 11, 12]);
  assert.strictEqual(few.signal, 'mantener');
  assert.match(few.reasons[0], /pocos días/);
  // Caída fuerte con RSI muy bajo: posible rebote
  const crash = Array.from({ length: 60 }, (_, i) => 100 - i * 1.5);
  assert.match(m.signal(crash).reasons.join(' '), /sobrevendido/);

  const d = m.describe('AAA', 'Prueba', up, { currency: 'USD' });
  assert.strictEqual(d.spark.length, 60);
  assert.ok(d.high52 >= d.price && d.low52 <= d.price);
});

test('buscar instrumentos y recomendaciones', async () => {
  await B.load();
  assert.strictEqual(B.find('apple').symbol, 'AAPL');
  assert.strictEqual(B.find('IBC').symbol, 'IBC');
  assert.strictEqual(B.find('oro').symbol, 'GC=F');
  assert.strictEqual(B.find('bitcoin').symbol, 'BTC-USD');
  assert.strictEqual(B.find('xyz123'), null);
  const r = B.recommendations(3);
  assert.ok(r.buy.length && r.buy.every(x => x.signal === 'comprar' && !x.isIndex));
  assert.ok(r.sell.every(x => x.signal === 'vender'));
  assert.ok(B.recommendations(3, B.data, 'us').buy.every(x => x.group === 'us'));
  assert.strictEqual(B.fmtPrice({ price: 9333.25, currency: 'VES' }), 'Bs. 9.333,25');
  assert.strictEqual(B.fmtPrice({ price: 1.1234, currency: 'USD' }), '$1,1234');
});

test('la bolsa por voz', async () => {
  let r = await ask('¿cómo está la bolsa de Caracas?');
  assert.match(r.text, /Bolsa · Caracas/);
  assert.match(r.text, /Índice Bursátil Caracas \(IBC\)/);
  assert.match(r.text, /no son asesoría financiera/);

  r = await ask('¿qué acciones me recomiendas comprar?');
  assert.match(r.text, /Para comprar:/);
  assert.match(r.text, /Para vender:/);
  assert.match(r.speak, /no asesoría/);

  r = await ask('¿qué acciones de Estados Unidos me recomiendas comprar?');
  assert.match(r.text, /Señales de la bolsa \(EE\. UU\.\)/);
  assert.doesNotMatch(r.text, /Bitcoin/);

  r = await ask('¿cómo está Apple?');
  assert.match(r.text, /\*\*Apple\*\* \(AAPL\): \$/);
  assert.match(r.text, /Señal: \*\*Comprar\*\*/);

  r = await ask('¿compro oro?');
  assert.match(r.text, /Oro \(onza\)/);

  // El dólar, el euro y el bitcoin siguen yendo a sus propias respuestas
  assert.match((await ask('¿cómo está el dólar?')).text, /Dólar BCV/);
  assert.match((await ask('¿cómo está el euro?')).text, /Euro BCV/);
  assert.doesNotMatch((await ask('¿cómo está el bitcoin?')).text, /Señal:/);
});

test('Gemini: herramienta de la bolsa', async () => {
  const out = { effects: [], actions: [], sound: null, tools: [] };
  const one = await win.YarbisGemini.execute(brain, 'bolsa', { consulta: 'Tesla' }, out);
  assert.strictEqual(one.simbolo, 'TSLA');
  assert.ok(one.razones.length);
  assert.match(one.aviso, /no son asesoría/);
  const all = await win.YarbisGemini.execute(brain, 'bolsa', { mercado: 'crypto' }, out);
  assert.ok(all.vender.every(x => /-USD$/.test(x.simbolo)));
  assert.ok(win.YarbisGemini.TOOLS.some(t => t.name === 'bolsa'));
});
