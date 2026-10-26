/* ==========================================================================
   YARBIS - PAGO MÓVIL
   Guarda tus datos (banco, cédula, teléfono), los comparte con un toque y
   genera un código QR para cobrar. El QR se dibuja con la librería
   qrcode-generator, cargada sólo cuando hace falta.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const KEY = 'yarbis_pagomovil';
  const QR_LIB = 'js/vendor/qrcode.js'; // qrcode-generator 1.4.4, copia local

  const BANKS = [
    ['0102', 'Banco de Venezuela'], ['0104', 'Venezolano de Crédito'], ['0105', 'Mercantil'],
    ['0108', 'BBVA Provincial'], ['0114', 'Bancaribe'], ['0115', 'Banco Exterior'], ['0128', 'Banco Caroní'],
    ['0134', 'Banesco'], ['0137', 'Sofitasa'], ['0138', 'Banco Plaza'], ['0146', 'Bangente'],
    ['0151', 'BFC Banco Fondo Común'], ['0156', '100% Banco'], ['0157', 'DelSur'], ['0163', 'Banco del Tesoro'],
    ['0166', 'Banco Agrícola'], ['0168', 'Bancrecer'], ['0169', 'R4 / Mi Banco'], ['0171', 'Banco Activo'],
    ['0172', 'Bancamiga'], ['0174', 'Banplus'], ['0175', 'Banco Digital de los Trabajadores'],
    ['0177', 'Banfanb'], ['0191', 'BNC Banco Nacional de Crédito']
  ];

  let qrPromise = null;
  function loadQr() {
    if (root.qrcode) return Promise.resolve(root.qrcode);
    if (!qrPromise) {
      qrPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = QR_LIB;
        s.async = true;
        s.onload = () => (root.qrcode ? resolve(root.qrcode) : reject(new Error('QR no disponible')));
        s.onerror = () => { qrPromise = null; reject(new Error('No se pudo cargar el generador de QR (¿sin internet?)')); };
        document.head.appendChild(s);
      });
    }
    return qrPromise;
  }

  // Dibuja el QR como SVG a partir de la matriz (sin innerHTML)
  function qrSvg(qr, size = 220) {
    const NS = 'http://www.w3.org/2000/svg';
    const count = qr.getModuleCount();
    const margin = 2;
    const total = count + margin * 2;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', 'qr-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Código QR de Pago Móvil');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', total);
    bg.setAttribute('height', total);
    bg.setAttribute('fill', '#fff');
    svg.appendChild(bg);
    let d = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) d += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#0f172a');
    svg.appendChild(path);
    return svg;
  }

  const PagoMovil = {
    BANKS,

    get() {
      const d = S.get(KEY, null);
      return d && d.bank && d.id && d.phone ? d : null;
    },

    clean(data) {
      const clean = {
        bank: String(data.bank || ''),
        idType: ['V', 'E', 'J', 'P', 'G'].includes(data.idType) ? data.idType : 'V',
        id: String(data.id || '').replace(/\D/g, ''),
        phone: String(data.phone || '').replace(/\D/g, ''),
        name: String(data.name || '').trim().slice(0, 40)
      };
      return !clean.bank || !clean.id || clean.phone.length < 10 ? null : clean;
    },

    save(data) {
      const clean = this.clean(data);
      if (clean) S.set(KEY, clean);
      return clean;
    },

    bankName(code) {
      const b = BANKS.find(x => x[0] === code);
      return b ? `${b[0]} - ${b[1]}` : code;
    },

    fmtPhone(p) {
      const d = String(p).replace(/\D/g, '');
      return d.length === 11 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
    },

    // Texto listo para WhatsApp (con *negritas* de WhatsApp)
    message({ amountUsd, amountBs } = {}, d = this.get()) {
      if (!d) return '';
      const lines = [
        '📲 *Pago Móvil*',
        d.name ? `Titular: ${d.name}` : null,
        `Banco: ${this.bankName(d.bank)}`,
        `Cédula: ${d.idType}-${U.fmtNumber(Number(d.id), 0)}`,
        `Teléfono: ${this.fmtPhone(d.phone)}`
      ];
      if (amountBs) {
        lines.push(`Monto: *${U.fmtBs(amountBs)}*${amountUsd ? ` (${U.fmtUsd(amountUsd)} a tasa BCV)` : ''}`);
      }
      return lines.filter(Boolean).join('\n');
    },

    async share(opts = {}) {
      const text = this.message(opts || {});
      if (!text) { this.open(); return; }
      const plain = text.replace(/\*/g, '');
      if (root.navigator.share) {
        try {
          await root.navigator.share({ text: plain });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
      U.toast(await U.copyText(plain) ? 'Datos copiados. Pégalos en el chat.' : 'No se pudo copiar.', { type: 'ok' });
    },

    /* ---------- Interfaz ---------- */
    mount() {
      const dlg = U.$('#dlgPagoMovil');
      if (!dlg || this.mounted) return;
      this.mounted = true;
      const $ = U.$;
      const bank = $('#pmBank');
      BANKS.forEach(([code, name]) => bank.appendChild(U.el('option', { value: code }, `${code} - ${name}`)));

      $('#formPagoMovil').addEventListener('submit', (e) => {
        e.preventDefault();
        const saved = this.save({
          bank: bank.value, idType: $('#pmIdType').value, id: $('#pmId').value,
          phone: $('#pmPhone').value, name: $('#pmName').value
        });
        if (!saved) { U.toast('Revisa: banco, cédula y teléfono de 11 dígitos (0414…).', { type: 'warn' }); return; }
        U.toast('Datos de Pago Móvil guardados.', { type: 'ok' });
        this.renderPreview();
      });
      // La vista previa y los botones siguen lo que se escribe, sin tener que guardar antes
      ['pmBank', 'pmIdType', 'pmId', 'pmPhone', 'pmName', 'pmAmount', 'pmCurrency'].forEach(id => {
        $(`#${id}`).addEventListener('input', () => this.renderPreview());
        $(`#${id}`).addEventListener('change', () => this.renderPreview());
      });
      $('#btnPmShare').addEventListener('click', () => { this.keepDraft(); this.share(this.amounts()); });
      $('#btnPmCopy').addEventListener('click', async () => {
        this.keepDraft();
        const t = this.message(this.amounts()).replace(/\*/g, '');
        if (!t) return;
        U.toast(await U.copyText(t) ? 'Copiado.' : 'No se pudo copiar.', { type: 'ok' });
      });
      $('#btnPmQr').addEventListener('click', () => this.renderQr());
    },

    amounts() {
      const v = U.parseNumber(U.$('#pmAmount').value);
      if (!v) return {};
      const rate = root.YarbisFinance ? root.YarbisFinance.getRates().bcv : 0;
      return U.$('#pmCurrency').value === 'USD' ? { amountUsd: v, amountBs: v * rate } : { amountBs: v, amountUsd: rate ? v / rate : null };
    },

    open(opts) {
      const dlg = U.$('#dlgPagoMovil');
      if (!dlg) return;
      const d = S.get(KEY, null) || {};
      U.$('#pmBank').value = d.bank || '0102';
      U.$('#pmIdType').value = d.idType || 'V';
      U.$('#pmId').value = d.id || '';
      U.$('#pmPhone').value = d.phone || '';
      U.$('#pmName').value = d.name || '';
      if (opts && opts.amountUsd) {
        U.$('#pmAmount').value = opts.amountUsd;
        U.$('#pmCurrency').value = 'USD';
      }
      U.$('#pmQr').replaceChildren();
      this.renderPreview();
      if (!dlg.open) dlg.showModal();
    },

    // Datos del formulario abierto (válidos o null)
    draft() {
      const $ = U.$;
      return this.clean({ bank: $('#pmBank').value, idType: $('#pmIdType').value, id: $('#pmId').value, phone: $('#pmPhone').value, name: $('#pmName').value });
    },

    // Al compartir, copiar o hacer el QR se guardan los datos escritos
    keepDraft() {
      const d = this.draft();
      if (d) S.set(KEY, d);
    },

    renderPreview() {
      const box = U.$('#pmPreview');
      const text = this.message(this.amounts(), this.draft());
      box.textContent = text ? text.replace(/\*/g, '') : 'Escribe banco, cédula y teléfono (11 dígitos, 0414…) para ver la vista previa.';
      ['btnPmShare', 'btnPmCopy', 'btnPmQr'].forEach(id => { U.$(`#${id}`).disabled = !text; });
    },

    async renderQr() {
      this.keepDraft();
      const box = U.$('#pmQr');
      const text = this.message(this.amounts()).replace(/\*/g, '');
      if (!text) return;
      box.replaceChildren(U.el('span', { class: 'muted small', text: 'Generando QR…' }));
      try {
        const qrcode = await loadQr();
        const qr = qrcode(0, 'M');
        qr.addData(unescape(encodeURIComponent(text)));
        qr.make();
        box.replaceChildren(qrSvg(qr), U.el('span', { class: 'muted small', text: 'Muéstralo para que te paguen: al escanearlo se ven tus datos.' }));
      } catch (e) {
        box.replaceChildren(U.el('span', { class: 'muted small', text: e.message }));
      }
    }
  };

  root.YarbisPagoMovil = PagoMovil;
})(typeof window !== 'undefined' ? window : globalThis);
