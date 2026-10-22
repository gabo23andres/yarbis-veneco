/* ==========================================================================
   YARBIS - AJUSTES
   Perfil, tema y color, voz, clave de Gemini, agenda de contactos y
   copia de seguridad de los datos (todo vive en este dispositivo).
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const html = root.document.documentElement;

  const Theme = {
    mode() { return S.getRaw('yarbis_theme_mode', 'system'); },
    accent() { return S.getRaw('yarbis_accent', 'neon'); },
    setMode(mode) {
      const m = ['system', 'light', 'dark'].includes(mode) ? mode : 'system';
      S.setRaw('yarbis_theme_mode', m);
      html.setAttribute('data-theme', m);
      this.notify();
    },
    setAccent(accent) {
      S.setRaw('yarbis_accent', accent);
      html.setAttribute('data-accent', accent);
      this.notify();
    },
    isDark() {
      const m = this.mode();
      if (m === 'dark') return true;
      if (m === 'light') return false;
      return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    orbColor() {
      return getComputedStyle(html).getPropertyValue('--orb').trim() || '#0ea5e9';
    },
    listeners: new Set(),
    onChange(fn) { this.listeners.add(fn); },
    notify() {
      const meta = U.$$('meta[name="theme-color"]');
      const color = this.isDark() ? '#0b0f17' : '#f6f7f9';
      meta.forEach(m => m.setAttribute('content', color));
      this.listeners.forEach(fn => fn());
    }
  };

  if (root.matchMedia) {
    const mq = root.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => Theme.notify();
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  /* ---------- VCF ---------- */
  function parseVcf(text) {
    const unfolded = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
    const out = [];
    cards.forEach(card => {
      const lines = card.split(/\r?\n/);
      let name = '';
      let tel = '';
      lines.forEach(line => {
        const idx = line.indexOf(':');
        if (idx < 0) return;
        const key = line.slice(0, idx).toUpperCase();
        const value = line.slice(idx + 1).trim();
        if (key.startsWith('FN') && !name) name = value;
        else if (key === 'N' || key.startsWith('N;')) {
          if (!name) name = value.split(';').filter(Boolean).reverse().join(' ').trim();
        } else if (key.startsWith('TEL') && !tel) tel = value;
      });
      name = name.replace(/\\,/g, ',').trim();
      tel = tel.replace(/[^\d+]/g, '');
      if (name && tel) out.push({ name, tel });
    });
    return out;
  }

  class SettingsController {
    mount({ brain, speech, onProfileChange, onAiChange }) {
      this.brain = brain;
      this.speech = speech;
      this.onProfileChange = onProfileChange || (() => {});
      this.onAiChange = onAiChange || (() => {});
      this.dialog = U.$('#dlgSettings');
      if (!this.dialog) return;
      const $ = U.$;

      // Perfil
      const userName = $('#setUserName');
      const assistantName = $('#setAssistantName');
      const saveNames = () => {
        brain.setNames(assistantName.value, userName.value);
        this.onProfileChange();
      };
      userName.addEventListener('change', saveNames);
      assistantName.addEventListener('change', saveNames);

      // Apariencia
      U.$$('#setThemeMode [data-mode]').forEach(b => b.addEventListener('click', () => {
        Theme.setMode(b.dataset.mode);
        this.syncAppearance();
      }));
      U.$$('#setAccent [data-accent]').forEach(b => b.addEventListener('click', () => {
        Theme.setAccent(b.dataset.accent);
        this.syncAppearance();
      }));

      // Voz
      $('#setLang').addEventListener('change', (e) => {
        speech.setLanguage(e.target.value);
        this.fillVoices();
      });
      $('#setVoice').addEventListener('change', (e) => speech.setVoice(e.target.value));
      $('#setSpeakMode').addEventListener('change', (e) => S.setRaw('yarbis_speak_mode', e.target.value));
      $('#setPitch').addEventListener('input', (e) => { speech.setPitch(e.target.value); $('#outPitch').textContent = Number(e.target.value).toFixed(2); });
      $('#setRate').addEventListener('input', (e) => { speech.setRate(e.target.value); $('#outRate').textContent = Number(e.target.value).toFixed(2); });
      $('#btnTestVoice').addEventListener('click', () => {
        speech.primeSpeechSynthesis();
        speech.speak(`Hola${brain.userName ? ' ' + brain.userName : ''}, así sueno. ¿Te gusta?`, { force: true });
      });
      $('#setSfx').addEventListener('change', (e) => root.audioSynth && root.audioSynth.setMuted(!e.target.checked));
      if (speech.synthesis) {
        speech.synthesis.addEventListener && speech.synthesis.addEventListener('voiceschanged', () => this.fillVoices());
      }

      // IA
      const keyInput = $('#setGeminiKey');
      $('#btnToggleKey').addEventListener('click', () => {
        const show = keyInput.type === 'password';
        keyInput.type = show ? 'text' : 'password';
        $('#btnToggleKey').textContent = show ? 'Ocultar' : 'Mostrar';
      });
      $('#btnSaveKey').addEventListener('click', async () => {
        const status = $('#keyStatus');
        const value = keyInput.value.trim();
        if (!value) { status.textContent = 'Pega tu clave primero.'; return; }
        status.textContent = 'Probando…';
        $('#btnSaveKey').disabled = true;
        const res = await brain.testGeminiApiKey(value);
        $('#btnSaveKey').disabled = false;
        status.textContent = res.message;
        if (res.success) {
          brain.setApiKey(value);
          brain.geminiModel = res.model;
          S.setRaw('yarbis_gemini_model', res.model);
          this.onAiChange();
        }
      });
      $('#btnRemoveKey').addEventListener('click', () => {
        brain.setApiKey('');
        keyInput.value = '';
        $('#keyStatus').textContent = 'Clave eliminada. Se usará la IA gratuita.';
        this.onAiChange();
      });

      // Agenda
      $('#formContact').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#contactName').value.trim();
        const phone = $('#contactPhone').value.trim();
        if (!name || !phone.replace(/\D/g, '')) { U.toast('Escribe nombre y teléfono.', { type: 'warn' }); return; }
        brain.saveContact(name, phone);
        $('#contactName').value = '';
        $('#contactPhone').value = '';
        this.renderContacts();
      });
      $('#btnPickContacts').addEventListener('click', () => this.pickContacts());
      $('#vcfFile').addEventListener('change', (e) => this.importVcf(e.target));

      // Datos
      $('#btnExport').addEventListener('click', () => this.exportData());
      $('#importFile').addEventListener('change', (e) => this.importData(e.target));
      $('#btnWipe').addEventListener('click', () => this.wipe());
    }

    open() {
      const $ = U.$;
      $('#setUserName').value = this.brain.userName;
      $('#setAssistantName').value = this.brain.assistantName;
      $('#setLang').value = this.speech.language;
      $('#setSpeakMode').value = S.getRaw('yarbis_speak_mode', 'voice');
      $('#setPitch').value = this.speech.pitch;
      $('#outPitch').textContent = Number(this.speech.pitch).toFixed(2);
      $('#setRate').value = this.speech.rate;
      $('#outRate').textContent = Number(this.speech.rate).toFixed(2);
      $('#setSfx').checked = !(root.audioSynth && root.audioSynth.muted);
      $('#setGeminiKey').value = this.brain.geminiApiKey;
      $('#keyStatus').textContent = this.brain.geminiApiKey ? `Clave guardada${this.brain.geminiModel ? ` · ${this.brain.geminiModel}` : ''}.` : '';
      this.fillVoices();
      this.syncAppearance();
      this.renderContacts();
      if (!this.dialog.open) this.dialog.showModal();
    }

    syncAppearance() {
      const mode = Theme.mode();
      const accent = Theme.accent();
      U.$$('#setThemeMode [data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      U.$$('#setAccent [data-accent]').forEach(b => {
        b.classList.toggle('active', b.dataset.accent === accent);
        b.setAttribute('aria-pressed', b.dataset.accent === accent ? 'true' : 'false');
      });
    }

    fillVoices() {
      const select = U.$('#setVoice');
      if (!select) return;
      const voices = this.speech.getVoices();
      select.replaceChildren(U.el('option', { value: '' }, 'Automática (la mejor disponible)'));
      voices.forEach(v => select.appendChild(U.el('option', { value: v.name }, `${v.name} (${v.lang})`)));
      select.value = this.speech.voiceName && voices.some(v => v.name === this.speech.voiceName) ? this.speech.voiceName : '';
      select.disabled = !voices.length;
    }

    renderContacts() {
      const list = U.$('#contactsList');
      if (!list) return;
      const contacts = Object.entries(this.brain.getAllContacts()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
      list.replaceChildren();
      if (!contacts.length) {
        list.appendChild(U.el('li', { class: 'empty-state small', text: 'Tu agenda está vacía.' }));
        return;
      }
      contacts.forEach(([name, phone]) => {
        list.appendChild(U.el('li', { class: 'contact-item' },
          U.el('span', { class: 'contact-name', text: U.capitalize(name) }),
          U.el('span', { class: 'contact-phone', text: phone }),
          U.el('button', {
            type: 'button', class: 'icon-btn small danger', title: 'Borrar', 'aria-label': `Borrar ${name}`,
            onClick: () => { this.brain.deleteContact(name); this.renderContacts(); }
          }, U.icon('x'))));
      });
    }

    async pickContacts() {
      if (!('contacts' in root.navigator) || !('select' in root.navigator.contacts)) {
        U.toast('Tu navegador no permite elegir contactos. Exporta tu agenda como .vcf e impórtala.', { type: 'warn', duration: 5000 });
        return;
      }
      try {
        const picked = await root.navigator.contacts.select(['name', 'tel'], { multiple: true });
        let count = 0;
        (picked || []).forEach(c => {
          const name = c.name && c.name[0];
          const tel = c.tel && c.tel[0];
          if (name && tel && this.brain.saveContact(name, tel)) count++;
        });
        this.renderContacts();
        if (count) U.toast(`${count} contacto${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'}.`, { type: 'ok' });
      } catch (e) { /* el usuario canceló */ }
    }

    importVcf(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const list = parseVcf(reader.result);
        list.forEach(c => this.brain.saveContact(c.name, c.tel));
        this.renderContacts();
        U.toast(list.length ? `${list.length} contactos importados.` : 'No encontré contactos con teléfono en ese archivo.', { type: list.length ? 'ok' : 'warn' });
        input.value = '';
      };
      reader.readAsText(file);
    }

    exportData() {
      const data = {};
      S.keys().filter(k => k && k.startsWith('yarbis_') && k !== 'yarbis_gemini_api_key').forEach(k => {
        data[k] = S.getRaw(k);
      });
      const blob = new Blob([JSON.stringify({ app: 'yarbis', version: 11, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = U.el('a', { href: '#', download: `yarbis-respaldo-${new Date().toISOString().slice(0, 10)}.json` });
      a.href = url;
      root.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      U.toast('Copia descargada (sin tu clave de Gemini).', { type: 'ok' });
    }

    importData(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || parsed.app !== 'yarbis' || typeof parsed.data !== 'object') throw new Error('formato');
          if (!root.confirm('Esto reemplazará tus notas, alarmas, contactos y ajustes actuales. ¿Continuar?')) return;
          Object.entries(parsed.data).forEach(([k, v]) => {
            if (k.startsWith('yarbis_') && typeof v === 'string') S.setRaw(k, v);
          });
          U.toast('Copia restaurada. Recargando…', { type: 'ok' });
          setTimeout(() => root.location.reload(), 800);
        } catch (e) {
          U.toast('Ese archivo no es una copia válida de YARBIS.', { type: 'error' });
        } finally {
          input.value = '';
        }
      };
      reader.readAsText(file);
    }

    wipe() {
      if (!root.confirm('¿Borrar TODOS tus datos de YARBIS en este dispositivo (notas, alarmas, contactos, chat y ajustes)?')) return;
      S.keys().filter(k => k && k.startsWith('yarbis_')).forEach(k => S.remove(k));
      U.toast('Datos borrados. Recargando…');
      setTimeout(() => root.location.reload(), 600);
    }
  }

  root.YarbisTheme = Theme;
  root.YarbisSettings = new SettingsController();
  root.YarbisSettings.parseVcf = parseVcf;
})(typeof window !== 'undefined' ? window : globalThis);
