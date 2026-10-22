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

/* ---------------- v12 ---------------- */

test('alarmas repetitivas: lunes a viernes salta el fin de semana', () => {
  const S = R.ScheduleStore;
  // Viernes 23/10/2026 a las 20:00 -> la próxima de 6:30 L-V es el lunes 26
  const friday = new Date(2026, 9, 23, 20, 0).getTime();
  const next = new Date(S.nextOccurrence(6, 30, 'weekdays', friday));
  assert.strictEqual(next.getDay(), 1);
  assert.strictEqual(next.getDate(), 26);
  const daily = new Date(S.nextOccurrence(6, 30, 'daily', friday));
  assert.strictEqual(daily.getDate(), 24);
  const tueThu = new Date(S.nextOccurrence(20, 0, [2, 4], friday));
  assert.strictEqual(tueThu.getDay(), 2);
});

test('alarma repetitiva por voz y se reprograma al sonar', async () => {
  const before = R.schedule.alarms.length;
  await ask('despiértame todos los días a las 6');
  const a = R.schedule.alarms.find(x => x.repeat === 'daily');
  assert.ok(a && R.schedule.alarms.length === before + 1);
  // Simula que ya sonó: queda programada para el día siguiente
  const rang = [];
  R.schedule.onRing = (e) => rang.push(e);
  a.at = Date.now() - 1000;
  R.schedule.tick();
  R.schedule.stopTicking();
  assert.strictEqual(rang.length, 1);
  assert.ok(R.schedule.alarms.some(x => x.id === a.id && x.at > Date.now()));
  R.schedule.onRing = null;
  assert.deepStrictEqual(globalThis.YARBISBrain.parseRepeat('cada martes y jueves a las 8'), [2, 4]);
});

test('listas: varios productos y lectura', async () => {
  R.notes.clearAll();
  assert.match((await ask('agrega leche, huevos y harina pan a la lista de compras')).text, /Leche, Huevos, Harina pan/);
  assert.match((await ask('pon arroz en la lista del mercado')).text, /Compras/);
  assert.match((await ask('qué hay en la lista de compras')).text, /Arroz[\s\S]*Harina pan/);
  assert.match((await ask('agrega leche a la lista de compras')).text, /ya está/);
  assert.strictEqual(R.notes.inList('Compras').length, 4);
});

test('comandos encadenados', async () => {
  R.schedule.cancelAllTimers();
  const r = await ask('pon un timer de 5 minutos y anota comprar pan');
  assert.match(r.text, /Temporizador[\s\S]*Anotado/);
  assert.strictEqual(r.effects.length, 1);
  // " y " dentro de una lista no se divide
  assert.strictEqual(brain.splitChain('agrega leche y huevos a la lista de compras').length, 1);
  R.schedule.cancelAllTimers();
});

test('alertas del dólar por voz', async () => {
  const F = win.YarbisFinance;
  F.alerts = [];
  const r = await ask('avísame cuando el dólar pase de 250');
  assert.match(r.text, /dólar BCV suba de Bs\. 250,00/);
  const r2 = await ask('alértame si el paralelo baja de 110');
  assert.match(r2.text, /paralelo baje de Bs\. 110,00/);
  assert.strictEqual(F.alerts.length, 2);
});

test('gastos por voz', async () => {
  const E = win.YarbisExpenses.store;
  E.items = [];
  assert.match((await ask('gasté 20 dólares en comida')).text, /\$20,00\*\* en Comida/);
  assert.match((await ask('pagué 5000 bs de luz')).text, /Bs\. 5\.000,00 \(≈ \$50,00\)\*\* en Servicios/);
  assert.match((await ask('¿cuánto he gastado este mes?')).text, /\$70,00/);
  assert.match((await ask('cuánto llevo en comida')).text, /\$20,00/);
});

test('presupuesto avisa al pasar del 80 %', async () => {
  const E = win.YarbisExpenses.store;
  E.items = [];
  E.setBudget(100);
  await ask('gasté 50 dólares en comida');
  assert.match((await ask('gasté 35 dólares en transporte')).text, /80 %/);
  E.setBudget(0);
});

test('Pago Móvil: mensaje de cobro', async () => {
  const PM = win.YarbisPagoMovil;
  assert.ok(PM.save({ bank: '0102', idType: 'V', id: '12345678', phone: '0414-123-4567' }));
  const msg = PM.message({ amountUsd: 10, amountBs: 1000 });
  assert.match(msg, /0102 - Banco de Venezuela/);
  assert.match(msg, /V-12\.345\.678/);
  assert.match(msg, /0414-1234567/);
  const r = await ask('cóbrale 10 dólares a mamá');
  assert.match(r.text, /Cobro para/);
  assert.match(r.actions[0].url, /^https:\/\/wa\.me\/584141234567\?text=/);
});

test('dictado: puntuación por voz', () => {
  const p = win.YarbisVoiceTools.punctuate;
  assert.strictEqual(p('hola coma qué tal punto nos vemos'), 'Hola, qué tal. Nos vemos');
  assert.strictEqual(p('lista dos puntos pan punto y aparte fin'), 'Lista: pan.\nFin');
});
