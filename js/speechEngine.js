/* ==========================================================================
   YARBIS - SPEECH ENGINE (STT & TTS) 3.5 - MOBILE OPTIMIZED
   Mobile Mic Permission Warm-up, WakeLock & Cross-Browser Recognition
   ========================================================================== */

class YARBISSpeechEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.selectedVoice = null;
    this.language = 'es-ES'; // Default Spanish

    this.isListening = false;
    this.isSpeaking = false;
    this.continuousMode = false;
    this.hasMicPermission = false;
    this.wakeLock = null;

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
     MOBILE PERMISSIONS & WAKELOCK
     ========================================== */
  async requestMicrophonePermission() {
    if (this.hasMicPermission) return true;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop dummy tracks once permission is granted
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

      if (interim && this.onInterimResult) {
        this.onInterimResult(interim);
        if (this.onAudioLevel) this.onAudioLevel(0.4 + Math.random() * 0.5);
      }

      if (final) {
        if (this.onStateChange) this.onStateChange('PROCESSING');
        if (this.onSpeechResult) this.onSpeechResult(final.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.isListening = false;
      this.releaseWakeLock();

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (this.onPermissionError) {
          this.onPermissionError('El micrófono está bloqueado. Permite el acceso al micrófono en los ajustes del navegador.');
        }
      }

      if (this.onStateChange && !this.isSpeaking) {
        this.onStateChange('STANDBY');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.releaseWakeLock();

      if (!this.isSpeaking && this.onStateChange) {
        this.onStateChange('STANDBY');
      }

      // Continuous mode auto-restart for mobile
      if (this.continuousMode && !this.isSpeaking) {
        setTimeout(() => this.startListening(), 400);
      }
    };
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

    // Explicit mobile user permission warm-up
    const ok = await this.requestMicrophonePermission();
    if (!ok && !window.SpeechRecognition && !window.webkitSpeechRecognition) return;

    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Recognition start exception:', e);
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

    // Priority: Male / Natural sounding Spanish voices -> Any Spanish voice -> Default
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

    // Cancel current speech if any
    this.synthesis.cancel();

    // If mic is currently listening, pause it
    if (this.isListening) {
      this.stopListening();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = this.language;

    // Pitch & Speed tuned for futuristic tone
    utterance.pitch = 0.98;
    utterance.rate = 1.04;

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

window.YARBISSpeechEngine = YARBISSpeechEngine;
