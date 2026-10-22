/* ==========================================================================
   YARBIS - GRABADORA DE VOZ
   Plan B cuando el navegador no reconoce voz (iPhone con la app instalada,
   Brave, Firefox): graba lo que dices, se detiene sola al detectar silencio
   y la IA lo convierte en texto.
   ========================================================================== */

(function (root) {
  'use strict';

  const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];

  function supported() {
    const nav = root.navigator || {};
    return !!(nav.mediaDevices && nav.mediaDevices.getUserMedia && root.MediaRecorder);
  }

  function pickMime() {
    const MR = root.MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== 'function') return '';
    return MIME_TYPES.find(t => { try { return MR.isTypeSupported(t); } catch (e) { return false; } }) || '';
  }

  class VoiceRecorder {
    constructor({ onLevel = null, silenceMs = 1400, maxMs = 30000, idleMs = 8000 } = {}) {
      this.onLevel = onLevel;
      this.silenceMs = silenceMs;
      this.maxMs = maxMs;
      this.idleMs = idleMs;
      this.spoke = false;
      this.cancelled = false;
      this.done = new Promise(resolve => { this.resolveDone = resolve; });
    }

    async start() {
      // El AudioContext se crea antes del primer "await" para conservar el
      // gesto del usuario (iOS no deja reanudarlo después).
      const Ctx = root.AudioContext || root.webkitAudioContext;
      try { this.ctx = Ctx ? new Ctx() : null; } catch (e) { this.ctx = null; }

      this.stream = await root.navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const mime = pickMime();
      this.mr = new root.MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.mime = this.mr.mimeType || mime || 'audio/webm';
      const chunks = [];
      this.mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      this.mr.onstop = () => {
        this.cleanup();
        this.resolveDone({
          blob: new root.Blob(chunks, { type: this.mime }),
          spoke: this.spoke,
          cancelled: this.cancelled,
          manual: this.stoppedBy === 'manual',
          durationMs: Date.now() - this.startedAt
        });
      };
      this.mr.start(250);
      this.startedAt = Date.now();
      this.watch();
      return this;
    }

    // Mide el volumen para animar el orbe y cortar al detectar silencio
    watch() {
      let analyser = null;
      try {
        if (this.ctx) {
          if (this.ctx.state === 'suspended') this.ctx.resume();
          const src = this.ctx.createMediaStreamSource(this.stream);
          analyser = this.ctx.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser);
        }
      } catch (e) { analyser = null; }
      const data = analyser ? new Float32Array(analyser.fftSize) : null;
      // Ruido de fondo: el nivel más bajo de los primeros instantes (si
      // empiezas a hablar enseguida, tu voz no cuenta como "ruido")
      let floor = Infinity;
      let lastVoice = 0;
      let voiced = 0;
      this.timer = setInterval(() => {
        const now = Date.now();
        const elapsed = now - this.startedAt;
        if (analyser) {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          const rms = Math.sqrt(sum / data.length);
          if (elapsed < 500) floor = Math.min(floor, rms);
          const threshold = Math.max(0.015, (Number.isFinite(floor) ? floor : 0) * 3);
          if (rms > threshold) {
            voiced += 80;
            lastVoice = now;
            if (voiced >= 240) this.spoke = true;
          }
          if (this.onLevel) this.onLevel(Math.min(1, rms * 6));
          if (this.spoke && now - lastVoice > this.silenceMs) this.stop('silence');
          else if (!this.spoke && elapsed > this.idleMs) this.stop('idle');
        } else {
          // Sin medidor: se asume que hablas y se corta al tocar otra vez o al máximo
          this.spoke = elapsed > 600;
          if (this.onLevel) this.onLevel(0.25 + Math.random() * 0.3);
        }
        if (elapsed > this.maxMs) this.stop('max');
      }, 80);
    }

    // reason: 'manual' (tocaste el micrófono), 'silence', 'idle', 'max' o 'cancel'
    stop(reason = 'manual') {
      if (!this.stoppedBy) this.stoppedBy = reason;
      clearInterval(this.timer);
      if (this.mr && this.mr.state !== 'inactive') {
        try { this.mr.stop(); } catch (e) { this.cleanup(); }
      }
    }

    cancel() {
      this.cancelled = true;
      this.stop('cancel');
    }

    cleanup() {
      clearInterval(this.timer);
      if (this.onLevel) this.onLevel(0);
      if (this.stream) this.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* ignorar */ } });
      if (this.ctx && this.ctx.state !== 'closed') { try { this.ctx.close(); } catch (e) { /* ignorar */ } }
    }
  }

  // Convierte un Blob en base64 (sin el prefijo data:)
  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return root.btoa(bin);
  }

  root.YarbisRecorder = { VoiceRecorder, supported, pickMime, blobToBase64 };
})(typeof window !== 'undefined' ? window : globalThis);
