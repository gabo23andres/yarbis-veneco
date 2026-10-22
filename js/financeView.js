/* ==========================================================================
   YARBIS - PESTAÑA FINANZAS
   Tarjetas de tasas, criptomonedas, convertidor y calculadoras financieras.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const M = root.YarbisMath;
  const S = U.storage;

  class FinanceView {
    constructor(finance) {
      this.finance = finance;
      this.rates = finance.getRates();
      this.mounted = false;
      this.visible = false;
    }

    mount() {
      if (this.mounted || !U.$('#view-finance')) return;
      this.mounted = true;
      const $ = U.$;

      // Convertidor
      const from = $('#convFrom');
      const to = $('#convTo');
      this.finance.CURRENCIES.forEach(c => {
        from.appendChild(U.el('option', { value: c.code }, `${c.flag} ${c.label}`));
        to.appendChild(U.el('option', { value: c.code }, `${c.flag} ${c.label}`));
      });
      const saved = S.get('yarbis_converter', null);
      from.value = (saved && saved.from) || 'USD';
      to.value = (saved && saved.to) || 'VES_BCV';
      if (saved && saved.amount) $('#convAmount').value = saved.amount;

      const convert = () => this.renderConverter();
      $('#convAmount').addEventListener('input', convert);
      from.addEventListener('change', convert);
      to.addEventListener('change', convert);
      $('#convSwap').addEventListener('click', () => {
        const tmp = from.value;
        from.value = to.value;
        to.value = tmp;
        convert();
      });
      U.$$('#convQuick [data-amount]').forEach(b => b.addEventListener('click', () => {
        $('#convAmount').value = b.dataset.amount;
        convert();
      }));
      $('#convCopy').addEventListener('click', async () => {
        const text = `${$('#convResult').textContent} (${$('#convRate').textContent})`;
        U.toast(await U.copyText(text) ? 'Resultado copiado.' : 'No se pudo copiar.');
      });

      // Pestañas de calculadoras
      U.$$('#calcTabs [data-calc]').forEach(btn => btn.addEventListener('click', () => {
        U.$$('#calcTabs [data-calc]').forEach(b => b.classList.toggle('active', b === btn));
        U.$$('.calc-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.calc));
        S.setRaw('yarbis_calc_tab', btn.dataset.calc);
      }));
      const tab = S.getRaw('yarbis_calc_tab', 'basic');
      const tabBtn = U.$(`#calcTabs [data-calc="${tab}"]`);
      if (tabBtn) tabBtn.click();

      $('#calcExpr').addEventListener('input', () => this.renderBasicCalc());

      // DCA
      const dcaRows = S.get('yarbis_dca_rows', null) || [{ amount: 100, price: 60000 }, { amount: 100, price: 50000 }];
      dcaRows.forEach(r => this.addDcaRow(r.amount, r.price));
      $('#dcaAdd').addEventListener('click', () => { this.addDcaRow('', ''); this.renderDca(); });

      ['ciPrincipal', 'ciRate', 'ciYears', 'ciMonthly', 'ciFreq'].forEach(id => $(`#${id}`).addEventListener('input', () => this.renderCompound()));
      ['loanAmount', 'loanRate', 'loanMonths'].forEach(id => $(`#${id}`).addEventListener('input', () => this.renderLoan()));
      ['devAmount', 'devStart', 'devEnd', 'devInterest'].forEach(id => $(`#${id}`).addEventListener('input', () => this.renderDeval()));
      ['spBuy', 'spSell', 'spFee', 'spAmount'].forEach(id => $(`#${id}`).addEventListener('input', () => this.renderSpread()));

      // Botones de cabecera
      $('#btnFxRefresh').addEventListener('click', () => this.refresh(true));
      $('#btnFxManual').addEventListener('click', () => this.openManual());
      $('#btnFxLive').addEventListener('click', () => { this.finance.clearManual(); U.toast('Usando tasas en vivo.'); });

      // Diálogo de tasas manuales
      $('#formRates').addEventListener('submit', (e) => {
        e.preventDefault();
        this.finance.setManual({
          bcv: $('#mrBcv').value, paralelo: $('#mrPar').value, eur: $('#mrEur').value,
          BTC: $('#mrBtc').value, ETH: $('#mrEth').value, SOL: $('#mrSol').value
        });
        $('#dlgRates').close();
        U.toast(this.finance.manual ? 'Tasas manuales guardadas.' : 'Usando tasas en vivo.', { type: 'ok' });
      });
      $('#btnRatesClear').addEventListener('click', () => {
        this.finance.clearManual();
        $('#dlgRates').close();
        U.toast('Usando tasas en vivo.');
      });

      $('#formFinanceAsk').addEventListener('submit', (e) => {
        e.preventDefault();
        const q = $('#financeAsk').value.trim();
        if (!q || !root.YarbisApp) return;
        $('#financeAsk').value = '';
        root.YarbisApp.showView('assistant');
        root.YarbisApp.submit(q);
      });

      this.finance.onChange((rates) => {
        this.rates = rates;
        this.renderAll();
      });
      this.rates = this.finance.getRates();
      this.renderAll();
      this.renderBasicCalc();
    }

    async refresh(manual = false) {
      const btn = U.$('#btnFxRefresh');
      if (btn) btn.disabled = true;
      U.$('#fxStatus').textContent = 'Actualizando…';
      try {
        const r = await this.finance.refresh();
        if (manual) {
          U.toast(r.fx.status === 'live' ? 'Tasas actualizadas.' : 'Sin conexión: mostrando los últimos datos guardados.', { type: r.fx.status === 'live' ? 'ok' : 'warn' });
        }
      } finally {
        if (btn) btn.disabled = false;
        this.renderStatus();
      }
    }

    onShow() {
      this.visible = true;
      this.mount();
      this.finance.ensureFresh(60 * 1000).then((rates) => {
        this.rates = rates;
        this.renderAll();
      });
      this.finance.startAutoRefresh(60000);
    }

    onHide() {
      this.visible = false;
      this.finance.stopAutoRefresh();
    }

    openManual() {
      const r = this.rates;
      const m = this.finance.manual || {};
      const set = (id, v) => { U.$(id).value = v ? Math.round(v * 100) / 100 : ''; };
      set('#mrBcv', m.bcv || r.bcv);
      set('#mrPar', m.paralelo || r.paralelo);
      set('#mrEur', m.eur || r.eur);
      set('#mrBtc', m.BTC || r.crypto.BTC.price);
      set('#mrEth', m.ETH || r.crypto.ETH.price);
      set('#mrSol', m.SOL || r.crypto.SOL.price);
      U.$('#dlgRates').showModal();
    }

    /* ---------- Render ---------- */
    renderAll() {
      if (!this.mounted) return;
      this.renderStatus();
      this.renderCards();
      this.renderConverter();
      this.renderDca();
      this.renderCompound();
      this.renderLoan();
      this.renderDeval();
      this.renderSpread();
    }

    renderStatus() {
      const r = this.rates;
      const status = U.$('#fxStatus');
      if (status) status.textContent = `${this.finance.statusLabel(r.fx)}${r.fx.source && r.fx.status !== 'default' && r.fx.status !== 'manual' ? ` · ${r.fx.source}` : ''}`;
      const banner = U.$('#manualBanner');
      if (banner) banner.hidden = !r.manual;
    }

    renderCards() {
      const r = this.rates;
      const el = U.el;
      const statusDot = (meta) => el('span', { class: `status-dot ${meta.status}` });
      const card = (label, value, foot, primary) => el('div', { class: `rate-card${primary ? ' primary' : ''}` },
        el('span', { class: 'rate-label', text: label }),
        el('span', { class: 'rate-value', text: value }),
        el('span', { class: 'rate-foot' }, statusDot(r.fx), foot));

      const cards = U.$('#rateCards');
      cards.replaceChildren(
        card('💵 Dólar BCV', U.fmtBs(r.bcv), 'Oficial', true),
        card('📈 Dólar paralelo', U.fmtBs(r.paralelo), `Brecha ${U.fmtNumber(r.spread, 1)} %`),
        card('💶 Euro BCV', U.fmtBs(r.eur), 'Oficial'),
        card('🪙 USDT ≈', U.fmtBs(r.paralelo), 'Referencia P2P')
      );

      const crypto = U.$('#cryptoCards');
      crypto.replaceChildren(...this.finance.CRYPTO_CODES.map(code => {
        const c = r.crypto[code];
        if (!c) return null;
        const up = c.change >= 0;
        return el('div', { class: 'crypto-card' },
          el('span', { class: 'crypto-sym', text: code }),
          el('span', { class: 'crypto-price', text: U.fmtUsd(c.price) }),
          el('span', { class: `crypto-change ${up ? 'up' : 'down'}`, text: r.cryptoMeta.status === 'default' ? 'estimado' : `${up ? '▲' : '▼'} ${U.fmtNumber(Math.abs(c.change), 2)} %` }));
      }).filter(Boolean));
    }

    renderConverter() {
      const $ = U.$;
      const amountRaw = $('#convAmount').value;
      const amount = parseLocaleNumber(amountRaw);
      const from = $('#convFrom').value;
      const to = $('#convTo').value;
      S.set('yarbis_converter', { from, to, amount: amountRaw });
      if (amount === null) {
        $('#convResult').textContent = '—';
        $('#convRate').textContent = 'Escribe un monto válido';
        return;
      }
      const result = this.finance.convert(amount, from, to, this.rates);
      $('#convResult').textContent = this.finance.format(result, to);
      const unit = this.finance.convert(1, from, to, this.rates);
      const unitText = unit !== null && unit < 0.01 ? `${this.finance.format(1, to)} = ${this.finance.format(this.finance.convert(1, to, from, this.rates), from)}` : `1 ${label(from)} = ${this.finance.format(unit, to)}`;
      $('#convRate').textContent = unitText;
    }

    renderBasicCalc() {
      const input = U.$('#calcExpr');
      const out = U.$('#calcResult');
      const val = input.value.trim();
      if (!val) { out.textContent = '0'; return; }
      const res = M.evaluate(val) || M.evaluateNatural(val);
      out.textContent = res ? `= ${res.formatted}` : '…';
    }

    addDcaRow(amount, price) {
      const el = U.el;
      const row = el('div', { class: 'dca-row' },
        el('label', { class: 'field' }, el('span', { text: 'Invertido ($)' }), el('input', { type: 'number', inputmode: 'decimal', class: 'dca-amount', value: amount })),
        el('label', { class: 'field' }, el('span', { text: 'Precio de compra ($)' }), el('input', { type: 'number', inputmode: 'decimal', class: 'dca-price', value: price })),
        el('button', {
          type: 'button', class: 'icon-btn small danger', title: 'Quitar', 'aria-label': 'Quitar compra',
          onClick: () => { row.remove(); this.renderDca(); }
        }, U.icon('x')));
      row.addEventListener('input', () => this.renderDca());
      U.$('#dcaRows').appendChild(row);
    }

    renderDca() {
      const rows = U.$$('#dcaRows .dca-row').map(r => ({
        amount: r.querySelector('.dca-amount').value,
        price: r.querySelector('.dca-price').value
      }));
      S.set('yarbis_dca_rows', rows);
      const res = M.Finance.dca(rows);
      const box = U.$('#dcaResult');
      if (!res) { box.replaceChildren(); return; }
      box.replaceChildren(
        line('Precio promedio', U.fmtUsd(res.avgPrice), true),
        line('Total invertido', U.fmtUsd(res.invested)),
        line('Unidades', U.fmtCrypto(res.units)));
    }

    renderCompound() {
      const v = (id) => U.$(`#${id}`).value;
      const res = M.Finance.compound(v('ciPrincipal'), v('ciRate'), v('ciYears'), v('ciFreq'), v('ciMonthly'));
      U.$('#ciResult').replaceChildren(
        line('Monto final', U.fmtUsd(res.finalAmount), true),
        line('Total aportado', U.fmtUsd(res.invested)),
        line('Intereses ganados', U.fmtUsd(res.interest)),
        line('Rendimiento anual efectivo', `${U.fmtNumber(res.apy, 2)} %`));
    }

    renderLoan() {
      const v = (id) => U.$(`#${id}`).value;
      const res = M.Finance.loan(v('loanAmount'), v('loanRate'), v('loanMonths'));
      const box = U.$('#loanResult');
      if (!res) { box.replaceChildren(); return; }
      box.replaceChildren(
        line('Cuota mensual', U.fmtNumber(res.payment, 2), true),
        line('Total a pagar', U.fmtNumber(res.total, 2)),
        line('Intereses', U.fmtNumber(res.interest, 2)));
    }

    renderDeval() {
      const start = U.$('#devStart');
      const end = U.$('#devEnd');
      if (!start.value && this.rates.bcv) start.placeholder = U.fmtNumber(this.rates.bcv, 2);
      if (!end.value && this.rates.paralelo) end.placeholder = U.fmtNumber(this.rates.paralelo, 2);
      const a = start.value || this.rates.bcv;
      const b = end.value || this.rates.paralelo;
      const res = M.Finance.devaluation(U.$('#devAmount').value, a, b, U.$('#devInterest').value);
      const box = U.$('#devResult');
      if (!res) { box.replaceChildren(); return; }
      box.replaceChildren(
        line('Devaluación del bolívar', `${U.fmtNumber(res.devaluationPct, 2)} %`, true),
        line('Valor al inicio', U.fmtUsd(res.usdStart)),
        line('Valor al final', U.fmtUsd(res.usdEnd)),
        line(res.lossUsd >= 0 ? 'Pérdida en dólares' : 'Ganancia en dólares', `${U.fmtUsd(Math.abs(res.lossUsd))} (${U.fmtNumber(res.realChangePct, 2)} %)`));
    }

    renderSpread() {
      const buy = U.$('#spBuy');
      const sell = U.$('#spSell');
      if (!buy.value) buy.placeholder = U.fmtNumber(this.rates.bcv, 2);
      if (!sell.value) sell.placeholder = U.fmtNumber(this.rates.paralelo, 2);
      const b = buy.value || this.rates.bcv;
      const s = sell.value || this.rates.paralelo;
      const res = M.Finance.spread(b, s, U.$('#spFee').value);
      const box = U.$('#spResult');
      if (!res) { box.replaceChildren(); return; }
      const amount = Number(U.$('#spAmount').value) || 0;
      box.replaceChildren(
        line('Ganancia neta', `${U.fmtNumber(res.net, 2)} %`, true),
        line('Spread bruto', `${U.fmtNumber(res.gross, 2)} %`),
        line(`Sobre ${U.fmtNumber(amount, 2)}`, U.fmtNumber(amount * res.net / 100, 2)),
        line('¿Conviene?', res.profitable ? 'Sí ✅' : 'No ❌'));
    }
  }

  function line(labelText, value, big) {
    return U.el('div', { class: `result-line${big ? ' big' : ''}` }, U.el('span', { text: labelText }), U.el('strong', { text: value }));
  }

  function label(code) {
    return ({ VES_BCV: 'Bs. (BCV)', VES_PAR: 'Bs. (paralelo)' })[code] || code;
  }

  // "1.234,56" / "1,234.56" / "1234,5" -> número
  function parseLocaleNumber(raw) {
    let s = String(raw || '').trim().replace(/\s|\$|€|bs\.?/gi, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(s)) {
      const expr = M.evaluate(String(raw));
      return expr ? expr.value : null;
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  root.YarbisFinanceView = new FinanceView(root.YarbisFinance);
})(typeof window !== 'undefined' ? window : globalThis);
