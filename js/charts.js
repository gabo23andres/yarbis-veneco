/* ==========================================================================
   YARBIS - GRÁFICOS SVG LIGEROS
   Sin librerías: mini‑gráfico (sparkline), líneas con tooltip y barras.
   Los colores vienen de variables CSS (--accent, --chart-2, --text-3...).
   ========================================================================== */

(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const U = root.YarbisUtils;

  function svgEl(tag, attrs) {
    const node = root.document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) node.setAttribute(k, v);
    });
    return node;
  }

  function scaler(values, min, max, size, pad) {
    const lo = min !== undefined ? min : Math.min(...values);
    const hi = max !== undefined ? max : Math.max(...values);
    const span = hi - lo || Math.abs(hi) * 0.02 || 1;
    return (v) => pad + (size - pad * 2) * (1 - (v - lo) / span);
  }

  // Mini‑gráfico de una serie (para tarjetas)
  function sparkline(values, opts = {}) {
    const w = opts.width || 120;
    const h = opts.height || 36;
    const svg = svgEl('svg', { class: `sparkline ${opts.className || ''}`, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    const vals = (values || []).filter(v => isFinite(v));
    if (vals.length < 2) return svg;
    const y = scaler(vals, undefined, undefined, h, 3);
    const step = w / (vals.length - 1);
    const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
    svg.appendChild(svgEl('path', { d: `M0,${h} L${pts.join(' L')} L${w},${h} Z`, class: 'spark-area' }));
    svg.appendChild(svgEl('path', { d: `M${pts.join(' L')}`, class: 'spark-line', fill: 'none' }));
    return svg;
  }

  /**
   * Gráfico de líneas con varias series y tooltip.
   * series: [{ name, color: 'var(--accent)', points: [{ t, v }] }]
   */
  function lineChart(series, opts = {}) {
    const w = opts.width || 640;
    const h = opts.height || 220;
    const padL = 54;
    const padR = 12;
    const padT = 14;
    const padB = 26;
    const wrap = U.el('div', { class: 'line-chart' });
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': opts.label || 'Gráfico' });
    wrap.appendChild(svg);

    const all = series.flatMap(s => s.points);
    if (all.length < 2) {
      wrap.appendChild(U.el('div', { class: 'chart-empty', text: opts.emptyText || 'Aún no hay suficientes datos. El gráfico se llena con el uso.' }));
      return wrap;
    }
    const tMin = Math.min(...all.map(p => p.t));
    const tMax = Math.max(...all.map(p => p.t));
    const vMin = Math.min(...all.map(p => p.v));
    const vMax = Math.max(...all.map(p => p.v));
    const margin = (vMax - vMin) * 0.08 || vMax * 0.01 || 1;
    const lo = vMin - margin;
    const hi = vMax + margin;
    const x = (t) => padL + (w - padL - padR) * ((t - tMin) / ((tMax - tMin) || 1));
    const y = (v) => padT + (h - padT - padB) * (1 - (v - lo) / ((hi - lo) || 1));

    // Rejilla y etiquetas del eje Y
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      const yy = y(v);
      svg.appendChild(svgEl('line', { x1: padL, x2: w - padR, y1: yy, y2: yy, class: 'chart-grid' }));
      const label = svgEl('text', { x: padL - 8, y: yy + 4, class: 'chart-axis', 'text-anchor': 'end' });
      label.textContent = U.fmtNumber(v, v >= 100 ? 0 : 2);
      svg.appendChild(label);
    }
    // Etiquetas del eje X (inicio y fin)
    [tMin, tMax].forEach((t, i) => {
      const label = svgEl('text', { x: x(t), y: h - 6, class: 'chart-axis', 'text-anchor': i ? 'end' : 'start' });
      label.textContent = new Date(t).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
      svg.appendChild(label);
    });

    series.forEach(s => {
      if (s.points.length < 2) return;
      const pts = s.points.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
      svg.appendChild(svgEl('path', { d: `M${pts.join(' L')}`, class: 'chart-line', stroke: s.color, fill: 'none' }));
    });

    // Tooltip
    const cursor = svgEl('line', { y1: padT, y2: h - padB, class: 'chart-cursor', visibility: 'hidden' });
    svg.appendChild(cursor);
    const dots = series.map(s => {
      const d = svgEl('circle', { r: 4, fill: s.color, class: 'chart-dot', visibility: 'hidden' });
      svg.appendChild(d);
      return d;
    });
    const tip = U.el('div', { class: 'chart-tip', hidden: true });
    wrap.appendChild(tip);

    const nearest = (pts, t) => pts.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), pts[0]);
    const move = (evt) => {
      const rect = svg.getBoundingClientRect();
      const px = ((evt.clientX - rect.left) / rect.width) * w;
      const t = tMin + ((px - padL) / (w - padL - padR)) * (tMax - tMin);
      const lines = [];
      let anchorX = 0;
      series.forEach((s, i) => {
        if (!s.points.length) return;
        const p = nearest(s.points, t);
        anchorX = x(p.t);
        dots[i].setAttribute('cx', anchorX);
        dots[i].setAttribute('cy', y(p.v));
        dots[i].setAttribute('visibility', 'visible');
        lines.push({ name: s.name, v: p.v, t: p.t, color: s.color });
      });
      cursor.setAttribute('x1', anchorX);
      cursor.setAttribute('x2', anchorX);
      cursor.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.replaceChildren(
        U.el('div', { class: 'chart-tip-date', text: new Date(lines[0].t).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }),
        ...lines.map(l => U.el('div', null, U.el('span', { class: 'chart-swatch', style: { background: l.color } }), `${l.name}: `, U.el('strong', { text: opts.format ? opts.format(l.v) : U.fmtNumber(l.v, 2) }))));
      const leftPct = (anchorX / w) * 100;
      tip.style.left = `${Math.min(Math.max(leftPct, 18), 82)}%`;
    };
    const hide = () => {
      tip.hidden = true;
      cursor.setAttribute('visibility', 'hidden');
      dots.forEach(d => d.setAttribute('visibility', 'hidden'));
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', hide);
    return wrap;
  }

  /**
   * Barras horizontales: [{ label, value, color?, sub? }]
   */
  function barList(items, opts = {}) {
    const max = Math.max(...items.map(i => i.value), 0) || 1;
    return U.el('div', { class: 'bar-list' }, items.map(it =>
      U.el('div', { class: 'bar-row' },
        U.el('div', { class: 'bar-head' },
          U.el('span', { class: 'bar-label', text: it.label }),
          U.el('span', { class: 'bar-value', text: opts.format ? opts.format(it.value) : String(it.value) })),
        U.el('div', { class: 'bar-track' },
          U.el('div', { class: 'bar-fill', style: { width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color || 'var(--accent)' } })),
        it.sub ? U.el('span', { class: 'bar-sub', text: it.sub }) : null)));
  }

  root.YarbisCharts = { sparkline, lineChart, barList };
})(typeof window !== 'undefined' ? window : globalThis);
