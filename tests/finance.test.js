'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./setup.js');

const { win } = loadApp();
const F = win.YarbisFinance;
win.YarbisReminders.schedule.stopTicking();

test('historial: un punto por hora como máximo', () => {
  F.history = [];
  const h = 3600000;
  const base = Math.floor(Date.now() / h) * h - 5 * h;
  F.recordHistory(100, 120, base + 60000);
  F.recordHistory(101, 121, base + 120000);   // misma hora: reemplaza
  F.recordHistory(102, 122, base + h + 1000); // hora siguiente: nuevo punto
  assert.strictEqual(F.history.length, 2);
  assert.strictEqual(F.history[0].bcv, 101);
  assert.ok(Math.abs(F.change('bcv', 1) - ((102 - 101) / 101) * 100) < 1e-9);
});

test('alertas: se disparan al cruzar y son de un solo uso', () => {
  F.alerts = [];
  F.addAlert('bcv', 'above', 105);
  F.addAlert('paralelo', 'below', 110);
  const fired = [];
  const off = F.onAlert(a => fired.push(a));
  F.groups.fx.data = { bcv: 100, paralelo: 120, eur: 110 };
  assert.strictEqual(F.checkAlerts().length, 0);
  F.groups.fx.data = { bcv: 106, paralelo: 109, eur: 110 };
  assert.strictEqual(F.checkAlerts().length, 2);
  assert.strictEqual(fired.length, 2);
  assert.strictEqual(F.alerts.length, 0);
  off();
});

test('alertas: no se disparan con tasas manuales', () => {
  F.alerts = [];
  F.addAlert('bcv', 'above', 1);
  F.setManual({ bcv: 500 });
  assert.strictEqual(F.checkAlerts().length, 0);
  F.clearManual();
});

test('lista de precios con margen e IVA', () => {
  const res = F.priceList([{ name: 'Harina', usd: '1,50' }, { name: 'Refresco', usd: 2 }], 100, 10, 16);
  assert.ok(Math.abs(res.rows[0].finalUsd - 1.5 * 1.1 * 1.16) < 1e-9);
  assert.ok(Math.abs(res.totalBs - (1.5 + 2) * 1.1 * 1.16 * 100) < 1e-6);
});
