/* ==========================================================================
   YARBIS - CONTROLADOR PRINCIPAL
   Une todo: navegación, chat, voz, cámara, alarmas, ajustes y PWA.
   Todos los eventos se enlazan una sola vez aquí (no hay onclick en el HTML),
   lo que evita que los botones se disparen dos veces.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const CHAT_KEY = 'yarbis_chat_log';
  const MAX_LOG = 80;

  const VIEW_HASH = { assistant: '', notes: '#notas', finance: '#finanzas', more: '#mas' };
  const HASH_VIEW = { '': 'assistant', '#notas': 'notes', '#finanzas': 'finance', '#mas': 'more' };
  const SCAN_LABEL = { general: '📷 Foto para analizar', document: '📄 Documento para leer', translate: '🌐 Texto para traducir' };

  const App = {
    view: 'assistant',
    queue: Promise.resolve(),
    log: [],
    torchStream: null,
    installPrompt: null,
    ringing: null,

    init() {
      if (this.started) return;
      this.started = true;

      this.audio = root.audioSynth;
      this.speech = new root.YARBISSpeechEngine();
      root.speechEngine = this.speech;
      this.brain = new root.YARBISBrain();
      root.brain = this.brain;
      this.finance = root.YarbisFinance;
      this.reminders = root.YarbisReminders;

      this.orb = new root.VoiceOrb('orbCanvas');
      this.orbMini = new root.VoiceOrb('orbMini');
      this.applyOrbColor();
      root.YarbisTheme.onChange(() => this.applyOrbColor());

      this.loadChat();
      this.bindNavigation();
      this.bindComposer();
      this.bindVoice();
      this.bindDelegation();
      this.bindDialogs();
      this.bindReminders();
      this.bindFinance();
      this.bindPwa();

      root.YarbisCleaner.mountUI();
      root.YarbisCamera.mount({
        onImage: (dataUrl, mode) => this.analyzeImage(dataUrl, mode),
        onCode: (text) => this.showScannedCode(text)
      });
      root.YarbisSettings.mount({
        brain: this.brain,
        speech: this.speech,
        onProfileChange: () => this.refreshProfile(),
        onAiChange: () => this.updateAiChip()
      });

      this.refreshProfile();
      this.updateAiChip();
      this.showView(HASH_VIEW[root.location.hash] || 'assistant', { replace: true });
    },

    /* ==========================================
       NAVEGACIÓN
       ========================================== */
    bindNavigation() {
      U.$$('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => this.showView(btn.dataset.view));
      });
      root.addEventListener('hashchange', () => {
        const v = HASH_VIEW[root.location.hash];
        if (v && v !== this.view) this.showView(v, { fromHash: true });
      });
    },

    showView(name, opts = {}) {
      if (name === 'settings') { root.YarbisSettings.open(); return; }
      if (name === 'cleaner') { U.$('#dlgCleaner').showModal(); return; }
      if (!VIEW_HASH.hasOwnProperty(name)) name = 'assistant';
      const prev = this.view;
      this.view = name;

      U.$$('.view').forEach(v => v.classList.toggle('active', v.dataset.viewName === name));
      U.$$('[data-view]').forEach(b => {
        const active = b.dataset.view === name;
        b.classList.toggle('active', active);
        if (active) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });

      if (!opts.fromHash) {
        const hash = VIEW_HASH[name];
        const url = hash || root.location.pathname + root.location.search;
        if (opts.replace) root.history.replaceState(null, '', url);
        else if (root.location.hash !== hash) root.history.pushState(null, '', url);
      }

      if (name === 'finance') root.YarbisFinanceView.onShow();
      else if (prev === 'finance') root.YarbisFinanceView.onHide();
      if (name === 'assistant') this.scrollChat();
    },

    /* ==========================================
       CHAT
       ========================================== */
    bindComposer() {
      const form = U.$('#composer');
      const input = U.$('#chatInput');
      const autosize = () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
        const hasText = input.value.trim().length > 0;
        form.classList.toggle('has-text', hasText);
        U.$('#btnSend').hidden = !hasText;
      };
      input.addEventListener('input', autosize);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit'));
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        autosize();
        this.audio.initContext();
        this.speech.primeSpeechSynthesis();
        this.submit(text);
      });
    },

    // Procesa mensajes en orden, uno a la vez
    submit(text, opts = {}) {
      this.queue = this.queue.then(() => this.handle(text, opts)).catch(err => console.error(err));
      return this.queue;
    },

    async handle(text, { fromVoice = false } = {}) {
      if (this.view !== 'assistant') this.showView('assistant');
      this.addMessage({ role: 'user', text });
      const typing = this.showTyping();
      let res;
      try {
        res = await this.brain.process(text);
      } catch (e) {
        console.error(e);
        res = { text: '⚠️ Algo falló procesando eso. Inténtalo de nuevo.', error: true };
      }
      typing.remove();
      this.addMessage({ role: 'assistant', text: res.text, actions: res.actions, error: res.error });

      if (res.sound === 'success') this.audio.playSuccessChime();
      try {
        await this.runEffect(res.effect, res);
      } catch (e) {
        console.warn('Efecto falló:', e);
      }
      this.speakReply(res, fromVoice);
    },

    speakReply(res, fromVoice) {
      const mode = S.getRaw('yarbis_speak_mode', 'voice');
      const should = !res.silent && (mode === 'always' || (mode === 'voice' && (fromVoice || this.speech.continuousMode)));
      if (should) this.speech.speak(res.speak || res.text, { force: true });
      else this.speech.doneProcessing();
    },

    loadChat() {
      const log = S.get(CHAT_KEY, []);
      this.log = Array.isArray(log) ? log.slice(-MAX_LOG) : [];
      const box = U.$('#messages');
      box.replaceChildren(...this.log.map(m => this.renderMessage(m)));
      this.updateWelcome();
      this.scrollChat();
    },

    saveChat() {
      S.set(CHAT_KEY, this.log.slice(-MAX_LOG).map(m => ({ ...m, image: undefined })));
    },

    addMessage(msg) {
      const m = { id: U.uid(), ts: Date.now(), ...msg };
      this.log.push(m);
      if (this.log.length > MAX_LOG) this.log = this.log.slice(-MAX_LOG);
      this.saveChat();
      const node = this.renderMessage(m);
      U.$('#messages').appendChild(node);
      this.updateWelcome();
      this.scrollChat();
      return node;
    },

    clearChat() {
      this.log = [];
      this.saveChat();
      U.$('#messages').replaceChildren();
      this.updateWelcome();
    },

    updateWelcome() {
      U.$('#welcome').hidden = this.log.length > 0;
    },

    scrollChat() {
      const sc = U.$('#chatScroll');
      requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; });
    },

    showTyping() {
      const node = U.el('div', { class: 'msg assistant' },
        U.el('div', { class: 'msg-avatar' }),
        U.el('div', { class: 'msg-content' },
          U.el('div', { class: 'typing', 'aria-label': 'Pensando' }, U.el('span'), U.el('span'), U.el('span'))));
      U.$('#messages').appendChild(node);
      this.scrollChat();
      return node;
    },

    renderMessage(m) {
      const el = U.el;
      const isUser = m.role === 'user';
      const body = el('div', { class: 'msg-body' });
      if (isUser) body.textContent = m.text;
      else body.innerHTML = U.renderMarkdown(m.text);

      const content = el('div', { class: 'msg-content' });
      if (m.image) content.appendChild(el('img', { class: 'msg-image', src: m.image, alt: 'Imagen enviada' }));
      content.appendChild(body);

      if (m.actions && m.actions.length) {
        content.appendChild(el('div', { class: 'msg-actions' }, m.actions.map(a => this.renderAction(a))));
      }

      const meta = el('div', { class: 'msg-meta' }, el('span', { text: U.fmtTime(m.ts || Date.now()) }));
      if (!isUser) {
        meta.appendChild(el('button', {
          type: 'button', class: 'icon-btn', title: 'Copiar', 'aria-label': 'Copiar respuesta',
          onClick: async () => U.toast(await U.copyText(m.text) ? 'Copiado.' : 'No se pudo copiar.')
        }, U.icon('copy')));
        meta.appendChild(el('button', {
          type: 'button', class: 'icon-btn', title: 'Leer en voz alta', 'aria-label': 'Leer en voz alta',
          onClick: () => { this.speech.primeSpeechSynthesis(); this.speech.speak(m.text, { force: true }); }
        }, U.icon('volume')));
      }
      content.appendChild(meta);

      return el('div', { class: `msg ${isUser ? 'user' : 'assistant'}${m.error ? ' error' : ''}` },
        isUser ? null : el('div', { class: 'msg-avatar', 'aria-hidden': 'true' }),
        content);
    },

    renderAction(a) {
      const cls = `btn btn-sm ${a.danger ? 'btn-secondary danger' : 'btn-secondary'}`;
      if (a.url && U.isSafeUrl(a.url)) {
        const external = /^https?:/i.test(a.url);
        return U.el('a', {
          class: cls, href: a.url,
          target: external ? '_blank' : null,
          rel: external ? 'noopener noreferrer' : null
        }, external ? U.icon('external') : null, a.label);
      }
      return U.el('button', {
        type: 'button', class: cls,
        onClick: (e) => {
          if (a.view) this.showView(a.view);
          if (a.command) this.runCommand(a.command, a.value, e.currentTarget);
        }
      }, a.label);
    },

    runCommand(command, value, button) {
      const notes = this.reminders.notes;
      if (command === 'notes-clear-all-confirmed') {
        notes.clearAll();
        if (button) button.disabled = true;
        U.toast('Notas borradas.');
      } else if (command === 'copy') {
        U.copyText(value).then(ok => U.toast(ok ? 'Copiado.' : 'No se pudo copiar.'));
      } else if (command === 'save-contact' && value) {
        this.brain.saveContact(value.name, value.tel);
        if (button) button.disabled = true;
        U.toast('Contacto guardado.', { type: 'ok' });
      } else if (command === 'save-note') {
        notes.add(value);
        if (button) button.disabled = true;
        U.toast('Guardado en tus notas.', { type: 'ok' });
      }
    },

    /* ==========================================
       EFECTOS DE LAS RESPUESTAS
       ========================================== */
    async runEffect(effect) {
      if (!effect) return;
      switch (effect.type) {
        case 'OPEN_URL':
          this.openUrl(effect.url);
          break;
        case 'OPEN_VIEW':
          this.showView(effect.view);
          break;
        case 'OPEN_CAMERA':
          root.YarbisCamera.open(effect.mode);
          break;
        case 'THEME':
          if (effect.mode) root.YarbisTheme.setMode(effect.mode);
          if (effect.accent) root.YarbisTheme.setAccent(effect.accent);
          break;
        case 'CLEAR_CHAT':
          this.clearChat();
          break;
        case 'STOP':
          this.speech.stopAll();
          break;
        case 'HANDS_FREE':
          this.speech.setContinuous(effect.on);
          break;
        case 'TORCH':
          await this.setTorch(effect.on);
          break;
        case 'REMINDER':
          this.reminders.requestNotificationPermission();
          break;
        case 'PROFILE':
          this.refreshProfile();
          break;
        default:
          break;
      }
    },

    openUrl(url) {
      if (!url || !U.isSafeUrl(url)) return;
      if (/^(tel|sms|mailto):/i.test(url)) {
        root.location.href = url;
        return;
      }
      let win = null;
      try { win = root.open(url, '_blank'); } catch (e) { win = null; }
      if (win) {
        try { win.opener = null; } catch (e) { /* ignorar */ }
      } else {
        U.toast('Toca el botón de la respuesta para abrirlo.');
      }
    },

    async setTorch(on) {
      try {
        if (on) {
          if (!this.torchStream) {
            this.torchStream = await root.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          }
          const track = this.torchStream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (!caps.torch) throw new Error('sin linterna');
          await track.applyConstraints({ advanced: [{ torch: true }] });
        } else if (this.torchStream) {
          this.torchStream.getTracks().forEach(t => t.stop());
          this.torchStream = null;
        }
      } catch (e) {
        if (this.torchStream) {
          this.torchStream.getTracks().forEach(t => t.stop());
          this.torchStream = null;
        }
        U.toast('Este navegador no permite controlar la linterna (en iPhone no es posible desde la web).', { type: 'warn', duration: 5000 });
      }
    },

    /* ==========================================
       VOZ
       ========================================== */
    bindVoice() {
      const sp = this.speech;
      const mic = U.$('#btnMic');
      const bar = U.$('#voiceBar');
      const stateEl = U.$('#voiceState');
      const interimEl = U.$('#voiceInterim');
      const handsFree = U.$('#btnHandsFree');

      mic.addEventListener('click', () => {
        this.audio.initContext();
        sp.primeSpeechSynthesis();
        if (this.view !== 'assistant') this.showView('assistant');
        sp.toggleListening();
      });

      handsFree.addEventListener('click', () => {
        this.audio.initContext();
        sp.primeSpeechSynthesis();
        sp.setContinuous(!sp.continuousMode);
        U.toast(sp.continuousMode ? 'Manos libres activado: te escucho después de cada respuesta.' : 'Manos libres desactivado.');
      });

      U.$('#btnVoiceStop').addEventListener('click', () => sp.stopAll());

      sp.onContinuousChange = (on) => {
        handsFree.setAttribute('aria-pressed', on ? 'true' : 'false');
        handsFree.classList.toggle('active', on);
      };

      const labels = { LISTENING: 'Escuchando…', PROCESSING: 'Pensando…', SPEAKING: 'Hablando…' };
      sp.onStateChange = (state) => {
        this.orb.setState(state);
        this.orbMini.setState(state);
        mic.classList.toggle('listening', state === 'LISTENING');
        mic.setAttribute('aria-label', state === 'LISTENING' ? 'Dejar de escuchar' : 'Hablar');
        if (state === 'STANDBY') {
          bar.hidden = true;
          interimEl.textContent = '';
        } else {
          bar.hidden = false;
          stateEl.textContent = labels[state];
          if (state !== 'LISTENING') interimEl.textContent = '';
          else interimEl.textContent = sp.continuousMode ? 'Manos libres activo' : 'Habla ahora';
        }
      };
      sp.onInterimResult = (text) => { interimEl.textContent = text; };
      sp.onAudioLevel = (level) => { this.orb.setAudioLevel(level); this.orbMini.setAudioLevel(level); };
      sp.onSpeechResult = (text) => this.submit(text, { fromVoice: true });
      sp.onError = (msg, { fatal }) => U.toast(msg, { type: fatal ? 'error' : 'warn', duration: fatal ? 6000 : 3500 });

      root.document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
          e.preventDefault();
          mic.click();
        }
      });
    },

    applyOrbColor() {
      const c = root.YarbisTheme.orbColor();
      this.orb.setTheme && this.orb.setTheme(c);
      this.orbMini.setTheme && this.orbMini.setTheme(c);
    },

    /* ==========================================
       CLICS GENERALES (delegación)
       ========================================== */
    bindDelegation() {
      root.document.addEventListener('click', (e) => {
        const ask = e.target.closest('[data-ask]');
        if (ask) {
          this.audio.initContext();
          this.submit(ask.dataset.ask);
          return;
        }
        const timer = e.target.closest('[data-timer]');
        if (timer) {
          this.reminders.schedule.addTimer(Number(timer.dataset.timer));
          this.reminders.requestNotificationPermission();
          U.toast(`Temporizador de ${U.describeDuration(Number(timer.dataset.timer))} iniciado.`, { type: 'ok' });
          return;
        }
        const action = e.target.closest('[data-action]');
        if (!action) return;
        const name = action.dataset.action;
        if (name === 'open-settings') root.YarbisSettings.open();
        else if (name === 'open-camera') root.YarbisCamera.open(action.dataset.mode || 'general');
        else if (name === 'open-cleaner') U.$('#dlgCleaner').showModal();
        else if (name === 'install') this.install();
        else if (name === 'new-chat') {
          this.brain.resetConversation();
          this.clearChat();
          this.speech.stopSpeaking();
          U.toast('Conversación nueva.');
        } else if (name === 'notes-clear-done') {
          this.reminders.notes.clearDone();
        } else if (name === 'notes-clear-all') {
          if (this.reminders.notes.items.length && root.confirm('¿Borrar todas las notas? No se puede deshacer.')) {
            this.reminders.notes.clearAll();
          }
        }
      });
    },

    bindDialogs() {
      U.$$('dialog').forEach(dlg => {
        // Cerrar tocando fuera del contenido
        dlg.addEventListener('click', (e) => {
          if (e.target === dlg && dlg.id !== 'dlgRinging') dlg.close();
        });
        dlg.addEventListener('cancel', (e) => {
          if (dlg.id === 'dlgRinging') { e.preventDefault(); this.stopRinging(); }
        });
      });
      root.document.addEventListener('click', (e) => {
        const closer = e.target.closest('[data-close]');
        if (closer) {
          const dlg = closer.closest('dialog');
          if (dlg) dlg.close();
        }
      });
    },

    /* ==========================================
       NOTAS, TEMPORIZADORES Y ALARMAS
       ========================================== */
    bindReminders() {
      const R = this.reminders;
      // Conectar el aviso ANTES de montar: así suenan las alarmas vencidas con la app cerrada
      R.schedule.onRing = ({ kind, item, late }) => this.ring(kind, item, late);
      R.mountUI();

      const updateBadges = () => {
        const n = R.notes.pending().length;
        [U.$('#navNotesBadge'), U.$('#tabNotesBadge')].forEach(b => {
          if (!b) return;
          b.hidden = n === 0;
          b.textContent = n > 99 ? '99+' : String(n);
        });
      };
      R.notes.onChange(updateBadges);
      updateBadges();

      const chip = U.$('#timerChip');
      const chipText = U.$('#timerChipText');
      chip.addEventListener('click', () => this.showView('notes'));
      const updateChip = () => {
        const running = R.schedule.timers.filter(t => t.pausedRemaining === null);
        if (!running.length) { chip.hidden = true; return; }
        const next = running.reduce((a, b) => (a.endAt < b.endAt ? a : b));
        chip.hidden = false;
        chipText.textContent = U.fmtDuration(R.schedule.remaining(next) / 1000) + (running.length > 1 ? ` (+${running.length - 1})` : '');
      };
      R.schedule.onChange(updateChip);
      updateChip();

      U.$('#btnRingStop').addEventListener('click', () => this.stopRinging());
      U.$('#btnRingSnooze').addEventListener('click', () => {
        const item = this.ringing;
        this.stopRinging();
        if (item) {
          R.schedule.addAlarm(Date.now() + 5 * 60000, item.label);
          U.toast('Te aviso de nuevo en 5 minutos.');
        }
      });
    },

    ring(kind, item, late) {
      const title = kind === 'timer' ? '⏱️ ¡Tiempo!' : '⏰ ¡Alarma!';
      const text = kind === 'timer'
        ? `${item.label}`
        : `${U.fmtTime(item.at)} · ${item.label}${late ? ' (mientras la app estaba cerrada)' : ''}`;
      this.ringing = item;
      U.$('#ringTitle').textContent = title;
      U.$('#ringText').textContent = text;
      const dlg = U.$('#dlgRinging');
      if (!dlg.open) dlg.showModal();
      this.audio.startAlarm();
      this.addMessage({ role: 'assistant', text: `${title} ${text}` });
      if (root.document.hidden) this.reminders.notify(title.replace(/^\S+\s/, ''), text);
      // Se detiene sola al minuto si nadie la apaga
      clearTimeout(this.ringTimeout);
      this.ringTimeout = setTimeout(() => this.stopRinging(), 60000);
    },

    stopRinging() {
      clearTimeout(this.ringTimeout);
      this.audio.stopAlarm();
      const dlg = U.$('#dlgRinging');
      if (dlg.open) dlg.close();
      this.ringing = null;
    },

    /* ==========================================
       FINANZAS (tasa en la barra lateral)
       ========================================== */
    bindFinance() {
      const side = U.$('#sideRate');
      const render = (r) => {
        if (!side) return;
        side.replaceChildren(
          U.el('div', null, 'Dólar BCV ', U.el('strong', { text: U.fmtBs(r.bcv) })),
          U.el('div', { class: 'small muted', text: this.finance.statusLabel(r.fx) }));
      };
      this.finance.onChange(render);
      render(this.finance.getRates());
      // Una sola carga inicial (las actualizaciones periódicas sólo ocurren en la pestaña Finanzas)
      this.finance.ensureFresh(10 * 60 * 1000).catch(() => {});
    },

    /* ==========================================
       CÁMARA
       ========================================== */
    async analyzeImage(dataUrl, mode) {
      this.showView('assistant');
      this.addMessage({ role: 'user', text: SCAN_LABEL[mode] || SCAN_LABEL.general, image: dataUrl });
      const typing = this.showTyping();
      const res = await this.brain.analyzeImage(dataUrl, mode);
      typing.remove();
      this.addMessage({
        role: 'assistant',
        text: res.text,
        error: !res.ok,
        actions: res.ok
          ? [{ label: 'Copiar texto', command: 'copy', value: res.text }, { label: 'Guardar en notas', command: 'save-note', value: res.text }]
          : [{ label: 'Abrir Ajustes', view: 'settings' }]
      });
      if (res.ok) {
        this.brain.remember('user', `[Envié una foto: ${SCAN_LABEL[mode] || 'foto'}]`);
        this.brain.remember('assistant', res.text);
        if (S.getRaw('yarbis_speak_mode', 'voice') === 'always') this.speech.speak(res.text, { force: true });
      }
    },

    showScannedCode(raw) {
      this.showView('assistant');
      const text = String(raw || '').trim();
      this.addMessage({ role: 'user', text: '📱 Código escaneado' });
      const actions = [];
      let reply;
      if (/^https?:\/\//i.test(text)) {
        reply = `🔗 **Enlace detectado:**\n\n${text}\n\n_Verifica que sea un sitio de confianza antes de abrirlo._`;
        actions.push({ label: 'Abrir enlace', url: text });
      } else if (/^WIFI:/i.test(text)) {
        const field = (k) => {
          const m = text.match(new RegExp(`${k}:((?:\\\\.|[^;])*)`, 'i'));
          return m ? m[1].replace(/\\(.)/g, '$1') : '';
        };
        const ssid = field('S');
        const pass = field('P');
        reply = `📶 **Red Wi‑Fi:** ${ssid || '(sin nombre)'}\n- Seguridad: ${field('T') || 'abierta'}\n- Contraseña: ${pass ? `\`${pass}\`` : '(sin contraseña)'}`;
        if (pass) actions.push({ label: 'Copiar contraseña', command: 'copy', value: pass });
      } else if (/^(tel|sms|mailto):/i.test(text)) {
        reply = `📞 **Contacto:** ${text.replace(/^\w+:/, '')}`;
        actions.push({ label: 'Abrir', url: text });
      } else if (/^BEGIN:VCARD/i.test(text)) {
        const list = root.YarbisSettings.parseVcf(text);
        reply = list.length ? `👤 **Contacto:** ${list[0].name} · ${list[0].tel}` : '👤 Tarjeta de contacto';
        if (list.length) actions.push({ label: 'Guardar en agenda', command: 'save-contact', value: list[0] });
      } else {
        reply = `📄 **Contenido del código:**\n\n${text}`;
      }
      actions.push({ label: 'Copiar', command: 'copy', value: text });
      actions.push({ label: 'Guardar en notas', command: 'save-note', value: text });
      this.addMessage({ role: 'assistant', text: reply, actions });
    },

    /* ==========================================
       PERFIL, ESTADO DE IA, PWA
       ========================================== */
    refreshProfile() {
      U.$$('[data-bind="assistantName"]').forEach(n => { n.textContent = this.brain.assistantName; });
      const hour = new Date().getHours();
      const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
      U.$('#welcomeTitle').textContent = `¡${saludo}${this.brain.userName ? `, ${this.brain.userName}` : ''}! ¿En qué te ayudo?`;
      root.document.title = `${this.brain.assistantName} · Asistente personal`;
    },

    updateAiChip() {
      const chip = U.$('#aiChip');
      const text = U.$('#aiChipText');
      const online = root.navigator.onLine !== false;
      chip.classList.toggle('offline', !online);
      text.textContent = !online ? 'Sin conexión' : this.brain.geminiApiKey ? 'Gemini' : 'IA gratuita';
    },

    bindPwa() {
      root.addEventListener('online', () => this.updateAiChip());
      root.addEventListener('offline', () => this.updateAiChip());
      root.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.installPrompt = e;
      });
      root.addEventListener('appinstalled', () => {
        this.installPrompt = null;
        U.toast('¡YARBIS instalado! 🎉', { type: 'ok' });
      });

      const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(root.location.hostname);
      if ('serviceWorker' in root.navigator && (root.location.protocol === 'https:' || isLocal)) {
        root.navigator.serviceWorker.register('sw.js').then(reg => {
          if (!reg) return;
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && root.navigator.serviceWorker.controller) {
                U.toast('Hay una versión nueva de YARBIS.', { actionLabel: 'Actualizar', onAction: () => root.location.reload(), duration: 10000 });
              }
            });
          });
        }).catch(err => console.warn('Service worker:', err));
      }
    },

    async install() {
      if (this.installPrompt) {
        this.installPrompt.prompt();
        try { await this.installPrompt.userChoice; } catch (e) { /* ignorar */ }
        this.installPrompt = null;
        return;
      }
      const isIos = /iphone|ipad|ipod/i.test(root.navigator.userAgent);
      U.$('#installIos').hidden = !isIos && /android/i.test(root.navigator.userAgent);
      U.$('#installAndroid').hidden = isIos;
      U.$('#dlgInstall').showModal();
    }
  };

  root.YarbisApp = App;

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(window);
