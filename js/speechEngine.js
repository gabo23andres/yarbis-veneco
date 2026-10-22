/* ==========================================================================
   YARBIS - MOTOR DE VOZ (STT + TTS)
   Reconocimiento de voz con estados claros (EN ESPERA / ESCUCHANDO /
   PROCESANDO / HABLANDO), modo manos libres estable, selección de voz y
   lectura en fragmentos para evitar cortes de Chrome en textos largos.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;

  const PRIORITY_VOICES = [
    'google español de estados unidos', 'google español', 'paulina', 'mónica', 'monica',
    'microsoft sabina', 'microsoft dalia', 'microsoft elvira', 'microsoft alvaro',
    'jorge', 'diego', 'lucía', 'lucia', 'carlos', 'pablo', 'helena', 'laura'
  ];

  class YARBISSpeechEngine {
    constructor() {
      this.synthesis = 'speechSynthesis' in root ? root.speechSynthesis : null;
      this.Recognition = root.SpeechRecognition || root.webkitSpeechRecognition || null;
      this.recognitionSupported = !!this.Recognition;
      this.synthesisSupported = !!this.synthesis;

      this.language = S.getRaw('yarbis_voice_lang', 'es-ES');
      this.pitch = parseFloat(S.getRaw('yarbis_voice_pitch', '1')) || 1;
      this.rate = parseFloat(S.getRaw('yarbis_voice_rate', '1.05')) || 1.05;
      this.voiceName = S.getRaw('yarbis_voice_name', '');
      this.voiceOutput = S.getRaw('yarbis_voice_output', 'on') !== 'off';

      this.state = 'STANDBY';
      this.isListening = false;
      this.isSpeaking = false;
      this.isProcessing = false;
      this.continuousMode = false;

      this.recognition = null;
      this.session = 0;
      this.speakToken = 0;
      this.lastText = '';
      this.committed = false;
      this.silenceTimer = null;
      this.restartTimer = null;
      this.speakSafetyTimer = null;
      this.pulseTimer = null;
      this.wakeLock = null;
      this.primed = false;
      this.selectedVoice = null;
      this.triedFallbackLang = false;

      // Callbacks
      this.onSpeechResult = null;   // (texto) => {}
      this.onInterimResult = null;  // (texto) => {}
      this.onStateChange = null;    // (estado) => {}
      this.onAudioLevel = null;     // (0..1) => {}
      this.onError = null;          // (mensaje, { fatal }) => {}
      this.onContinuousChange = null; // (bool) => {}

      if (this.synthesis) {
        this.loadVoices();
        if ('onvoiceschanged' in this.synthesis) {
          this.synthesis.addEventListener
            ? this.synthesis.addEventListener('voiceschanged', () => this.loadVoices())
            : (this.synthesis.onvoiceschanged = () => this.loadVoices());
        }
      }

      if (root.document) {
        root.document.addEventListener('visibilitychange', () => {
          if (root.document.hidden && this.isListening) this.stopListening(true);
        });
      }
    }

    /* ------------------------------------------
       ESTADO
       ------------------------------------------ */
    setState(next) {
      if (this.state === next) return;
      this.state = next;
      if (next === 'STANDBY') this.releaseWakeLock();
      else this.requestWakeLock();
      if (this.onStateChange) this.onStateChange(next);
    }

    emitError(message, fatal = false) {
      if (this.onError) this.onError(message, { fatal });
    }

    async requestWakeLock() {
      if (this.wakeLock || !root.navigator || !('wakeLock' in root.navigator)) return;
      try {
        this.wakeLock = await root.navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      } catch (e) {
        this.wakeLock = null;
      }
    }

    releaseWakeLock() {
      if (this.wakeLock) {
        try { this.wakeLock.release(); } catch (e) { /* ignorar */ }
        this.wakeLock = null;
      }
    }

    // Desbloquea el audio de iOS dentro de un gesto del usuario
    primeSpeechSynthesis() {
      if (!this.synthesis || this.primed) return;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        this.synthesis.speak(u);
        this.primed = true;
      } catch (e) { /* ignorar */ }
    }

    /* ------------------------------------------
       RECONOCIMIENTO (STT)
       ------------------------------------------ */
    async startListening() {
      clearTimeout(this.restartTimer);
      if (!this.recognitionSupported) {
        this.emitError('Tu navegador no tiene reconocimiento de voz. Usa Chrome o Safari, o escribe tu mensaje.', true);
        this.setContinuous(false);
        return false;
      }
      if (this.isListening) return true;
      if (this.isSpeaking) this.stopSpeaking(true);

      this.primeSpeechSynthesis();

      const rec = new this.Recognition();
      rec.lang = this.language;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      const id = ++this.session;
      this.recognition = rec;
      this.lastText = '';
      this.committed = false;
      this.isListening = true;
      this.isProcessing = false;
      this.setState('LISTENING');
      if (root.audioSynth) root.audioSynth.playMicChime();
      this.startPulse(0.25);

      rec.onresult = (event) => {
        if (id !== this.session) return;
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += transcript;
          else interim += transcript;
        }
        const current = (finalText || interim).trim();
        if (current) {
          this.lastText = current;
          if (this.onInterimResult) this.onInterimResult(current);
        }
        clearTimeout(this.silenceTimer);
        if (finalText.trim()) {
          this.commit(finalText.trim());
        } else if (current) {
          // Safari iOS a veces tarda en marcar isFinal
          this.silenceTimer = setTimeout(() => {
            if (id === this.session && this.lastText && !this.committed) this.commit(this.lastText);
          }, 1500);
        }
      };

      rec.onerror = (event) => {
        if (id !== this.session) return;
        const err = event.error;
        if (err === 'aborted') return;
        if (err === 'no-speech') {
          if (!this.continuousMode) this.emitError('No escuché nada. Toca el micrófono e inténtalo de nuevo.');
          return;
        }
        if (err === 'language-not-supported' && !this.triedFallbackLang) {
          this.triedFallbackLang = true;
          this.language = this.language === 'es-ES' ? 'es-US' : 'es-ES';
          this.restartTimer = setTimeout(() => this.startListening(), 200);
          return;
        }
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this.setContinuous(false);
          this.emitError('El micrófono está bloqueado. Permite el acceso al micrófono en la configuración del navegador (icono del candado 🔒).', true);
        } else if (err === 'network') {
          this.setContinuous(false);
          this.emitError('El reconocimiento de voz necesita internet. Revisa tu conexión.', true);
        } else if (err === 'audio-capture') {
          this.setContinuous(false);
          this.emitError('No encontré un micrófono disponible.', true);
        } else {
          this.emitError(`Error de voz: ${err}`);
        }
      };

      rec.onend = () => {
        if (id !== this.session) return;
        clearTimeout(this.silenceTimer);
        this.isListening = false;
        this.stopPulse();
        if (this.lastText && !this.committed) {
          this.commit(this.lastText);
          return;
        }
        if (!this.isProcessing && !this.isSpeaking) {
          this.setState('STANDBY');
          this.scheduleRestart(350);
        }
      };

      try {
        rec.start();
        return true;
      } catch (e) {
        this.isListening = false;
        this.stopPulse();
        this.setState('STANDBY');
        this.emitError('No se pudo iniciar el micrófono. Inténtalo de nuevo.');
        return false;
      }
    }

    commit(text) {
      if (this.committed || !text) return;
      this.committed = true;
      clearTimeout(this.silenceTimer);
      this.lastText = '';
      this.isProcessing = true;
      this.setState('PROCESSING');
      try { this.recognition && this.recognition.stop(); } catch (e) { /* ignorar */ }
      if (this.onSpeechResult) this.onSpeechResult(text);
    }

    stopListening(abort = false) {
      clearTimeout(this.silenceTimer);
      clearTimeout(this.restartTimer);
      if (this.recognition && this.isListening) {
        try {
          if (abort) {
            this.session++; // ignora eventos tardíos
            this.recognition.abort();
          } else {
            this.recognition.stop();
          }
        } catch (e) { /* ignorar */ }
      }
      if (abort) {
        this.isListening = false;
        this.stopPulse();
        if (!this.isProcessing && !this.isSpeaking) this.setState('STANDBY');
      }
    }

    async toggleListening() {
      if (this.isSpeaking) {
        this.stopSpeaking(true);
        return this.startListening();
      }
      if (this.isListening) {
        this.stopListening(false);
        return false;
      }
      return this.startListening();
    }

    scheduleRestart(delay) {
      clearTimeout(this.restartTimer);
      if (!this.continuousMode) return;
      if (root.document && root.document.hidden) return;
      this.restartTimer = setTimeout(() => {
        if (this.continuousMode && !this.isListening && !this.isSpeaking && !this.isProcessing) {
          this.startListening();
        }
      }, delay);
    }

    setContinuous(on) {
      const value = !!on;
      const changed = value !== this.continuousMode;
      this.continuousMode = value;
      if (changed && this.onContinuousChange) this.onContinuousChange(value);
      if (value) {
        if (!this.isListening && !this.isSpeaking && !this.isProcessing) this.startListening();
      } else {
        clearTimeout(this.restartTimer);
        if (this.isListening) this.stopListening(true);
      }
    }

    // La app lo llama cuando terminó de procesar y no va a hablar
    doneProcessing() {
      this.isProcessing = false;
      if (!this.isSpeaking && !this.isListening) {
        this.setState('STANDBY');
        this.scheduleRestart(400);
      }
    }

    setLanguage(lang) {
      this.language = lang || 'es-ES';
      this.triedFallbackLang = false;
      S.setRaw('yarbis_voice_lang', this.language);
      this.loadVoices();
    }

    /* ------------------------------------------
       SÍNTESIS (TTS)
       ------------------------------------------ */
    getVoices() {
      if (!this.synthesis) return [];
      const all = this.synthesis.getVoices() || [];
      const prefix = (this.language || 'es').slice(0, 2).toLowerCase();
      return all.filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
    }

    loadVoices() {
      const voices = this.getVoices();
      if (!voices.length) {
        this.selectedVoice = null;
        return;
      }
      let best = null;
      if (this.voiceName) best = voices.find(v => v.name === this.voiceName) || null;
      if (!best) {
        const exactLang = voices.filter(v => (v.lang || '').toLowerCase() === this.language.toLowerCase());
        for (const name of PRIORITY_VOICES) {
          best = exactLang.find(v => v.name.toLowerCase().includes(name)) ||
                 voices.find(v => v.name.toLowerCase().includes(name));
          if (best) break;
        }
        if (!best) best = exactLang[0] || voices[0];
      }
      this.selectedVoice = best;
    }

    setVoice(name) {
      this.voiceName = name || '';
      S.setRaw('yarbis_voice_name', this.voiceName);
      this.loadVoices();
    }

    setPitch(val) {
      this.pitch = parseFloat(val) || 1;
      S.setRaw('yarbis_voice_pitch', String(this.pitch));
    }

    setRate(val) {
      this.rate = parseFloat(val) || 1;
      S.setRaw('yarbis_voice_rate', String(this.rate));
    }

    setVoiceOutput(on) {
      this.voiceOutput = !!on;
      S.setRaw('yarbis_voice_output', on ? 'on' : 'off');
      if (!on) this.stopSpeaking();
    }

    splitIntoChunks(text) {
      const sentences = text.match(/[^.!?;:\n]+[.!?;:\n]*/g) || [text];
      const chunks = [];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > 180 && current) {
          chunks.push(current.trim());
          current = '';
        }
        current += s;
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks.filter(Boolean);
    }

    speak(text, options = {}) {
      const spoken = U.toSpeech(text);
      const force = options.force === true;
      if (!this.synthesis || !spoken || (!this.voiceOutput && !force)) {
        this.doneProcessing();
        return;
      }

      if (this.isListening) this.stopListening(true);
      clearTimeout(this.restartTimer);
      clearTimeout(this.speakSafetyTimer);

      const token = ++this.speakToken;
      const wasBusy = this.synthesis.speaking || this.synthesis.pending;
      this.synthesis.cancel();

      this.isProcessing = false;
      this.isSpeaking = true;
      this.setState('SPEAKING');
      if (!this.selectedVoice) this.loadVoices();

      const chunks = this.splitIntoChunks(spoken);
      const finish = () => {
        if (token !== this.speakToken) return;
        clearTimeout(this.speakSafetyTimer);
        this.isSpeaking = false;
        this.stopPulse();
        this.setState('STANDBY');
        if (typeof options.onEnd === 'function') options.onEnd();
        this.scheduleRestart(450);
      };

      const queue = () => {
        if (token !== this.speakToken) return;
        // Otro idioma (traductor): usar una voz de ese idioma
        let voice = this.selectedVoice;
        let lang = (voice && voice.lang) || this.language;
        if (options.lang && !String(lang).toLowerCase().startsWith(options.lang.slice(0, 2).toLowerCase())) {
          const all = this.synthesis.getVoices() || [];
          const prefix = options.lang.slice(0, 2).toLowerCase();
          voice = all.find(v => (v.lang || '').toLowerCase() === options.lang.toLowerCase()) ||
            all.find(v => (v.lang || '').toLowerCase().startsWith(prefix)) || null;
          lang = options.lang;
        }
        chunks.forEach((chunk, idx) => {
          const u = new SpeechSynthesisUtterance(chunk);
          if (voice) u.voice = voice;
          u.lang = lang;
          u.pitch = this.pitch;
          u.rate = this.rate;
          if (idx === 0) {
            u.onstart = () => {
              if (token !== this.speakToken) return;
              if (root.audioSynth) root.audioSynth.playVoiceBeep();
              this.startPulse(0.55);
            };
          }
          if (idx === chunks.length - 1) {
            u.onend = finish;
          }
          u.onerror = (e) => {
            if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
            finish();
          };
          this.synthesis.speak(u);
        });
        // Red de seguridad: algunos navegadores nunca disparan onend
        const estimateMs = Math.min(120000, spoken.length * 90 / this.rate + 4000);
        this.speakSafetyTimer = setTimeout(() => {
          if (token === this.speakToken && this.isSpeaking && !this.synthesis.speaking) finish();
          else if (token === this.speakToken && this.isSpeaking) {
            this.speakSafetyTimer = setTimeout(finish, 20000);
          }
        }, estimateMs);
      };

      if (wasBusy) setTimeout(queue, 60);
      else queue();
    }

    stopSpeaking(silent = false) {
      this.speakToken++;
      clearTimeout(this.speakSafetyTimer);
      if (this.synthesis) {
        try { this.synthesis.cancel(); } catch (e) { /* ignorar */ }
      }
      const was = this.isSpeaking;
      this.isSpeaking = false;
      this.stopPulse();
      if (!silent && was && !this.isListening) this.setState('STANDBY');
    }

    stopAll() {
      this.setContinuous(false);
      this.stopListening(true);
      this.stopSpeaking();
      this.isProcessing = false;
      this.setState('STANDBY');
    }

    /* ------------------------------------------
       ESCUCHA INDEPENDIENTE (traductor y dictado)
       No pasa por el chat: devuelve el texto a quien lo pidió.
       ------------------------------------------ */
    listenOnce(lang) {
      return new Promise((resolve, reject) => {
        if (!this.recognitionSupported) { reject(new Error('Tu navegador no tiene reconocimiento de voz.')); return; }
        if (this.isListening) this.stopListening(true);
        if (this.isSpeaking) this.stopSpeaking(true);
        const rec = new this.Recognition();
        rec.lang = lang || this.language;
        rec.continuous = false;
        rec.interimResults = false;
        let text = '';
        rec.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
        };
        rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') reject(new Error(e.error)); };
        rec.onend = () => resolve(text.trim());
        try { rec.start(); } catch (e) { reject(e); }
        this.oneShot = rec;
      });
    }

    startDictation(lang, onUpdate) {
      if (!this.recognitionSupported) throw new Error('Tu navegador no tiene reconocimiento de voz.');
      if (this.isListening) this.stopListening(true);
      this.setContinuous(false);
      let active = true;
      let committed = '';
      let rec = null;
      const begin = () => {
        rec = new this.Recognition();
        rec.lang = lang || this.language;
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) committed += (committed && !/\s$/.test(committed) ? ' ' : '') + t.trim();
            else interim += t;
          }
          onUpdate(committed, interim.trim());
        };
        rec.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            active = false;
            this.emitError('El micrófono está bloqueado. Permite el acceso en el navegador.', true);
          }
        };
        // Chrome corta la escucha continua cada cierto tiempo: se reanuda sola
        rec.onend = () => { if (active) setTimeout(() => { if (active) begin(); }, 250); };
        try { rec.start(); } catch (e) { /* ya iniciado */ }
      };
      begin();
      return () => {
        active = false;
        try { rec && rec.stop(); } catch (e) { /* ignorar */ }
      };
    }

    /* ------------------------------------------
       NIVEL DE AUDIO (para animar el orbe)
       ------------------------------------------ */
    startPulse(intensity) {
      this.stopPulse();
      this.pulseTimer = setInterval(() => {
        if (this.onAudioLevel) this.onAudioLevel(intensity * (0.4 + Math.random() * 0.6));
      }, 110);
    }

    stopPulse() {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
      if (this.onAudioLevel) this.onAudioLevel(0);
    }
  }

  root.YARBISSpeechEngine = YARBISSpeechEngine;
})(typeof window !== 'undefined' ? window : globalThis);
