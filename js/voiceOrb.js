/* ==========================================================================
   YARBIS - ORBE DE VOZ
   Animación ligera en canvas que reacciona al estado y nivel de audio.
   Se detiene cuando la pestaña está oculta o el orbe no es visible.
   ========================================================================== */

(function (root) {
  'use strict';

  function hexToRgb(hex) {
    const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return { r: 59, g: 130, b: 246 };
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  class VoiceOrb {
    constructor(canvasId) {
      this.canvas = root.document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.state = 'STANDBY';
      this.level = 0;
      this.smoothLevel = 0;
      this.t = 0;
      this.color = { r: 59, g: 130, b: 246 };
      this.visible = true;
      this.running = false;

      this.resize = this.resize.bind(this);
      this.frame = this.frame.bind(this);
      root.addEventListener('resize', this.resize);
      this.resize();

      if ('IntersectionObserver' in root) {
        new IntersectionObserver((entries) => {
          this.visible = entries[0].isIntersecting;
          this.ensureRunning();
        }).observe(this.canvas);
      }
      root.document.addEventListener('visibilitychange', () => this.ensureRunning());
      this.ensureRunning();
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setTheme(colorHex) {
      this.color = hexToRgb(colorHex);
    }

    setState(state) {
      this.state = state;
      this.ensureRunning();
    }

    setAudioLevel(level) {
      this.level = Math.max(0, Math.min(1, Number(level) || 0));
    }

    ensureRunning() {
      const shouldRun = this.canvas && this.visible && !root.document.hidden;
      if (shouldRun && !this.running) {
        this.running = true;
        this.last = performance.now();
        requestAnimationFrame(this.frame);
      } else if (!shouldRun) {
        this.running = false;
      }
    }

    frame(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;

      const active = this.state !== 'STANDBY';
      const speed = this.state === 'PROCESSING' ? 2.6 : active ? 1.6 : 0.6;
      this.t += dt * speed;
      this.smoothLevel += (this.level - this.smoothLevel) * 0.18;

      if (this.w !== this.canvas.getBoundingClientRect().width) this.resize();
      this.draw();
      requestAnimationFrame(this.frame);
    }

    draw() {
      const { ctx, w, h } = this;
      const { r, g, b } = this.color;
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.3;
      const lvl = this.smoothLevel;

      ctx.clearRect(0, 0, w, h);

      // Halo
      const haloR = base * (1.55 + lvl * 0.5);
      const halo = ctx.createRadialGradient(cx, cy, base * 0.6, cx, cy, haloR);
      halo.addColorStop(0, `rgba(${r},${g},${b},${0.22 + lvl * 0.25})`);
      halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Blob orgánico
      const points = 64;
      const wobble = this.state === 'STANDBY' ? 0.035 : 0.06 + lvl * 0.16;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const n = Math.sin(a * 3 + this.t * 1.3) * 0.5 +
                  Math.sin(a * 5 - this.t * 1.7) * 0.3 +
                  Math.sin(a * 2 + this.t * 0.9) * 0.2;
        const rad = base * (1 + n * wobble + lvl * 0.12);
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const fill = ctx.createLinearGradient(cx - base, cy - base, cx + base, cy + base);
      fill.addColorStop(0, `rgba(${Math.min(255, r + 70)},${Math.min(255, g + 70)},${Math.min(255, b + 70)},1)`);
      fill.addColorStop(1, `rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},1)`);
      ctx.fillStyle = fill;
      ctx.fill();

      // Brillo interior
      const gloss = ctx.createRadialGradient(cx - base * 0.35, cy - base * 0.4, 1, cx, cy, base * 1.1);
      gloss.addColorStop(0, 'rgba(255,255,255,0.55)');
      gloss.addColorStop(0.45, 'rgba(255,255,255,0.06)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      ctx.fill();

      // Anillo giratorio al procesar
      if (this.state === 'PROCESSING') {
        ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, base * 1.32, this.t * 2, this.t * 2 + Math.PI * 0.7);
        ctx.stroke();
      }
    }
  }

  root.VoiceOrb = VoiceOrb;
})(typeof window !== 'undefined' ? window : globalThis);
