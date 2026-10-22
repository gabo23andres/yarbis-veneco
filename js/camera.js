/* ==========================================================================
   YARBIS - CÁMARA Y ESCÁNER
   - QR / códigos de barras SIN internet: BarcodeDetector nativo o jsQR
     (cargado bajo demanda) como respaldo para Safari.
   - Visión IA (objeto, documento/OCR, traducir): la imagen se reduce a
     ≤1024 px y se envía al cerebro (Gemini o IA gratuita).
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

  const MODES = {
    general: { label: 'Analizar con IA', hint: 'Apunta a un objeto, lugar o escena.' },
    document: { label: 'Leer documento', hint: 'Encuadra el documento completo y con buena luz.' },
    translate: { label: 'Traducir texto', hint: 'Apunta al texto que quieres traducir.' },
    qr: { label: 'Escaneando…', hint: 'Apunta al código QR o de barras. Se lee solo.' }
  };

  let jsQrPromise = null;
  function loadJsQr() {
    if (root.jsQR) return Promise.resolve(root.jsQR);
    if (!jsQrPromise) {
      jsQrPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = JSQR_URL;
        s.async = true;
        s.onload = () => (root.jsQR ? resolve(root.jsQR) : reject(new Error('jsQR no disponible')));
        s.onerror = () => { jsQrPromise = null; reject(new Error('No se pudo cargar el lector QR')); };
        document.head.appendChild(s);
      });
    }
    return jsQrPromise;
  }

  async function createDetector() {
    if ('BarcodeDetector' in root) {
      try {
        const formats = await root.BarcodeDetector.getSupportedFormats();
        if (formats && formats.length) return new root.BarcodeDetector({ formats });
      } catch (e) { /* usar jsQR */ }
    }
    return null;
  }

  // Reduce una imagen/video a JPEG ≤ maxSize px
  function toJpeg(source, width, height, maxSize = 1024, quality = 0.82) {
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', quality), canvas };
  }

  function cameraErrorMessage(err) {
    if (!root.isSecureContext) return 'La cámara sólo funciona en una página segura (https).';
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permiso de cámara denegado. Actívalo en la configuración del navegador.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No encontré ninguna cámara en este dispositivo.';
    if (name === 'NotReadableError') return 'La cámara está siendo usada por otra app. Ciérrala e inténtalo de nuevo.';
    return 'No se pudo abrir la cámara.';
  }

  class CameraController {
    constructor() {
      this.stream = null;
      this.facing = 'environment';
      this.mode = 'general';
      this.torchOn = false;
      this.detector = null;
      this.scanLoop = null;
      this.busy = false;
      this.onImage = null; // (dataUrl, mode) => {}
      this.onCode = null;  // (text) => {}
    }

    mount({ onImage, onCode }) {
      this.onImage = onImage;
      this.onCode = onCode;
      this.dialog = U.$('#dlgCamera');
      this.video = U.$('#cameraVideo');
      this.hint = U.$('#cameraHint');
      this.captureBtn = U.$('#btnCameraCapture');
      this.torchBtn = U.$('#btnCameraTorch');
      if (!this.dialog) return;

      U.$$('[data-scan-mode]').forEach(btn => {
        btn.addEventListener('click', () => this.setMode(btn.dataset.scanMode));
      });
      U.$('#btnCameraSwitch').addEventListener('click', () => {
        this.facing = this.facing === 'environment' ? 'user' : 'environment';
        this.start();
      });
      this.torchBtn.addEventListener('click', () => this.toggleTorch());
      this.captureBtn.addEventListener('click', () => this.capture());
      U.$('#cameraGallery').addEventListener('change', (e) => this.fromFile(e.target.files && e.target.files[0], e.target));
      this.dialog.addEventListener('close', () => this.stop());
      this.setMode(this.mode);
    }

    async open(mode) {
      if (!this.dialog) return;
      if (mode) this.setMode(mode);
      if (!this.dialog.open) this.dialog.showModal();
      await this.start();
    }

    close() {
      if (this.dialog && this.dialog.open) this.dialog.close();
      this.stop();
    }

    setMode(mode) {
      this.mode = MODES[mode] ? mode : 'general';
      U.$$('[data-scan-mode]').forEach(b => {
        const active = b.dataset.scanMode === this.mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (this.captureBtn) {
        this.captureBtn.textContent = MODES[this.mode].label;
        this.captureBtn.disabled = this.mode === 'qr';
      }
      if (this.hint) this.hint.textContent = MODES[this.mode].hint;
      if (this.mode === 'qr' && this.stream) this.startQrLoop();
      else this.stopQrLoop();
    }

    async start() {
      this.stopStream();
      if (!root.navigator.mediaDevices || !root.navigator.mediaDevices.getUserMedia) {
        this.setHint(cameraErrorMessage(null), true);
        return;
      }
      try {
        this.stream = await root.navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: this.facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        this.video.srcObject = this.stream;
        await this.video.play().catch(() => {});
        this.video.classList.toggle('mirrored', this.facing === 'user');
        const track = this.stream.getVideoTracks()[0];
        const caps = track && track.getCapabilities ? track.getCapabilities() : {};
        this.torchBtn.hidden = !caps.torch;
        this.torchOn = false;
        this.torchBtn.classList.remove('active');
        this.setHint(MODES[this.mode].hint);
        if (this.mode === 'qr') this.startQrLoop();
      } catch (err) {
        console.warn('Cámara:', err);
        this.setHint(cameraErrorMessage(err), true);
      }
    }

    setHint(text, isError = false) {
      if (!this.hint) return;
      this.hint.textContent = text;
      this.hint.classList.toggle('error', isError);
    }

    stopStream() {
      this.stopQrLoop();
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
      if (this.video) this.video.srcObject = null;
    }

    stop() {
      this.stopStream();
    }

    async toggleTorch() {
      const track = this.stream && this.stream.getVideoTracks()[0];
      if (!track) return;
      try {
        this.torchOn = !this.torchOn;
        await track.applyConstraints({ advanced: [{ torch: this.torchOn }] });
        this.torchBtn.classList.toggle('active', this.torchOn);
      } catch (e) {
        this.torchOn = false;
        U.toast('La linterna no está disponible en este dispositivo.', { type: 'warn' });
      }
    }

    /* ---------- QR ---------- */
    async decode(source, width, height) {
      if (!this.detector) this.detector = await createDetector();
      if (this.detector) {
        try {
          const codes = await this.detector.detect(source);
          if (codes && codes.length) return codes[0].rawValue;
          return null;
        } catch (e) { /* intentar con jsQR */ }
      }
      const jsQR = await loadJsQr();
      const { canvas } = toJpeg(source, width, height, 800, 0.9);
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      return code ? code.data : null;
    }

    startQrLoop() {
      this.stopQrLoop();
      const loop = async () => {
        if (!this.stream || this.mode !== 'qr') return;
        if (!this.busy && this.video.readyState >= 2) {
          this.busy = true;
          try {
            const text = await this.decode(this.video, this.video.videoWidth, this.video.videoHeight);
            if (text) {
              if (root.audioSynth) root.audioSynth.playSuccessChime();
              if (root.audioSynth && root.audioSynth.canVibrate()) navigator.vibrate(80);
              this.close();
              if (this.onCode) this.onCode(text);
              this.busy = false;
              return;
            }
          } catch (e) {
            this.setHint(e.message || 'No se pudo iniciar el lector QR.', true);
            this.busy = false;
            return;
          }
          this.busy = false;
        }
        this.scanLoop = setTimeout(loop, 250);
      };
      this.scanLoop = setTimeout(loop, 300);
    }

    stopQrLoop() {
      clearTimeout(this.scanLoop);
      this.scanLoop = null;
    }

    /* ---------- Captura ---------- */
    capture() {
      if (!this.stream || !this.video.videoWidth) {
        U.toast('La cámara no está lista. También puedes subir una foto de la galería.', { type: 'warn' });
        return;
      }
      const { dataUrl } = toJpeg(this.video, this.video.videoWidth, this.video.videoHeight);
      if (root.audioSynth) root.audioSynth.playScanSound();
      const mode = this.mode;
      this.close();
      if (this.onImage) this.onImage(dataUrl, mode);
    }

    fromFile(file, input) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = async () => {
          const mode = this.mode;
          if (mode === 'qr') {
            try {
              const text = await this.decode(img, img.naturalWidth, img.naturalHeight);
              this.close();
              if (text) { if (this.onCode) this.onCode(text); }
              else U.toast('No encontré ningún código QR en esa imagen.', { type: 'warn' });
            } catch (e) {
              U.toast(e.message || 'No se pudo leer el código.', { type: 'error' });
            }
          } else {
            const { dataUrl } = toJpeg(img, img.naturalWidth, img.naturalHeight);
            this.close();
            if (this.onImage) this.onImage(dataUrl, mode);
          }
          if (input) input.value = '';
        };
        img.onerror = () => U.toast('No se pudo abrir esa imagen.', { type: 'error' });
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Utilidades para imágenes que llegan por "Compartir"
  CameraController.prototype.loadImage = function (dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
      img.src = dataUrl;
    });
  };
  CameraController.prototype.shrinkDataUrl = async function (dataUrl) {
    const img = await this.loadImage(dataUrl);
    return toJpeg(img, img.naturalWidth, img.naturalHeight).dataUrl;
  };
  CameraController.prototype.decodeDataUrl = async function (dataUrl) {
    const img = await this.loadImage(dataUrl);
    return this.decode(img, img.naturalWidth, img.naturalHeight);
  };

  root.YarbisCamera = new CameraController();
})(typeof window !== 'undefined' ? window : globalThis);
