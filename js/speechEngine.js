/* ==========================================================================
   YARBIS - SPEECH ENGINE (STT & TTS)
   Speech Recognition (Escuchar) & Speech Synthesis (Hablar)
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

    // Event Callbacks
    this.onSpeechResult = null; // (text) => {}
    this.onInterimResult = null; // (interimText) => {}
    this.onStateChange = null; // (state) => {} 'STANDBY', 'LISTENING', 'PROCESSING', 'SPEAKING'
    this.onAudioLevel = null; // (level 0-1) => {}

    this.initRecognition();
    this.initSynthesis();
  }

  /* ==========================================
     SPEECH RECOGNITION (STT)
     ========================================== */
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;

    this.recognition.onstart = () => {
      this.isListening = true;
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
        if (this.onAudioLevel) this.onAudioLevel(0.4 + Math.random() * 0.4);
      }

      if (final) {
        if (this.onStateChange) this.onStateChange('PROCESSING');
        if (this.onSpeechResult) this.onSpeechResult(final.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      if (this.onStateChange) this.onStateChange('STANDBY');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (!this.isSpeaking && this.onStateChange) {
        this.onStateChange('STANDBY');
      }
      // Re-trigger if in continuous listening mode
      if (this.continuousMode && !this.isSpeaking) {
        setTimeout(() => this.startListening(), 300);
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

  startListening() {
    if (this.isSpeaking) {
      this.stopSpeaking();
    }
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
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
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

    // Find best Spanish / J.A.R.V.I.S voice
    const langPrefix = this.language.substring(0, 2);
    
    // Priority: Spanish Male/Futuristic sounding voices -> Spanish general -> Default
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(langPrefix) && (
        v.name.includes('Jorge') || 
        v.name.includes('Pablo') || 
        v.name.includes('Diego') ||
        v.name.includes('Google español') ||
        v.name.includes('Spanish')
      )
    ) || voices.find(v => v.lang.startsWith(langPrefix)) || voices[0];

    this.selectedVoice = preferredVoice;
  }

  speak(text) {
    if (!this.synthesis) return;

    // Cancel current speech if any
    this.synthesis.cancel();

    // If microphone is currently listening, pause it
    if (this.isListening) {
      this.stopListening();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = this.language;

    // Pitch & Speed tuned for J.A.R.V.I.S. futuristic tone
    utterance.pitch = 0.95;
    utterance.rate = 1.05;

    let audioPulseInterval = null;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onStateChange) this.onStateChange('SPEAKING');
      if (window.audioSynth) window.audioSynth.playVoiceBeep();

      // Simulate voice audio waveform output
      audioPulseInterval = setInterval(() => {
        if (this.onAudioLevel) {
          this.onAudioLevel(0.3 + Math.random() * 0.6);
        }
      }, 100);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (audioPulseInterval) clearInterval(audioPulseInterval);
      if (this.onAudioLevel) this.onAudioLevel(0);

      if (this.onStateChange) this.onStateChange('STANDBY');

      // Resume continuous mode if active
      if (this.continuousMode) {
        setTimeout(() => this.startListening(), 500);
      }
    };

    utterance.onerror = (err) => {
      console.error('TTS error:', err);
      this.isSpeaking = false;
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
    if (this.onAudioLevel) this.onAudioLevel(0);
    if (this.onStateChange) this.onStateChange('STANDBY');
  }
}

window.YARBISSpeechEngine = YARBISSpeechEngine;
