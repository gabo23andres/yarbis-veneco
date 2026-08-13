/* ==========================================================================
   YARBIS - STARK ARC REACTOR & AUDIO CANVAS ENGINE
   Interactive HTML5 Canvas Arc Reactor Core & Frequency Waveform Visualizer
   ========================================================================== */

class ArcReactorEngine {
  constructor(canvasId, waveformCanvasId, bgCanvasId = 'bgParticlesCanvas') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.wfCanvas = document.getElementById(waveformCanvasId);
    this.wfCtx = this.wfCanvas ? this.wfCanvas.getContext('2d') : null;

    this.bgCanvas = document.getElementById(bgCanvasId);
    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;

    this.angle = 0;
    this.audioLevel = 0; // 0.0 to 1.0
    this.targetAudioLevel = 0;
    this.state = 'STANDBY'; // STANDBY, LISTENING, PROCESSING, SPEAKING
    this.themeColor = '#00f3ff';
    this.themeRgb = '0, 243, 255';

    this.particles = [];
    this.bgParticles = [];
    
    this.initParticles();
    this.initBgParticles();

    this.initResizing();
    this.startAnimationLoop();
  }

  setTheme(colorHex, colorRgb) {
    this.themeColor = colorHex;
    this.themeRgb = colorRgb;
  }

  setState(newState) {
    this.state = newState;
  }

  setAudioLevel(level) {
    this.targetAudioLevel = Math.min(Math.max(level, 0), 1);
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 36; i++) {
      this.particles.push({
        angle: Math.random() * Math.PI * 2,
        dist: 35 + Math.random() * 75,
        speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.7 + 0.3
      });
    }
  }

  initBgParticles() {
    if (!this.bgCanvas) return;
    this.bgParticles = [];
    const count = 45;
    for (let i = 0; i < count; i++) {
      this.bgParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.5 + 0.1
      });
    }
  }

  initResizing() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (this.canvas) {
      this.canvas.width = 250;
      this.canvas.height = 250;
    }
    if (this.wfCanvas) {
      this.wfCanvas.width = 300;
      this.wfCanvas.height = 40;
    }
    if (this.bgCanvas) {
      this.bgCanvas.width = window.innerWidth;
      this.bgCanvas.height = window.innerHeight;
      this.initBgParticles();
    }
  }

  startAnimationLoop() {
    const loop = () => {
      // Smooth audio level interpolation
      this.audioLevel += (this.targetAudioLevel - this.audioLevel) * 0.15;

      this.drawBgParticles();
      this.drawArcReactor();
      this.drawWaveform();

      this.angle += 0.015 + (this.audioLevel * 0.05);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  drawBgParticles() {
    if (!this.bgCtx) return;
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    ctx.clearRect(0, 0, w, h);

    this.bgParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.themeRgb}, ${p.alpha})`;
      ctx.fill();
    });
  }

  drawArcReactor() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    const pulseScale = 1 + (this.audioLevel * 0.22);
    const baseGlow = 12 + (this.audioLevel * 25);

    // Outer Glowing Aura
    const radialGrad = ctx.createRadialGradient(cx, cy, 25, cx, cy, 110 * pulseScale);
    radialGrad.addColorStop(0, `rgba(${this.themeRgb}, 0.35)`);
    radialGrad.addColorStop(0.5, `rgba(${this.themeRgb}, 0.12)`);
    radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 110 * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    // 1. Outer Ring Segments
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);

    ctx.strokeStyle = `rgba(${this.themeRgb}, 0.85)`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = baseGlow;
    ctx.shadowColor = this.themeColor;

    const numOuterSegments = 12;
    const outerRadius = 88 * pulseScale;

    for (let i = 0; i < numOuterSegments; i++) {
      const segAngle = (Math.PI * 2) / numOuterSegments;
      const start = i * segAngle;
      const end = start + (segAngle * 0.65);

      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, start, end);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Middle Counter-Rotating Ring with Nodes
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.angle * 1.4);

    ctx.strokeStyle = `rgba(${this.themeRgb}, 0.9)`;
    ctx.lineWidth = 3.5;

    const numInnerNodes = 10;
    const innerRadius = 60 * pulseScale;

    for (let i = 0; i < numInnerNodes; i++) {
      const a = (i * Math.PI * 2) / numInnerNodes;
      const nx = Math.cos(a) * innerRadius;
      const ny = Math.sin(a) * innerRadius;

      // Draw node block
      ctx.fillStyle = this.themeColor;
      ctx.fillRect(nx - 3, ny - 3, 6, 6);
    }
    ctx.restore();

    // 3. Central Triangular Arc Reactor Core (Mark 85 Style)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle * 0.5);

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = baseGlow * 1.5;
    ctx.shadowColor = this.themeColor;

    const triRadius = 30 * pulseScale;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const tx = Math.cos(a) * triRadius;
      const ty = Math.sin(a) * triRadius;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.closePath();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = `rgba(${this.themeRgb}, 1)`;
    ctx.stroke();

    // Inner Core Glow fill
    ctx.fillStyle = `rgba(${this.themeRgb}, ${0.4 + this.audioLevel * 0.5})`;
    ctx.fill();
    ctx.restore();

    // 4. Center Bright Core Point
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 11 * pulseScale, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.themeColor;
    ctx.fill();
    ctx.restore();

    // 5. Floating Energy Particles
    this.particles.forEach(p => {
      p.angle += p.speed;
      const px = cx + Math.cos(p.angle) * p.dist * pulseScale;
      const py = cy + Math.sin(p.angle) * p.dist * pulseScale;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.themeRgb}, ${p.alpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = this.themeColor;
      ctx.fill();
    });
  }

  drawWaveform() {
    if (!this.wfCtx) return;
    const ctx = this.wfCtx;
    const w = this.wfCanvas.width;
    const h = this.wfCanvas.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.strokeStyle = this.themeColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.themeColor;

    const points = 50;
    const sliceW = w / points;

    for (let i = 0; i <= points; i++) {
      const x = i * sliceW;
      let amp = this.audioLevel * (h * 0.45);
      if (this.state === 'LISTENING') amp += Math.sin(i * 0.3 + Date.now() * 0.01) * 5;
      if (this.state === 'SPEAKING') amp += Math.sin(i * 0.5 + Date.now() * 0.02) * 10;

      const noise = (Math.random() - 0.5) * (amp * 0.4);
      const y = midY + Math.sin(i * 0.2 + Date.now() * 0.008) * amp + noise;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

window.ArcReactorEngine = ArcReactorEngine;

