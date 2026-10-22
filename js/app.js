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
      this.bindGestures();
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
      if (root.YarbisHome) root.YarbisHome.mount(this);
      if (root.YarbisPagoMovil) root.YarbisPagoMovil.mount();
      if (root.YarbisVoiceTools) root.YarbisVoiceTools.mount(this);
      this.handleLaunchParams();
      this.adaptToPhone();
    },

    // Accesos rápidos de "Más": en Android abren la app instalada
    adaptToPhone() {
      const plat = root.YarbisApps ? root.YarbisApps.platform() : 'desktop';
      root.document.documentElement.dataset.platform = plat;
      U.$$('.app-tile').forEach(a => {
        const web = a.getAttribute('href');
        const appHref = root.YarbisApps.href(web, plat);
        if (appHref !== web) {
          a.setAttribute('href', appHref);
          a.removeAttribute('target');
        }
        a.addEventListener('click', () => this.haptic());
      });
      const standalone = root.matchMedia && root.matchMedia('(display-mode: standalone)').matches || root.navigator.standalone;
      if (standalone) U.$$('[data-action="install"]').forEach(b => { b.hidden = true; });
    },

    // Foto compartida desde otra app: el service worker la guardó en la caché
    async receiveSharedMedia(caption) {
      try {
        const cache = await root.caches.open('yarbis-share');
        const res = await cache.match('shared-media');
        if (!res) return;
        const blob = await res.blob();
        await cache.delete('shared-media');
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        this.sharedImage = await root.YarbisCamera.shrinkDataUrl(dataUrl);
        this.showView('assistant');
        this.addMessage({ role: 'user', text: `📥 Imagen compartida${caption ? `: ${caption}` : ''}`, image: this.sharedImage });
        this.addMessage({
          role: 'assistant',
          text: '¿Qué hago con esta imagen?',
          actions: [
            { label: '🔍 Describir', command: 'analyze-shared', value: 'general' },
            { label: '📄 Leer texto', command: 'analyze-shared', value: 'document' },
            { label: '🌐 Traducir', command: 'analyze-shared', value: 'translate' },
            { label: '📱 Leer QR', command: 'qr-shared' }
          ]
        });
      } catch (e) {
        console.warn('Imagen compartida:', e);
      }
    },

    // Abre YARBIS desde "Compartir" de otra app o desde un atajo del ícono
    handleLaunchParams() {
      const params = new URLSearchParams(root.location.search);
      const shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join('\n').trim();
      const accion = params.get('accion');
      if (params.get('media')) {
        root.history.replaceState(null, '', root.location.pathname + root.location.hash);
        this.receiveSharedMedia(shared);
        return;
      }
      if (!shared && !accion) return;
      root.history.replaceState(null, '', root.location.pathname + root.location.hash);
      if (shared) {
        this.showView('assistant');
        this.addMessage({ role: 'user', text: `📥 Compartido:\n${shared}` });
        this.addMessage({
          role: 'assistant',
          text: '¿Qué hago con esto?',
          actions: [
            { label: '📝 Guardar como nota', command: 'save-note', value: shared },
            { label: '🤖 Preguntarle a la IA', command: 'ask', value: `Explícame o resume esto: ${shared}` },
            { label: '🌐 Traducir', command: 'translate-text', value: shared },
            { label: '🧹 Limpiar texto', command: 'clean-text', value: shared }
          ]
        });
        return;
      }
      const go = {
        dolar: () => this.submit('¿A cómo está el dólar?'),
        nota: () => { this.showView('notes'); setTimeout(() => U.$('#inputNewNote') && U.$('#inputNewNote').focus(), 100); },
        compras: () => this.runCommand('open-list', 'Compras'),
        qr: () => root.YarbisCamera.open('qr'),
        gasto: () => this.openTool('expense'),
        dictado: () => this.openTool('dictation'),
        traductor: () => this.openTool('translate'),
        pagomovil: () => this.openTool('pagomovil')
      };
      if (go[accion]) go[accion]();
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

    async handle(text, { fromVoice = false, skipUser = false } = {}) {
      if (this.view !== 'assistant') this.showView('assistant');
      if (!skipUser) this.addMessage({ role: 'user', text });
      const typing = this.showTyping();

      // Respuesta en tiempo real: el mensaje se va escribiendo mientras llega
      let live = null;
      let latest = '';
      let renderTimer = null;
      const flush = () => {
        renderTimer = null;
        if (live) {
          live.body.innerHTML = U.renderMarkdown(latest);
          this.scrollChat();
        }
      };
      const onChunk = (full) => {
        latest = full;
        if (!live) {
          typing.remove();
          live = this.addLiveMessage();
        }
        if (!renderTimer) renderTimer = setTimeout(flush, 80);
      };

      let res;
      try {
        res = await this.brain.process(text, { onChunk });
      } catch (e) {
        console.error(e);
        res = { text: '⚠️ Algo falló procesando eso. Inténtalo de nuevo.', error: true };
      }
      clearTimeout(renderTimer);
      typing.remove();
      const msg = { role: 'assistant', text: res.text, actions: res.actions, error: res.error, ai: !!res.ai, prompt: text };
      if (live) this.finishLiveMessage(live, msg);
      else this.addMessage(msg);

      if (res.sound === 'success') this.audio.playSuccessChime();
      const effects = res.effects || (res.effect ? [res.effect] : []);
      for (const eff of effects) {
        try {
          await this.runEffect(eff, res);
        } catch (e) {
          console.warn('Efecto falló:', e);
        }
      }
      this.speakReply(res, fromVoice);
    },

    addLiveMessage() {
      const body = U.el('div', { class: 'msg-body' });
      const node = U.el('div', { class: 'msg assistant streaming' },
        U.el('div', { class: 'msg-avatar', 'aria-hidden': 'true' }),
        U.el('div', { class: 'msg-content' }, body));
      U.$('#messages').appendChild(node);
      this.updateWelcome(true);
      this.scrollChat();
      return { node, body };
    },

    finishLiveMessage(live, msg) {
      const m = { id: U.uid(), ts: Date.now(), ...msg };
      this.log.push(m);
      if (this.log.length > MAX_LOG) this.log = this.log.slice(-MAX_LOG);
      this.saveChat();
      live.node.replaceWith(this.renderMessage(m));
      this.scrollChat();
    },

    // Vuelve a pedir la última respuesta de la IA
    regenerate(m) {
      const last = this.log[this.log.length - 1];
      if (!m.prompt) return;
      if (last && last.id === m.id) {
        this.log.pop();
        this.saveChat();
        const node = U.$(`#messages [data-id="${m.id}"]`);
        if (node) node.remove();
        this.brain.popLastExchange();
        this.queue = this.queue.then(() => this.handle(m.prompt, { skipUser: true })).catch(err => console.error(err));
      } else {
        this.submit(m.prompt);
      }
    },

    speakReply(res, fromVoice) {
      const mode = S.getRaw('yarbis_speak_mode', 'voice');
      const should = !res.silent && (mode === 'always' || (mode === 'voice' && (fromVoice || this.speech.continuousMode)));
      if (should) this.speech.speak(res.speak || res.text, { force: true, lang: res.speakLang });
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

    updateWelcome(force) {
      U.$('#welcome').hidden = force === true || this.log.length > 0;
      if (U.$('#welcome').hidden === false && root.YarbisHome) root.YarbisHome.render();
    },

    scrollChat() {
      const sc = U.$('#chatScroll');
      const empty = !U.$('#welcome').hidden;
      requestAnimationFrame(() => { sc.scrollTop = empty ? 0 : sc.scrollHeight; });
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
        if (root.navigator.share) {
          meta.appendChild(el('button', {
            type: 'button', class: 'icon-btn', title: 'Compartir', 'aria-label': 'Compartir respuesta',
            onClick: () => this.shareText(m.text)
          }, U.icon('share')));
        }
        if ((m.ai || m.error) && m.prompt) {
          meta.appendChild(el('button', {
            type: 'button', class: 'icon-btn', title: 'Regenerar respuesta', 'aria-label': 'Regenerar respuesta',
            onClick: () => this.regenerate(m)
          }, U.icon('refresh')));
        }
      }
      content.appendChild(meta);

      return el('div', { class: `msg ${isUser ? 'user' : 'assistant'}${m.error ? ' error' : ''}`, dataset: { id: m.id } },
        isUser ? null : el('div', { class: 'msg-avatar', 'aria-hidden': 'true' }),
        content);
    },

    renderAction(a) {
      const cls = `btn btn-sm ${a.danger ? 'btn-secondary danger' : 'btn-secondary'}`;
      if (a.url && U.isSafeUrl(a.url)) {
        const external = /^https?:/i.test(a.url);
        const appHref = root.YarbisApps ? root.YarbisApps.href(a.url) : a.url;
        const isIntent = appHref.startsWith('intent:');
        const link = U.el('a', {
          class: cls,
          target: external && !isIntent ? '_blank' : null,
          rel: external ? 'noopener noreferrer' : null
        }, external ? U.icon('external') : null, a.label);
        // intent:// no pasa el filtro de URLs seguras de el(); se asigna aquí porque lo generamos nosotros
        link.setAttribute('href', isIntent ? appHref : a.url);
        link.addEventListener('click', () => this.haptic());
        return link;
      }
      return U.el('button', {
        type: 'button', class: cls,
        onClick: (e) => {
          if (a.view) this.showView(a.view);
          if (a.command) this.runCommand(a.command, a.value, e.currentTarget);
        }
      }, a.label);
    },

    // Evento de calendario (.ics): en iPhone abre "Agregar evento"; en Android, el calendario
    downloadIcs({ title, start, end, allDay }) {
      const pad = (x) => String(x).padStart(2, '0');
      const utc = (t) => {
        const d = new Date(t);
        return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
      };
      const day = (t) => {
        const d = new Date(t);
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      };
      const esc = (x) => String(x).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YARBIS//ES', 'BEGIN:VEVENT',
        `UID:${U.uid()}@yarbis`, `DTSTAMP:${utc(Date.now())}`,
        allDay ? `DTSTART;VALUE=DATE:${day(start)}` : `DTSTART:${utc(start)}`,
        allDay ? `DTEND;VALUE=DATE:${day(end)}` : `DTEND:${utc(end)}`,
        `SUMMARY:${esc(title)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
      ];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = U.el('a', { href: '#', download: `${title.replace(/[^\w\sáéíóúñ-]/gi, '').slice(0, 40) || 'evento'}.ics` });
      a.href = url;
      root.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },

    async shareText(text) {
      const plain = text.replace(/\*\*/g, '').replace(/^_|_$/gm, '');
      if (root.navigator.share) {
        try {
          await root.navigator.share({ text: plain });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
      U.toast(await U.copyText(plain) ? 'Copiado para compartir.' : 'No se pudo copiar.');
    },

    openTool(tool, value) {
      if (tool === 'pagomovil' && root.YarbisPagoMovil) root.YarbisPagoMovil.open(value);
      else if (tool === 'translate' && root.YarbisVoiceTools) root.YarbisVoiceTools.openTranslator(value);
      else if (tool === 'dictation' && root.YarbisVoiceTools) root.YarbisVoiceTools.openDictation();
      else if (tool === 'expense') {
        this.showView('finance');
        setTimeout(() => {
          const card = U.$('#expensesCard');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const input = U.$('#expAmount');
          if (input) input.focus();
        }, 150);
      }
    },

    runCommand(command, value, button) {
      const notes = this.reminders.notes;
      if (command === 'notes-clear-all-confirmed') {
        notes.clearAll();
        if (button) button.disabled = true;
        U.toast('Notas borradas.');
      } else if (command === 'copy') {
        U.copyText(value).then(ok => U.toast(ok ? 'Copiado.' : 'No se pudo copiar.'));
      } else if (command === 'ics' && value) {
        this.downloadIcs(value);
      } else if (command === 'alarm-at' && value) {
        this.reminders.schedule.addAlarm(value.at, value.label);
        this.reminders.requestNotificationPermission();
        if (button) button.disabled = true;
        U.toast(`Te aviso a las ${U.fmtTime(value.at)}.`, { type: 'ok' });
      } else if (command === 'analyze-shared' && this.sharedImage) {
        this.analyzeImage(this.sharedImage, value || 'general');
      } else if (command === 'qr-shared' && this.sharedImage) {
        root.YarbisCamera.decodeDataUrl(this.sharedImage)
          .then(t => (t ? this.showScannedCode(t) : U.toast('No encontré un código QR en la imagen.', { type: 'warn' })))
          .catch(e => U.toast(e.message, { type: 'error' }));
      } else if (command === 'open-tool') {
        this.openTool(value);
      } else if (command === 'pm-share') {
        root.YarbisPagoMovil && root.YarbisPagoMovil.share(value);
      } else if (command === 'clean-text') {
        U.$('#txtCleanInput').value = value;
        U.$('#txtCleanInput').dispatchEvent(new Event('input'));
        U.$('#dlgCleaner').showModal();
      } else if (command === 'ask') {
        this.submit(value);
      } else if (command === 'translate-text') {
        this.openTool('translate', value);
      } else if (command === 'list-clear-confirmed') {
        const n = notes.clearList(value);
        if (button) button.disabled = true;
        U.toast(`Lista vaciada (${n}).`);
      } else if (command === 'open-list') {
        this.showView('notes');
        if (this.reminders.ui) this.reminders.ui.setList(notes.resolveList(value));
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
        case 'OPEN_TOOL':
          this.openTool(effect.tool, effect.value);
          break;
        default:
          break;
      }
    },

    openUrl(url) {
      if (!url || !U.isSafeUrl(url)) return;
      const opened = root.YarbisApps ? root.YarbisApps.open(url) : !!root.open(url, '_blank');
      if (!opened) U.toast('Toca el botón de la respuesta para abrirlo.');
    },

    // Vibración corta al tocar (sólo Android; respeta el silencio de efectos)
    haptic(ms = 8) {
      if (this.audio && this.audio.muted) return;
      if (this.audio && this.audio.canVibrate && this.audio.canVibrate()) {
        try { root.navigator.vibrate(ms); } catch (e) { /* ignorar */ }
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
      const wave = U.$('#voiceWave');
      sp.onAudioLevel = (level) => {
        this.orb.setAudioLevel(level);
        this.orbMini.setAudioLevel(level);
        if (wave) wave.style.setProperty('--lvl', String(level));
      };
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
      const c2 = root.YarbisTheme.secondColor();
      this.orb.setTheme && this.orb.setTheme(c, c2);
      this.orbMini.setTheme && this.orbMini.setTheme(c, c2);
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
        else if (name === 'open-tool') this.openTool(action.dataset.tool);
        else if (name === 'install') this.install();
        else if (name === 'new-chat') {
          this.brain.resetConversation();
          this.clearChat();
          this.speech.stopSpeaking();
          U.toast('Conversación nueva.');
        } else if (name === 'notes-clear-done') {
          const ui = this.reminders.ui;
          this.reminders.notes.clearDone(ui && ui.list !== 'all' ? ui.list : null);
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

      // Botón "atrás" del teléfono: cierra la ventana abierta en vez de salir de la app
      this.ignorePop = false;
      const observer = new MutationObserver((records) => {
        records.forEach(r => {
          const dlg = r.target;
          if (dlg.open && !(root.history.state && root.history.state.dlg === dlg.id)) {
            root.history.pushState({ dlg: dlg.id }, '', root.location.href);
          }
        });
      });
      U.$$('dialog').forEach(dlg => {
        observer.observe(dlg, { attributes: true, attributeFilter: ['open'] });
        dlg.addEventListener('close', () => {
          if (root.history.state && root.history.state.dlg === dlg.id) {
            this.ignorePop = true;
            root.history.back();
          }
        });
      });
      root.addEventListener('popstate', () => {
        // Una entrada de una ventana que ya está cerrada no debe quedar en el historial
        const st = root.history.state;
        if (st && st.dlg && !(U.$(`#${st.dlg}`) || {}).open) root.history.replaceState(null, '', root.location.href);
        if (this.ignorePop) { this.ignorePop = false; return; }
        const open = U.$$('dialog').filter(d => d.open).pop();
        if (open) {
          if (open.id === 'dlgRinging') { this.stopRinging(); return; }
          open.close();
        }
      });
    },

    /* ==========================================
       GESTOS (móvil): deslizar entre pestañas y
       jalar hacia abajo para actualizar Finanzas
       ========================================== */
    bindGestures() {
      const ORDER = ['assistant', 'notes', 'finance', 'more'];
      const views = U.$('.views');
      const SKIP = 'input, textarea, select, button, a, .crypto-row, .list-chips, .segmented, .suggestions, .line-chart, .chip-row, .md-table-wrap, pre, .composer, .voice-bar, .pl-row, .home-grid .bento-quick';
      let start = null;
      views.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || root.innerWidth > 860) { start = null; return; }
        const t = e.touches[0];
        const skip = e.target.closest(SKIP);
        start = { x: t.clientX, y: t.clientY, time: Date.now(), skip: !!skip, view: U.$('.view.active') };
      }, { passive: true });
      views.addEventListener('touchmove', (e) => {
        if (!start || this.view !== 'finance') return;
        const dy = e.touches[0].clientY - start.y;
        const v = start.view;
        if (v && v.scrollTop <= 0 && dy > 0) {
          v.style.transform = `translateY(${Math.min(70, dy * 0.4)}px)`;
          start.pull = dy;
        }
      }, { passive: true });
      views.addEventListener('touchend', (e) => {
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        const v = start.view;
        if (v) v.style.transform = '';
        if (this.view === 'finance' && start.pull > 140 && v && v.scrollTop <= 0) {
          this.haptic(12);
          root.YarbisFinanceView.refresh(true);
        } else if (!start.skip && Math.abs(dx) > 80 && Math.abs(dy) < 60 && Date.now() - start.time < 600) {
          const idx = ORDER.indexOf(this.view);
          const next = ORDER[idx + (dx < 0 ? 1 : -1)];
          if (next) {
            this.haptic();
            this.showView(next);
          }
        }
        start = null;
      }, { passive: true });

      // Vibración corta en los toques principales
      root.document.addEventListener('click', (e) => {
        if (e.target.closest('.tab, .nav-item, .mic-btn, .quick-btn, .chip-btn, .note-check, .suggestion, .list-chip, .segmented button, .btn-primary')) this.haptic();
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
        // Contador en el ícono de la app instalada (Android/escritorio)
        try {
          if (n && root.navigator.setAppBadge) root.navigator.setAppBadge(n).catch(() => {});
          else if (!n && root.navigator.clearAppBadge) root.navigator.clearAppBadge().catch(() => {});
        } catch (e) { /* no soportado */ }
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

      // Alertas de tasa: aviso en el chat, sonido y notificación
      this.finance.onAlert((a) => {
        const title = '🔔 Alerta del dólar';
        const text = `El ${a.rate === 'paralelo' ? 'paralelo' : 'dólar BCV'} ya está en **${U.fmtBs(a.current)}** (${a.dir === 'above' ? 'pasó de' : 'bajó de'} ${U.fmtBs(a.value)}).`;
        this.addMessage({ role: 'assistant', text: `${title}: ${text}`, actions: [{ label: 'Ver Finanzas', view: 'finance' }] });
        this.audio.playProtocolAlert();
        U.toast(U.toSpeech(text), { type: 'warn', duration: 7000 });
        if (root.document.hidden) this.reminders.notify(title, U.toSpeech(text), 'yarbis-fx');
      });
      // Con alertas activas se revisa la tasa cada 15 minutos aunque no estés en Finanzas
      setInterval(() => {
        if (this.finance.alerts.length && !root.document.hidden && this.view !== 'finance') this.finance.refresh().catch(() => {});
      }, 15 * 60 * 1000);
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
