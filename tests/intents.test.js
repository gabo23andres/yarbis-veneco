'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./setup.js');

const { brain, win } = loadApp();
const R = win.YarbisReminders;
const ask = (text) => brain.process(text);

test.after(() => R.schedule.stopTicking());

test('dólar: tasas y conversiones con datos en vivo', async () => {
  const rates = await ask('¿A cómo está el dólar?');
  assert.match(rates.text, /Dólar BCV:\*\* Bs\. 100,00/);
  assert.match(rates.text, /Paralelo:\*\* Bs\. 120,00/);

  assert.match((await ask('100 dólares a bolívares')).text, /\$100,00 = Bs\. 10\.000,00/);
  assert.match((await ask('cuánto son 6000 bs en dólares a tasa paralela')).text, /Bs\. 6\.000,00 = \$50,00/);
  assert.match((await ask('$50 a bolívares')).text, /Bs\. 5\.000,00/);
  assert.match((await ask('50 euros a bolivares')).text, /Bs\. 5\.500,00/);
});

test('palabras parecidas no activan cripto ni apps', async () => {
  for (const text of ['solución de la tarea de física', 'qué opinas de la máxima de Kant', 'cuál es la realidad del país']) {
    const r = await ask(text);
    assert.strictEqual(r.text, '__AI__', text);
  }
});

test('cálculos', async () => {
  assert.match((await ask('cuánto es el 15% de 340')).text, /\*\*51\*\*/);
  assert.match((await ask('cuanto es 2 elevado a 10')).text, /1\.024/);
});

test('temporizadores', async () => {
  R.schedule.cancelAllTimers();
  await ask('temporizador de 1 hora 30 minutos');
  await ask('recuérdame en 20 minutos sacar la pizza');
  await ask('pon un timer de media hora');
  const t = R.schedule.timers.map(x => [x.label, x.durationMs / 1000]);
  assert.deepStrictEqual(t[0][1], 5400);
  assert.deepStrictEqual(t[1], ['Sacar la pizza', 1200]);
  assert.deepStrictEqual(t[2][1], 1800);
  await ask('cancela el temporizador');
  assert.strictEqual(R.schedule.timers.length, 0);
});

test('alarmas con hora y motivo', async () => {
  await ask('alarma a las 7:30 pm para ir al gimnasio');
  const a = R.schedule.alarms.find(x => x.label === 'Ir al gimnasio');
  assert.ok(a, 'existe la alarma');
  const d = new Date(a.at);
  assert.strictEqual(d.getHours(), 19);
  assert.strictEqual(d.getMinutes(), 30);

  await ask('recuérdame a las 5 pm llamar a mamá');
  assert.ok(R.schedule.alarms.some(x => x.label === 'Llamar a mamá' && new Date(x.at).getHours() === 17));

  await ask('pon una alarma para mañana a las 3 y media de la tarde');
  const m = R.schedule.alarms.find(x => new Date(x.at).getHours() === 15 && new Date(x.at).getMinutes() === 30);
  assert.ok(m, 'alarma de mañana 15:30');
  assert.notStrictEqual(new Date(m.at).toDateString(), new Date().toDateString());
});

test('notas por voz', async () => {
  R.notes.clearAll();
  assert.match((await ask('anota comprar harina PAN')).text, /Anotado: "Comprar harina PAN"/);
  assert.match((await ask('lee mis notas')).text, /Comprar harina PAN/);
  await ask('marca como hecha la de harina');
  assert.strictEqual(R.notes.items[0].done, true);
  await ask('agrega una nota que dice llamar al plomero');
  await ask('borra la nota del plomero');
  assert.strictEqual(R.notes.items.length, 1);
});

test('contactos, llamadas y WhatsApp', async () => {
  await ask('guarda el contacto Mamá 0414 1234567');
  const call = await ask('llama a mamá');
  assert.strictEqual(call.effect.url, 'tel:04141234567');
  const wa = await ask('manda un whatsapp a mamá que diga ya voy en camino');
  assert.strictEqual(wa.effect.url, 'https://wa.me/584141234567?text=ya%20voy%20en%20camino');
  assert.strictEqual((await ask('llama al 0412-555-1234')).effect.url, 'tel:04125551234');
  assert.match((await ask('manda un whatsapp a pedro que diga hola')).text, /No tengo el número de Pedro/);
});

test('abrir apps, rutas, música y temas', async () => {
  assert.strictEqual((await ask('abre instagram')).effect.url, 'https://www.instagram.com');
  assert.strictEqual((await ask('abre banesco')).effect.url, 'https://www.banesconline.com/');
  assert.match((await ask('cómo llego al Sambil de Chacaíto')).effect.url, /maps\/dir\/.*Sambil%20de%20Chaca%C3%ADto/);
  assert.match((await ask('pon salsa baúl')).effect.url, /open\.spotify\.com\/search\/salsa%20ba%C3%BAl/);
  assert.deepStrictEqual((await ask('pon el tema verde')).effect, { type: 'THEME', accent: 'stealth' });
  assert.deepStrictEqual((await ask('modo oscuro')).effect, { type: 'THEME', mode: 'dark' });
  assert.strictEqual((await ask('abre las notas')).effect.view, 'notes');
  assert.strictEqual((await ask('abre finanzas')).effect.view, 'finance');
});

test('cámara y otras órdenes', async () => {
  assert.deepStrictEqual((await ask('escanea un código qr')).effect, { type: 'OPEN_CAMERA', mode: 'qr' });
  assert.strictEqual((await ask('oye yarbis, activa manos libres')).effect.on, true);
  assert.strictEqual((await ask('silencio')).effect.type, 'STOP');
  const name = await ask('me llamo Gabriel');
  assert.strictEqual(brain.userName, 'Gabriel');
  assert.strictEqual(name.effect.type, 'PROFILE');
});

test('lo desconocido va a la IA', async () => {
  assert.strictEqual((await ask('explícame la teoría de la relatividad')).text, '__AI__');
});

test('clima: prefiere la ciudad venezolana con el mismo nombre', () => {
  const results = [
    { name: 'Mérida', country: 'México', country_code: 'MX' },
    { name: 'Mérida', country: 'Venezuela', country_code: 'VE' },
    { name: 'Mérida', country: 'España', country_code: 'ES' }
  ];
  assert.strictEqual(brain.pickPlace(results, 'va a llover manana en merida').country_code, 'VE');
  assert.strictEqual(brain.pickPlace(results, 'clima en merida espana').country_code, 'ES');
  assert.strictEqual(brain.pickPlace([{ name: 'Madrid', country: 'España', country_code: 'ES' }], 'clima en madrid').name, 'Madrid');
  assert.strictEqual(brain.pickPlace([], 'clima'), null);
});

test('clave de Gemini: acepta el formato nuevo "AQ." y rechaza basura', async () => {
  const bad = await brain.testGeminiApiKey('hola');
  assert.strictEqual(bad.success, false);
  // Con formato válido sí intenta conectarse (aquí falla porque no hay red)
  const saved = globalThis.fetch;
  let called = '';
  globalThis.fetch = async (url, opts) => { called = opts && opts.headers && opts.headers['x-goog-api-key']; throw new Error('sin red'); };
  try {
    const r = await brain.testGeminiApiKey('AQ.FAKE_test_key_0000000000000000');
    assert.strictEqual(r.success, false);
    assert.strictEqual(called, 'AQ.FAKE_test_key_0000000000000000');
  } finally {
    globalThis.fetch = saved;
  }
});
