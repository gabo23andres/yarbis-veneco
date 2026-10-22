/* ==========================================================================
   YARBIS - UTILIDADES COMPARTIDAS
   Almacenamiento seguro, construcción de DOM, normalización de texto,
   formato de números, Markdown seguro y avisos (toasts).
   ========================================================================== */

(function (root) {
  'use strict';

  /* ------------------------------------------
     ALMACENAMIENTO (nunca lanza excepciones)
     ------------------------------------------ */
  const storage = {
    get(key, fallback = null) {
      try {
        const raw = root.localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        root.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    getRaw(key, fallback = '') {
      try {
        const raw = root.localStorage.getItem(key);
        return raw === null || raw === undefined ? fallback : raw;
      } catch (e) {
        return fallback;
      }
    },
    setRaw(key, value) {
      try {
        root.localStorage.setItem(key, String(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        root.localStorage.removeItem(key);
      } catch (e) { /* sin acceso a storage */ }
    },
    keys() {
      try {
        const out = [];
        for (let i = 0; i < root.localStorage.length; i++) out.push(root.localStorage.key(i));
        return out;
      } catch (e) {
        return [];
      }
    }
  };

  /* ------------------------------------------
     TEXTO
     ------------------------------------------ */
  // Minúsculas, sin acentos (ñ -> n), sin signos de puntuación.
  // Conserva dígitos, decimales, horas (7:30) y operadores matemáticos.
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[¿?¡!,;"“”«»()[\]{}]/g, ' ')
      .replace(/'/g, '')
      .replace(/\.(?!\d)/g, ' ')
      .replace(/:(?!\d)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function capitalize(text) {
    const s = String(text || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const SAFE_URL = /^(https?:|tel:|sms:|mailto:|whatsapp:|whatsapp-business:)/i;
  function isSafeUrl(url) {
    return SAFE_URL.test(String(url || '').trim());
  }

  /* ------------------------------------------
     NÚMEROS Y FECHAS
     ------------------------------------------ */
  function fmtNumber(value, decimals = 2, minDecimals) {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('es-VE', {
      minimumFractionDigits: minDecimals === undefined ? decimals : minDecimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtBs(value) {
    return `Bs. ${fmtNumber(value, 2)}`;
  }

  function fmtUsd(value) {
    const n = Number(value);
    if (isFinite(n) && Math.abs(n) > 0 && Math.abs(n) < 1) return `$${fmtNumber(n, 4, 2)}`;
    return `$${fmtNumber(n, 2)}`;
  }

  function fmtCrypto(value) {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    if (n === 0) return '0';
    if (Math.abs(n) < 0.0001) return n.toExponential(3);
    return fmtNumber(n, 8, 0);
  }

  function fmtTime(date) {
    return new Date(date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDateTime(date) {
    const d = new Date(date);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const yesterday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
    if (sameDay) return `Hoy, ${fmtTime(d)}`;
    if (yesterday) return `Ayer, ${fmtTime(d)}`;
    return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) + `, ${fmtTime(d)}`;
  }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const min = Math.round(diff / 60000);
    if (min < 1) return 'hace instantes';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }

  function fmtDuration(totalSec) {
    const s = Math.max(0, Math.round(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  function describeDuration(totalSec) {
    const s = Math.round(totalSec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts = [];
    if (h) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
    if (m) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
    if (sec) parts.push(`${sec} ${sec === 1 ? 'segundo' : 'segundos'}`);
    if (parts.length === 0) return '0 segundos';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }

  // "1.234,56" / "1,234.56" / "12,5" / "12.5" -> número (o null)
  function parseNumber(raw) {
    let t = String(raw === undefined || raw === null ? '' : raw).trim().replace(/\s|\$|€|bs\.?/gi, '');
    if (!t) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    else t = t.replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(t)) return null;
    const n = parseFloat(t);
    return isFinite(n) ? n : null;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------
     DOM
     ------------------------------------------ */
  // el('button', { class: 'x', onClick: fn, dataset: { a: 1 } }, 'texto', otroNodo)
  function el(tag, attrs, ...children) {
    const node = root.document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key === 'href') {
          if (isSafeUrl(value) || String(value).startsWith('#')) node.setAttribute('href', value);
        } else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' || typeof child === 'number'
        ? root.document.createTextNode(String(child))
        : child);
    }
    return node;
  }

  // Ícono del sprite SVG definido en index.html
  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = root.document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = root.document.createElementNS(NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.appendChild(use);
    return svg;
  }

  function $(selector, scope) {
    return (scope || root.document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.from((scope || root.document).querySelectorAll(selector));
  }

  /* ------------------------------------------
     MARKDOWN SEGURO
     Primero se escapa todo; luego sólo se agregan etiquetas propias.
     ------------------------------------------ */
  function renderInline(escaped) {
    let s = escaped;
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, code) => {
      codes.push(code);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const decoded = url.replace(/&amp;/g, '&');
      if (!isSafeUrl(decoded)) return label;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (m, pre, url) =>
      `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
    return s;
  }

  function renderTable(rows) {
    const cells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
    const header = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    let html = '<div class="md-table-wrap"><table><thead><tr>';
    header.forEach(h => { html += `<th>${renderInline(h)}</th>`; });
    html += '</tr></thead><tbody>';
    body.forEach(r => {
      html += '<tr>' + r.map(c => `<td>${renderInline(c)}</td>`).join('') + '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function renderMarkdown(text) {
    const escaped = escapeHtml(String(text || '').replace(/\r\n/g, '\n'));
    const parts = escaped.split(/```/);
    let html = '';

    parts.forEach((part, idx) => {
      if (idx % 2 === 1) {
        const code = part.replace(/^[a-zA-Z0-9_-]*\n/, '');
        html += `<pre><code>${code.replace(/\n$/, '')}</code></pre>`;
        return;
      }

      const lines = part.split('\n');
      let i = 0;
      let paragraph = [];
      const flushParagraph = () => {
        if (paragraph.length) {
          html += `<p>${paragraph.map(renderInline).join('<br>')}</p>`;
          paragraph = [];
        }
      };

      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { flushParagraph(); i++; continue; }

        const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          flushParagraph();
          const level = Math.min(heading[1].length + 2, 6);
          html += `<h${level}>${renderInline(heading[2])}</h${level}>`;
          i++;
          continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flushParagraph(); html += '<hr>'; i++; continue; }

        if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
          flushParagraph();
          const rows = [];
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++; }
          html += renderTable(rows);
          continue;
        }

        if (/^&gt;\s?/.test(trimmed)) {
          flushParagraph();
          const quote = [];
          while (i < lines.length && /^&gt;\s?/.test(lines[i].trim())) { quote.push(lines[i].trim().replace(/^&gt;\s?/, '')); i++; }
          html += `<blockquote>${quote.map(renderInline).join('<br>')}</blockquote>`;
          continue;
        }

        const ul = /^[-*•]\s+(.*)$/;
        const ol = /^(\d+)[.)]\s+(.*)$/;
        if (ul.test(trimmed) || ol.test(trimmed)) {
          flushParagraph();
          const ordered = ol.test(trimmed);
          const items = [];
          while (i < lines.length) {
            const t = lines[i].trim();
            const m = ordered ? t.match(ol) : t.match(ul);
            if (!m) break;
            items.push(ordered ? m[2] : m[1]);
            i++;
          }
          const tag = ordered ? 'ol' : 'ul';
          html += `<${tag}>${items.map(it => `<li>${renderInline(it)}</li>`).join('')}</${tag}>`;
          continue;
        }

        paragraph.push(trimmed);
        i++;
      }
      flushParagraph();
    });

    return html;
  }

  // Texto plano apto para voz: sin markdown, enlaces ni emojis.
  function toSpeech(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\|/g, ' ')
      .replace(/^\s*[-:| ]{3,}\s*$/gm, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/gi, 'enlace')
      .replace(/[*_~`#>]/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ------------------------------------------
     AVISOS (TOASTS)
     ------------------------------------------ */
  function toast(message, options = {}) {
    if (!root.document) return;
    let host = root.document.getElementById('toastHost');
    if (!host) {
      host = el('div', { id: 'toastHost', class: 'toast-host', 'aria-live': 'polite' });
      root.document.body.appendChild(host);
    }
    const node = el('div', { class: `toast toast-${options.type || 'info'}`, role: 'status' },
      el('span', { class: 'toast-text', text: message }));
    if (options.actionLabel && typeof options.onAction === 'function') {
      node.appendChild(el('button', {
        type: 'button',
        class: 'toast-action',
        text: options.actionLabel,
        onClick: () => { options.onAction(); node.remove(); }
      }));
    }
    host.appendChild(node);
    // Máximo dos avisos a la vez: el más viejo se va
    while (host.children.length > 2) host.firstElementChild.remove();
    const duration = options.duration || 3500;
    setTimeout(() => {
      node.classList.add('toast-out');
      setTimeout(() => node.remove(), 300);
    }, duration);
    return node;
  }

  async function copyText(text) {
    try {
      await root.navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
        ta.value = text;
        root.document.body.appendChild(ta);
        ta.select();
        const ok = root.document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (err) {
        return false;
      }
    }
  }

  // fetch con tiempo límite compatible con navegadores sin AbortSignal.timeout
  async function fetchWithTimeout(url, options = {}, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await root.fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  const Utils = {
    storage,
    normalize,
    escapeHtml,
    capitalize,
    isSafeUrl,
    fmtNumber,
    fmtBs,
    fmtUsd,
    fmtCrypto,
    fmtTime,
    fmtDateTime,
    fmtDuration,
    describeDuration,
    timeAgo,
    uid,
    parseNumber,
    el,
    icon,
    $,
    $$,
    renderMarkdown,
    toSpeech,
    toast,
    copyText,
    fetchWithTimeout
  };

  root.YarbisUtils = Utils;
  if (typeof module !== 'undefined' && module.exports) module.exports = Utils;
})(typeof window !== 'undefined' ? window : globalThis);
