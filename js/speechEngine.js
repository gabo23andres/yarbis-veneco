/* ==========================================================================
   YARBIS - SPEECH ENGINE (STT & TTS) 4.0 - iOS & MOBILE OPTIMIZED
   Instant iOS Safari & Android Webkit Speech Commitment & Prime Audio Engine
   ========================================================================== */

class YARBISSpeechEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.selectedVoice = null;
    this.language = 'es-ES';

    this.isListening = false;
    this.isSpeaking = false;
    this.continuousMode = false;
    this.hasMicPermission = false;
    this.hasPrimedAudio = false;
    this.wakeLock = null;

    this.pitch = parseFloat(localStorage.getItem('yarbis_voice_pitch') || '1.0');
    this.rate = parseFloat(localStorage.getItem('yarbis_voice_rate') || '1.05');

    this.lastRecognizedText = '';
    this.silenceTimer = null;
    this.hasCommitted = false;

    // Event Callbacks
    this.onSpeechResult = null; // (text) => {}
    this.onInterimResult = null; // (interimText) => {}
    this.onStateChange = null; // (state) => {} 'STANDBY', 'LISTENING', 'PROCESSING', 'SPEAKING'
    this.onAudioLevel = null; // (level 0-1) => {}
    this.onPermissionError = null; // (msg) => {}

    this.initRecognition();
    this.initSynthesis();
  }

  /* ==========================================
     MOBILE PERMISSIONS & WAKELOCK & AUDIO UNLOCK
     ========================================== */
  async requestMicrophonePermission() {
    if (this.hasMicPermission) return true;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        this.hasMicPermission = true;
        return true;
      } catch (e) {
        console.warn('Microphone permission denied on mobile:', e);
        if (this.onPermissionError) {
          this.onPermissionError('Por favor permite el acceso al micrófono en tu celular para hablar con YARBIS Veneco.');
        }
        return false;
      }
    }
    return true;
  }

  primeSpeechSynthesis() {
    if (this.synthesis && !this.hasPrimedAudio) {
      try {
        const emptyUtterance = new SpeechSynthesisUtterance('');
        emptyUtterance.volume = 0;
        this.synthesis.speak(emptyUtterance);
        this.hasPrimedAudio = true;
      } catch (e) {}
    }
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  /* ==========================================
     SPEECH RECOGNITION (STT)
     ========================================== */
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API no soportada en este navegador.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.language;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.hasCommitted = false;
      this.lastRecognizedText = '';
      this.requestWakeLock();
      if (this.onStateChange) this.onStateChange('LISTENING');
      if (window.audioSynth) window.audioSynth.playMicChime();
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const currentText = (final || interim || '').trim();

      if (currentText) {
        this.lastRecognizedText = currentText;
        if (this.onInterimResult) {
          this.onInterimResult(currentText);
          if (this.onAudioLevel) this.onAudioLevel(0.4 + Math.random() * 0.5);
        }
      }

      // Clear existing silence commitment timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // If explicit final flag received, commit immediately
      if (final && final.trim()) {
        this.commitSpeechResult(final.trim());
      } else if (currentText) {
        // Fallback silence timer for iOS Safari where isFinal is often delayed
        this.silenceTimer = setTimeout(() => {
          if (this.lastRecognizedText && !this.hasCommitted) {
            this.commitSpeechResult(this.lastRecognizedText);
          }
        }, 1300);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.isListening = false;
      this.releaseWakeLock();

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // If we accumulated speech text before error occurred, commit it anyway
      if (this.lastRecognizedText && !this.hasCommitted) {
        this.commitSpeechResult(this.lastRecognizedText);
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (this.onPermissionError) {
          this.onPermissionError('El micrófono está bloqueado. Toca el icono del candado 🔒 en la barra superior de tu navegador y selecciona "Permitir micrófono".');
        }
      } else if (event.error === 'no-speech') {
        if (this.onPermissionError) {
          this.onPermissionError('No detecté sonido de voz. Toca el micrófono e intenta hablar de nuevo.');
        }
      } else if (event.error === 'network') {
        if (this.onPermissionError) {
          this.onPermissionError('Error de red al conectar con el servicio de voz. Revisa tu conexión a internet.');
        }
      }

      if (this.onStateChange && !this.isSpeaking) {
        this.onStateChange('STANDBY');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.releaseWakeLock();

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // Commit any unhandled accumulated text on iOS Safari onend
      if (this.lastRecognizedText && !this.hasCommitted) {
        this.commitSpeechResult(this.lastRecognizedText);
        return;
      }

      if (!this.isSpeaking && this.onStateChange) {
        this.onStateChange('STANDBY');
      }

      if (this.continuousMode && !this.isSpeaking) {
        setTimeout(() => this.startListening(), 400);
      }
    };
  }

  commitSpeechResult(text) {
    if (this.hasCommitted || !text || !text.trim()) return;
    this.hasCommitted = true;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    const cleanText = text.trim();
    this.lastRecognizedText = '';
    this.stopListening();

    if (this.onStateChange) this.onStateChange('PROCESSING');
    if (this.onSpeechResult) this.onSpeechResult(cleanText);
  }

  setLanguage(langCode) {
    this.language = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
    this.loadVoices();
  }

  async startListening() {
    if (this.isSpeaking) {
      this.stopSpeaking();
    }

    // Unlock iOS Audio
    this.primeSpeechSynthesis();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (this.onPermissionError) {
        this.onPermissionError('Tu navegador actual no soporta reconocimiento de voz nativo. Te recomendamos abrir en Safari (iOS) o Google Chrome (PC/Android), o escribir tus mensajes en el terminal de abajo.');
      }
      return;
    }

    // Explicitly prompt user for mic permission if not yet granted
    if (!this.hasMicPermission && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        this.hasMicPermission = true;
      } catch (err) {
        console.warn('Mic permission error:', err);
        if (this.onPermissionError) {
          this.onPermissionError('Permiso de micrófono denegado. Toca el candado 🔒 en tu navegador o Ajustes > Safari > Micrófono y selecciona "Permitir".');
        }
        return;
      }
    }

    if (!this.recognition) {
      this.initRecognition();
    }

    if (this.recognition && !this.isListening) {
      try {
        this.isListening = true;
        this.hasCommitted = false;
        this.lastRecognizedText = '';
        this.requestWakeLock();
        if (this.onStateChange) this.onStateChange('LISTENING');
        if (window.audioSynth) window.audioSynth.playMicChime();

        this.recognition.start();
      } catch (e) {
        console.warn('Recognition start exception:', e);
        try {
          this.recognition.abort();
          setTimeout(() => {
            try { this.recognition.start(); } catch(err){}
          }, 150);
        } catch (err) {}
      }
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Recognition stop exception:', e);
      }
    }
    this.isListening = false;
    this.releaseWakeLock();
  }

  async toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      await this.startListening();
    }
  }

  /* ==========================================
     SPEECH SYNTHESIS (TTS - HABLAR)
     ========================================== */
  initSynthesis() {
    if (!this.synthesis) return;
    this.loadVoices();

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    if (!this.synthesis) return;
    const voices = this.synthesis.getVoices();
    if (!voices || voices.length === 0) return;

    const langPrefix = this.language.substring(0, 2);

    const preferredVoice = voices.find(v =>
      v.lang.startsWith(langPrefix) && (
        v.name.includes('Jorge') ||
        v.name.includes('Pablo') ||
        v.name.includes('Diego') ||
        v.name.includes('Google español') ||
        v.name.includes('Spanish') ||
        v.name.includes('Español')
      )
    ) || voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) || voices[0];

    this.selectedVoice = preferredVoice;
  }

  speak(text) {
    if (!this.synthesis) return;

    this.synthesis.cancel();

    if (this.isListening) {
      this.stopListening();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = this.language;

    utterance.pitch = this.pitch;
    utterance.rate = this.rate;

    let audioPulseInterval = null;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.requestWakeLock();
      if (this.onStateChange) this.onStateChange('SPEAKING');
      if (window.audioSynth) window.audioSynth.playVoiceBeep();

      audioPulseInterval = setInterval(() => {
        if (this.onAudioLevel) {
          this.onAudioLevel(0.3 + Math.random() * 0.6);
        }
      }, 100);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.releaseWakeLock();
      if (audioPulseInterval) clearInterval(audioPulseInterval);
      if (this.onAudioLevel) this.onAudioLevel(0);

      if (this.onStateChange) this.onStateChange('STANDBY');

      if (this.continuousMode) {
        setTimeout(() => this.startListening(), 500);
      }
    };

    utterance.onerror = (err) => {
      console.warn('TTS error:', err);
      this.isSpeaking = false;
      this.releaseWakeLock();
      if (audioPulseInterval) clearInterval(audioPulseInterval);
      if (this.onAudioLevel) this.onAudioLevel(0);
      if (this.onStateChange) this.onStateChange('STANDBY');
    };

    this.synthesis.speak(utterance);
  }

  setPitch(val) {
    this.pitch = parseFloat(val);
    localStorage.setItem('yarbis_voice_pitch', this.pitch.toString());
  }

  setRate(val) {
    this.rate = parseFloat(val);
    localStorage.setItem('yarbis_voice_rate', this.rate.toString());
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.isSpeaking = false;
    this.releaseWakeLock();
    if (this.onAudioLevel) this.onAudioLevel(0);
    if (this.onStateChange) this.onStateChange('STANDBY');
  }
}

// Global Export Class & Instance
window.YARBISSpeechEngine = YARBISSpeechEngine;
window.speechEngine = new YARBISSpeechEngine();
