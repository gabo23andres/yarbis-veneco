'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/mathEngine.js');

test('operaciones básicas y precedencia', () => {
  assert.strictEqual(M.evaluate('2 + 3 * 4').value, 14);
  assert.strictEqual(M.evaluate('(2 + 3) * 4').value, 20);
  assert.strictEqual(M.evaluate('2^10').value, 1024);
  assert.strictEqual(M.evaluate('-2^2').value, -4);
  assert.strictEqual(M.evaluate('5!').value, 120);
  assert.strictEqual(M.evaluate('2(3+1)').value, 8);
});

test('porcentajes como calculadora', () => {
  assert.strictEqual(M.evaluate('200 + 10%').value, 220);
  assert.strictEqual(M.evaluate('200 - 10%').value, 180);
  assert.strictEqual(M.evaluate('50%').value, 0.5);
});

test('funciones y constantes', () => {
  assert.strictEqual(M.evaluate('sqrt(144)').value, 12);
  assert.strictEqual(M.evaluate('round(3.14159, 2)').value, 3.14);
  assert.ok(Math.abs(M.evaluate('2pi').value - 2 * Math.PI) < 1e-12);
});

test('coma decimal y separador de miles', () => {
  assert.strictEqual(M.evaluate('62,40*2').value, 124.8);
  assert.strictEqual(M.evaluate('2,500 + 1').value, 2501);
});

test('frases en español', () => {
  assert.strictEqual(M.evaluateNatural('cuánto es 5 más 3').value, 8);
  assert.strictEqual(M.evaluateNatural('cuánto es el 15% de 340').value, 51);
  assert.strictEqual(M.evaluateNatural('cinco por ciento de doscientos').value, 10);
  assert.strictEqual(M.evaluateNatural('calcula 2 elevado a 10').value, 1024);
  assert.strictEqual(M.evaluateNatural('raíz cuadrada de 81').value, 9);
  assert.strictEqual(M.evaluateNatural('cuanto es 10 entre 4').value, 2.5);
});

test('no confunde frases normales con cálculos', () => {
  assert.strictEqual(M.evaluateNatural('dime un chiste'), null);
  assert.strictEqual(M.evaluateNatural('pon un temporizador de 5 minutos'), null);
  assert.strictEqual(M.evaluateNatural('7'), null);
});

test('rechaza código y errores', () => {
  for (const bad of ['alert(1)', 'constructor', 'this', 'process.exit()', '1/0', '3 +', '"a"']) {
    assert.strictEqual(M.evaluate(bad), null, bad);
  }
});

test('fórmulas financieras', () => {
  const loan = M.Finance.loan(10000, 12, 12);
  assert.ok(Math.abs(loan.payment - 888.49) < 0.01);
  const dca = M.Finance.dca([{ amount: 100, price: 50 }, { amount: 100, price: 100 }]);
  assert.ok(Math.abs(dca.avgPrice - 66.6667) < 0.001);
  const ci = M.Finance.compound(1000, 12, 1, 12, 0);
  assert.ok(Math.abs(ci.finalAmount - 1126.83) < 0.01);
  const dev = M.Finance.devaluation(1000, 100, 125, 0);
  assert.strictEqual(dev.devaluationPct, 25);
  assert.strictEqual(dev.usdEnd, 8);
});
