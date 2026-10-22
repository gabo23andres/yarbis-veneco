/* ==========================================================================
   YARBIS - GASTOS Y PRESUPUESTO
   Cada gasto se guarda en su moneda original y también convertido a dólares
   con la tasa BCV del momento, para poder sumar meses mezclados ($ y Bs.).
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const KEY = 'yarbis_expenses';

  const CATEGORIES = [
    { name: 'Comida', emoji: '🍔', color: '#f97316', words: ['comida', 'mercado', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'restaurant', 'pizza', 'arepa', 'arepas', 'empanada', 'supermercado', 'super', 'abasto', 'panaderia', 'pan', 'cafe', 'charcuteria', 'carniceria', 'pollo', 'harina', 'viveres', 'delivery', 'pedidosya', 'hamburguesa', 'perro caliente', 'tequenos'] },
    { name: 'Transporte', emoji: '🚗', color: '#3b82f6', words: ['transporte', 'gasolina', 'taxi', 'uber', 'ridery', 'yummy', 'autobus', 'bus', 'buseta', 'pasaje', 'pasajes', 'metro', 'carro', 'moto', 'estacionamiento', 'peaje', 'mototaxi', 'cauchos', 'mecanico'] },
    { name: 'Servicios', emoji: '💡', color: '#eab308', words: ['servicios', 'luz', 'agua', 'internet', 'cantv', 'telefono', 'saldo', 'recarga', 'gas', 'condominio', 'alquiler', 'renta', 'inter', 'movistar', 'digitel', 'movilnet', 'aseo', 'electricidad', 'corpoelec', 'netuno', 'simple tv', 'directv'] },
    { name: 'Salud', emoji: '💊', color: '#ef4444', words: ['salud', 'farmacia', 'medicina', 'medicinas', 'doctor', 'consulta', 'clinica', 'laboratorio', 'examenes', 'odontologo', 'dentista', 'seguro'] },
    { name: 'Ocio', emoji: '🎉', color: '#a855f7', words: ['ocio', 'cine', 'salida', 'fiesta', 'cerveza', 'cervezas', 'birras', 'netflix', 'spotify', 'juego', 'juegos', 'playa', 'paseo', 'rumba', 'concierto', 'regalo'] },
    { name: 'Hogar', emoji: '🏠', color: '#14b8a6', words: ['hogar', 'casa', 'limpieza', 'detergente', 'muebles', 'ferreteria', 'reparacion'] },
    { name: 'Educación', emoji: '📚', color: '#6366f1', words: ['educacion', 'colegio', 'universidad', 'curso', 'libros', 'utiles', 'mensualidad', 'inscripcion'] },
    { name: 'Otros', emoji: '🧾', color: '#64748b', words: [] }
  ];

  class ExpensesStore {
    constructor() {
      this.items = S.get(KEY, []);
      if (!Array.isArray(this.items)) this.items = [];
      this.listeners = new Set();
    }

    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } }); }
    save() { S.set(KEY, this.items); this.emit(); }

    get budget() { return Number(S.getRaw('yarbis_budget', '0')) || 0; }
    setBudget(v) {
      const n = Number(v) || 0;
      if (n > 0) S.setRaw('yarbis_budget', String(n));
      else S.remove('yarbis_budget');
      this.emit();
    }

    category(name) {
      return CATEGORIES.find(c => U.normalize(c.name) === U.normalize(name)) || CATEGORIES[CATEGORIES.length - 1];
    }

    // Adivina la categoría por palabras clave ("gasolina" -> Transporte)
    guessCategory(text) {
      const n = ` ${U.normalize(text)} `;
      for (const c of CATEGORIES) {
        if (n.includes(` ${U.normalize(c.name)} `)) return c.name;
        if (c.words.some(w => n.includes(` ${w} `))) return c.name;
      }
      return 'Otros';
    }

    bcv() {
      try { return root.YarbisFinance.getRates().bcv; } catch (e) { return 0; }
    }

    add({ amount, currency = 'USD', category, note = '', t = Date.now() }) {
      const a = Number(amount);
      if (!(a > 0)) return null;
      const cur = currency === 'VES' ? 'VES' : 'USD';
      const rate = this.bcv();
      const usd = cur === 'USD' ? a : (rate ? a / rate : 0);
      const before = this.budgetStatus().pct;
      const exp = {
        id: U.uid(), t, amount: a, currency: cur, usd, rate,
        category: this.category(category || this.guessCategory(note)).name,
        note: String(note || '').trim()
      };
      this.items.unshift(exp);
      this.save();
      const after = this.budgetStatus();
      exp.budgetCrossed = before < 100 && after.pct >= 100 ? 100 : before < 80 && after.pct >= 80 ? 80 : 0;
      return exp;
    }

    remove(id) {
      this.items = this.items.filter(x => x.id !== id);
      this.save();
    }

    monthItems(year, month) {
      return this.items.filter(x => {
        const d = new Date(x.t);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    summary(year, month) {
      const now = new Date();
      const y = year === undefined ? now.getFullYear() : year;
      const m = month === undefined ? now.getMonth() : month;
      const items = this.monthItems(y, m);
      const totalUsd = items.reduce((acc, x) => acc + (x.usd || 0), 0);
      const byCat = {};
      items.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + (x.usd || 0); });
      const byCategory = Object.entries(byCat).map(([name, usd]) => ({ name, usd, ...this.category(name) }))
        .sort((a, b) => b.usd - a.usd);
      return { year: y, month: m, items, count: items.length, totalUsd, totalBs: totalUsd * this.bcv(), byCategory };
    }

    budgetStatus(year, month) {
      const b = this.budget;
      const s = this.summary(year, month);
      if (!b) return { budget: 0, pct: 0, spent: s.totalUsd, level: 'none' };
      const pct = (s.totalUsd / b) * 100;
      return { budget: b, pct, spent: s.totalUsd, left: b - s.totalUsd, level: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' };
    }

    toCsv() {
      const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const rows = [['fecha', 'monto', 'moneda', 'usd', 'tasa_bcv', 'categoria', 'detalle']];
      this.items.slice().reverse().forEach(x => rows.push([
        new Date(x.t).toISOString().slice(0, 10), x.amount, x.currency, (x.usd || 0).toFixed(2), x.rate ? x.rate.toFixed(2) : '', x.category, x.note
      ]));
      return rows.map(r => r.map(esc).join(',')).join('\n');
    }
  }

  /* ==========================================
     INTERFAZ (tarjeta en Finanzas)
     ========================================== */
  class ExpensesUI {
    constructor(store) {
      this.store = store;
      const now = new Date();
      this.year = now.getFullYear();
      this.month = now.getMonth();
    }

    mount() {
      const $ = U.$;
      if (!$('#expensesCard') || this.mounted) return;
      this.mounted = true;
      const sel = $('#expCategory');
      CATEGORIES.forEach(c => sel.appendChild(U.el('option', { value: c.name }, `${c.emoji} ${c.name}`)));
      sel.value = 'Comida';

      $('#formExpense').addEventListener('submit', (e) => {
        e.preventDefault();
        const exp = this.store.add({ amount: U.parseNumber($('#expAmount').value), currency: $('#expCurrency').value, category: sel.value, note: $('#expNote').value });
        if (!exp) { U.toast('Escribe un monto válido.', { type: 'warn' }); return; }
        $('#expAmount').value = '';
        $('#expNote').value = '';
        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth();
        U.toast(`Gasto registrado: ${this.store.category(exp.category).emoji} ${exp.currency === 'USD' ? U.fmtUsd(exp.amount) : U.fmtBs(exp.amount)}.`, { type: 'ok' });
        this.warnBudget(exp);
      });

      $('#expNote').addEventListener('input', () => {
        const guess = this.store.guessCategory($('#expNote').value);
        if (guess !== 'Otros') sel.value = guess;
      });

      $('#expPrev').addEventListener('click', () => this.shift(-1));
      $('#expNext').addEventListener('click', () => this.shift(1));
      $('#expCsv').addEventListener('click', () => this.downloadCsv());

      const budget = $('#expBudget');
      if (this.store.budget) budget.value = this.store.budget;
      budget.addEventListener('change', () => this.store.setBudget(budget.value));

      this.store.onChange(() => this.render());
      if (root.YarbisFinance) root.YarbisFinance.onChange(() => this.render());
      this.render();
    }

    warnBudget(exp) {
      if (exp.budgetCrossed === 100) U.toast('⚠️ Te pasaste del presupuesto del mes.', { type: 'error', duration: 5000 });
      else if (exp.budgetCrossed === 80) U.toast('⚠️ Ya usaste el 80 % del presupuesto del mes.', { type: 'warn', duration: 5000 });
    }

    shift(delta) {
      const d = new Date(this.year, this.month + delta, 1);
      this.year = d.getFullYear();
      this.month = d.getMonth();
      this.render();
    }

    downloadCsv() {
      const blob = new Blob(['﻿' + this.store.toCsv()], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = U.el('a', { href: '#', download: `yarbis-gastos-${new Date().toISOString().slice(0, 10)}.csv` });
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    render() {
      if (!this.mounted) return;
      const el = U.el;
      const s = this.store.summary(this.year, this.month);
      const monthName = new Date(this.year, this.month, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
      U.$('#expMonthLabel').textContent = `· ${monthName}`;
      const isCurrent = this.year === new Date().getFullYear() && this.month === new Date().getMonth();
      U.$('#expNext').disabled = isCurrent;

      const b = this.store.budgetStatus(this.year, this.month);
      const summary = U.$('#expSummary');
      summary.replaceChildren(
        el('div', { class: 'exp-total' },
          el('span', { class: 'rate-label', text: 'Total del mes' }),
          el('span', { class: 'rate-value', text: U.fmtUsd(s.totalUsd) }),
          el('span', { class: 'muted small', text: `≈ ${U.fmtBs(s.totalBs)} · ${s.count} gasto${s.count === 1 ? '' : 's'}` })),
        b.budget ? el('div', { class: `exp-budget ${b.level}` },
          el('div', { class: 'result-line' }, el('span', { text: 'Presupuesto' }), el('strong', { text: `${U.fmtNumber(b.pct, 0)} % de ${U.fmtUsd(b.budget)}` })),
          el('div', { class: 'progress' }, el('div', { class: 'progress-fill', style: { width: `${Math.min(100, b.pct)}%` } })),
          el('span', { class: 'muted small', text: b.left >= 0 ? `Te quedan ${U.fmtUsd(b.left)}` : `Te pasaste por ${U.fmtUsd(-b.left)}` })) : null);

      const bars = U.$('#expBars');
      bars.replaceChildren(s.byCategory.length && root.YarbisCharts
        ? root.YarbisCharts.barList(s.byCategory.map(c => ({
          label: `${c.emoji} ${c.name}`, value: c.usd, color: c.color,
          sub: `${U.fmtNumber((c.usd / (s.totalUsd || 1)) * 100, 0)} %`
        })), { format: (v) => U.fmtUsd(v) })
        : el('p', { class: 'empty-state small', text: 'Sin gastos este mes.' }));

      const list = U.$('#expList');
      list.replaceChildren(...s.items.slice(0, 40).map(x => {
        const c = this.store.category(x.category);
        return el('li', { class: 'expense-item' },
          el('span', { class: 'exp-emoji', text: c.emoji }),
          el('div', { class: 'alarm-info' },
            el('span', { class: 'alarm-label', text: x.note || x.category }),
            el('span', { class: 'note-meta', text: `${U.fmtDateTime(x.t)} · ${x.category}` })),
          el('div', { class: 'exp-amount' },
            el('strong', { text: x.currency === 'USD' ? U.fmtUsd(x.amount) : U.fmtBs(x.amount) }),
            x.currency === 'VES' && x.usd ? el('span', { class: 'note-meta', text: `≈ ${U.fmtUsd(x.usd)}` }) : null),
          el('button', {
            type: 'button', class: 'icon-btn small danger', title: 'Borrar', 'aria-label': 'Borrar gasto',
            onClick: () => {
              const copy = { ...x };
              this.store.remove(x.id);
              U.toast('Gasto borrado', { actionLabel: 'Deshacer', onAction: () => { this.store.items.unshift(copy); this.store.items.sort((p, q) => q.t - p.t); this.store.save(); } });
            }
          }, U.icon('x')));
      }));
    }
  }

  const store = new ExpensesStore();
  root.YarbisExpenses = {
    store,
    CATEGORIES,
    ui: null,
    mountUI() {
      if (!this.ui) this.ui = new ExpensesUI(store);
      this.ui.mount();
      return this.ui;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
