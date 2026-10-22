/* ==========================================================================
   YARBIS - TRADUCTOR DE VOZ Y DICTADO
   Traductor: hablas (o escribes) en un idioma, la IA traduce y lo lee en voz
   alta con una voz del idioma de destino.
   Dictado: escucha continua que acumula texto largo con puntuación por voz.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;

  const LANGS = [
    ['es-ES', '🇻🇪 Español'], ['en-US', '🇺🇸 Inglés'], ['pt-BR', '🇧🇷 Portugués'],
    ['fr-FR', '🇫🇷 Francés'], ['it-IT', '🇮🇹 Italiano'], ['de-DE', '🇩🇪 Alemán']
  ];

  // "hola coma qué tal punto" -> "Hola, qué tal."
  function punctuate(text) {
    let t = ` ${String(text || '')} `;
    const rules = [
      [/\s+punto y aparte\s+/gi, '.\n'],
      [/\s+nueva l[ií]nea\s+/gi, '\n'],
      [/\s+nuevo p[aá]rrafo\s+/gi, '\n\n'],
      [/\s+punto y coma\s+/gi, '; '],
      [/\s+dos puntos\s+/gi, ': '],
      [/\s+puntos suspensivos\s+/gi, '... '],
      [/\s+signo de interrogaci[oó]n\s+/gi, '? '],
      [/\s+signo de exclamaci[oó]n\s+/gi, '! '],
      [/\s+abre comillas\s+/gi, ' "'],
      [/\s+cierra comillas\s+/gi, '" '],
      [/\s+coma\s+/gi, ', '],
      [/\s+punto\s+/gi, '. ']
    ];
    rules.forEach(([re, rep]) => {
      for (let i = 0; i < 3; i++) t = t.replace(re, ` ${rep} `.replace(/^ ([.,;:?!"])/, '$1'));
    });
    t = t
      .replace(/[ \t]+/g, ' ')
      .replace(/ +([.,;:?!])/g, '$1')
      .replace(/\n /g, '\n')
      .trim();
    // Mayúscula al inicio y después de punto
    return t.replace(/(^|[.!?]\s+|\n)([a-záéíóúñ])/g, (m, pre, ch) => pre + ch.toUpperCase());
  }

  const VoiceTools = {
    LANGS,
    punctuate,

    mount(app) {
      this.app = app;
      this.speech = app.speech;
      this.brain = app.brain;
      if (!U.$('#dlgTranslate') || this.mounted) return;
      this.mounted = true;
      const $ = U.$;

      // ---------- Traductor ----------
      const from = $('#trFrom');
      const to = $('#trTo');
      LANGS.forEach(([code, label]) => {
        from.appendChild(U.el('option', { value: code }, label));
        to.appendChild(U.el('option', { value: code }, label));
      });
      from.value = S.getRaw('yarbis_tr_from', 'es-ES');
      to.value = S.getRaw('yarbis_tr_to', 'en-US');
      const remember = () => { S.setRaw('yarbis_tr_from', from.value); S.setRaw('yarbis_tr_to', to.value); };
      from.addEventListener('change', remember);
      to.addEventListener('change', remember);
      $('#trSwap').addEventListener('click', () => {
        const f = from.value;
        from.value = to.value;
        to.value = f;
        const a = $('#trInput').value;
        $('#trInput').value = $('#trOutput').value;
        $('#trOutput').value = a;
        remember();
      });
      $('#trMic').addEventListener('click', () => this.listenAndTranslate());
      $('#trGo').addEventListener('click', () => this.translateInput());
      $('#trSpeak').addEventListener('click', () => {
        const out = $('#trOutput').value;
        if (out) this.speech.speak(out, { force: true, lang: to.value });
      });
      $('#trCopy').addEventListener('click', async () => {
        const out = $('#trOutput').value;
        if (out) U.toast(await U.copyText(out) ? 'Traducción copiada.' : 'No se pudo copiar.');
      });

      // ---------- Dictado ----------
      $('#dcToggle').addEventListener('click', () => (this.stopDictation ? this.endDictation() : this.beginDictation()));
      $('#dcCopy').addEventListener('click', async () => {
        const t = $('#dcText').value.trim();
        if (t) U.toast(await U.copyText(t) ? 'Texto copiado.' : 'No se pudo copiar.');
      });
      $('#dcNote').addEventListener('click', () => {
        const t = $('#dcText').value.trim();
        if (!t) return;
        root.YarbisReminders.notes.add(t);
        U.toast('Guardado en tus notas.', { type: 'ok' });
      });
      $('#dcShare').addEventListener('click', async () => {
        const t = $('#dcText').value.trim();
        if (!t) return;
        if (root.navigator.share) {
          try { await root.navigator.share({ text: t }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
        U.toast(await U.copyText(t) ? 'Texto copiado.' : 'No se pudo copiar.');
      });
      $('#dcImprove').addEventListener('click', () => this.improve());
      $('#dcClear').addEventListener('click', () => { $('#dcText').value = ''; this.dictationBase = ''; });
      $('#dlgDictation').addEventListener('close', () => this.endDictation());
    },

    /* ---------- Traductor ---------- */
    openTranslator(text) {
      const dlg = U.$('#dlgTranslate');
      if (!dlg) return;
      if (text) {
        U.$('#trInput').value = text;
        U.$('#trOutput').value = '';
      }
      if (!dlg.open) dlg.showModal();
      if (text) this.translateInput();
    },

    async translateInput() {
      const input = U.$('#trInput').value.trim();
      if (!input) { U.toast('Escribe o di algo para traducir.', { type: 'warn' }); return; }
      const out = U.$('#trOutput');
      const btn = U.$('#trGo');
      btn.disabled = true;
      out.value = 'Traduciendo…';
      try {
        const res = await this.brain.translate(input, U.$('#trTo').value);
        out.value = res || '';
        if (!res) U.toast('No pude traducir ahora. Revisa tu conexión.', { type: 'error' });
        else if (U.$('#trAutoSpeak').checked) this.speech.speak(res, { force: true, lang: U.$('#trTo').value });
      } finally {
        btn.disabled = false;
      }
    },

    async listenAndTranslate() {
      const mic = U.$('#trMic');
      mic.classList.add('listening');
      try {
        if (root.audioSynth) root.audioSynth.playMicChime();
        const text = await this.speech.listenOnce(U.$('#trFrom').value);
        mic.classList.remove('listening');
        if (!text) { U.toast('No escuché nada.', { type: 'warn' }); return; }
        U.$('#trInput').value = text;
        await this.translateInput();
      } catch (e) {
        mic.classList.remove('listening');
        U.toast(e.message || 'No se pudo usar el micrófono.', { type: 'error' });
      }
    },

    /* ---------- Dictado ---------- */
    openDictation() {
      const dlg = U.$('#dlgDictation');
      if (!dlg) return;
      if (!dlg.open) dlg.showModal();
    },

    beginDictation() {
      const area = U.$('#dcText');
      const status = U.$('#dcStatus');
      this.dictationBase = area.value.trim();
      try {
        this.stopDictation = this.speech.startDictation(this.speech.language, (finalText, interim) => {
          const joined = [this.dictationBase, punctuate(finalText)].filter(Boolean).join(this.dictationBase && !/\n$/.test(this.dictationBase) ? ' ' : '');
          area.value = joined;
          status.textContent = interim ? `… ${interim}` : 'Escuchando — di "punto", "coma" o "nueva línea".';
          area.scrollTop = area.scrollHeight;
        });
      } catch (e) {
        U.toast(e.message, { type: 'error' });
        return;
      }
      if (root.audioSynth) root.audioSynth.playMicChime();
      U.$('#dcToggle').classList.add('listening');
      U.$('#dcToggleText').textContent = 'Detener';
      status.textContent = 'Escuchando — di "punto", "coma" o "nueva línea".';
    },

    endDictation() {
      if (this.stopDictation) {
        this.stopDictation();
        this.stopDictation = null;
      }
      const toggle = U.$('#dcToggle');
      if (toggle) toggle.classList.remove('listening');
      if (U.$('#dcToggleText')) U.$('#dcToggleText').textContent = 'Dictar';
      if (U.$('#dcStatus')) U.$('#dcStatus').textContent = '';
    },

    async improve() {
      const area = U.$('#dcText');
      const t = area.value.trim();
      if (!t) return;
      const btn = U.$('#dcImprove');
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'Mejorando…';
      try {
        const out = await this.brain.completeOnce(
          'Corrige ortografía, puntuación y redacción del texto del usuario en español, manteniendo su sentido y su tono. Responde SOLO con el texto corregido.',
          t);
        if (out) {
          area.value = out.trim();
          this.dictationBase = area.value;
          U.toast('Redacción mejorada.', { type: 'ok' });
        } else {
          U.toast('No pude conectar con la IA.', { type: 'error' });
        }
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    }
  };

  root.YarbisVoiceTools = VoiceTools;
})(typeof window !== 'undefined' ? window : globalThis);
