'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./setup.js');

const { brain, win } = loadApp();
const X = win.YarbisExpenses;
const I = X.incomes;
const E = X.store;
const ask = (text) => brain.process(text);

test.after(() => win.YarbisReminders.schedule.stopTicking());

const last = () => I.items[0];

test('ingresos por voz: regalos, sueldo, remesas y ventas', async () => {
  let r = await ask('me regalaron 20 dólares por mi cumpleaños');
  assert.match(r.text, /Ingreso registrado: \*\*\$20,00\*\* · Regalo · Mi cumpleaños/);
  assert.deepStrictEqual([last().amount, last().currency, last().category], [20, 'USD', 'Regalo']);

  r = await ask('mi papá me dio 10$');
  assert.strictEqual(last().category, 'Regalo');
  assert.strictEqual(last().note, 'De mi papá');

  await ask('me pagaron el sueldo, 300 dólares');
  assert.deepStrictEqual([last().amount, last().category], [300, 'Sueldo']);

  await ask('me llegó una remesa de 100 dólares');
  assert.deepStrictEqual([last().amount, last().category, last().note], [100, 'Remesa', 'Remesa']);

  await ask('vendí unas tortas por 15 dólares');
  assert.deepStrictEqual([last().amount, last().category, last().note], [15, 'Ventas', 'Tortas']);

  await ask('me transfirieron 2000 bs');
  assert.deepStrictEqual([last().amount, last().currency, last().usd], [2000, 'VES', 20]);

  await ask('cobré 40 por una clase');
  assert.deepStrictEqual([last().amount, last().category], [40, 'Trabajo extra']);

  await ask('me prestaron 50 dólares');
  assert.strictEqual(last().category, 'Préstamo');

  await ask('me dieron veinte dólares');
  assert.strictEqual(last().amount, 20);

  await ask('registra un ingreso de 5$');
  assert.strictEqual(last().amount, 5);
});

test('frases que no son ingresos no se registran', async () => {
  const before = I.items.length;
  for (const t of ['mi mamá me dio 2 consejos', 'me dieron ganas de comer', 'me llegó el pedido', 'me mandó un mensaje', 'me dio 3 besos']) {
    await ask(t);
  }
  assert.strictEqual(I.items.length, before);
});

test('balance ligado a los gastos', async () => {
  I.items = [];
  E.items = [];
  I.save();
  E.save();
  await ask('me pagaron 300 dólares de sueldo');
  const g = await ask('gasté 50 dólares en comida');
  // Al registrar un gasto también se ve cuánto queda
  assert.match(g.text, /Este mes: entró \$300,00, salió \$50,00 → te quedan \*\*\$250,00\*\*/);

  const b = await ask('¿cuánto me queda?');
  assert.match(b.text, /te quedan \*\*\$250,00\*\* \(≈ Bs\. 25\.000,00\)/);
  assert.match(b.speak, /Te quedan 250/);
  assert.match((await ask('cuál es mi balance')).text, /entró \$300,00/);
  assert.match((await ask('cómo voy con la plata este mes')).text, /salió \$50,00/);

  await ask('gasté 400 dólares en el alquiler');
  assert.match((await ask('cuánto me queda')).text, /gastaste \*\*\$150,00\*\* más de lo que entró/);

  const q = await ask('¿cuánto me ha entrado este mes?');
  assert.match(q.text, /te entraron \*\*\$300,00\*\*/);
  assert.match(q.text, /💼 Sueldo: \$300,00/);

  const bal = X.balance();
  assert.deepStrictEqual([bal.incomeUsd, bal.expenseUsd, bal.balanceUsd], [300, 450, -150]);
  // Los ingresos no cuentan para el presupuesto de gastos
  assert.strictEqual(I.budget, 0);
});

test('Gemini: herramientas registrar_ingreso y balance_del_mes', async () => {
  I.items = [];
  E.items = [];
  I.save();
  E.save();
  const G = win.YarbisGemini;
  const out = { effects: [], actions: [], sound: null, tools: [] };
  const r1 = await G.execute(brain, 'registrar_ingreso', { monto: 25, moneda: 'USD', categoria: 'Regalo', nota: 'De mi abuela' }, out);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.le_queda_usd, 25);
  assert.strictEqual(I.items[0].note, 'De mi abuela');
  await G.execute(brain, 'registrar_gasto', { monto: 5, moneda: 'USD', categoria: 'Comida' }, out);
  const r2 = await G.execute(brain, 'balance_del_mes', {}, out);
  assert.deepStrictEqual([r2.entro_usd, r2.salio_usd, r2.le_queda_usd], [25, 5, 20]);
  assert.ok(G.TOOLS.some(t => t.name === 'registrar_ingreso'));
  assert.match(brain.personalContext(), /Ingresos de este mes: \$25,00 \(Regalo \$25,00\); le quedan \$20,00/);
});
