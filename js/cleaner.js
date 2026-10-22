/* ==========================================================================
   YARBIS - PURIFICADOR DE TEXTO (ANTI-MARCAS IA)
   Elimina caracteres invisibles (ancho cero, BOM, controles bidi), normaliza
   espacios/comillas y, opcionalmente, suaviza muletillas típicas de IA.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;

  const ZERO_WIDTH = /[​-‏﻿⁠-⁤‪-‮⁦-⁩᠎­]/g;
  const ODD_SPACES = /[   -   　]/g;

  const AI_PHRASES = [
    { regex: /\b(en conclusión|a modo de conclusión|en resumen|para concluir),?\s*/gi, rep: '' },
    { regex: /\b(es crucial (destacar|entender|mencionar|señalar) que|cabe destacar que|vale la pena (mencionar|destacar) que)\s*/gi, rep: '' },
    { regex: /\b(en el panorama actual|en el mundo actual|en la era digital actual),?\s*/gi, rep: 'Hoy, ' },
    { regex: /\b(desempeña un papel crucial|juega un papel fundamental|juega un papel crucial)\b/gi, rep: 'es clave' },
    { regex: /\b(es importante tener en cuenta que|es importante señalar que|es importante destacar que)\s*/gi, rep: '' },
    { regex: /\b(sin lugar a dudas|indudablemente),?\s*/gi, rep: 'claramente, ' },
    { regex: /\b(adentrarnos en|sumergirnos en)\b/gi, rep: 'ver' },
    { regex: /\b(un amplio abanico de|una amplia gama de)\b/gi, rep: 'muchos' },
    { regex: /\b(in conclusion|in summary|it is important to note that|it's worth noting that),?\s*/gi, rep: '' },
    { regex: /\b(delve into|dive into)\b/gi, rep: 'look at' }
  ];

  function scan(text) {
    const s = String(text || '');
    const invisible = (s.match(ZERO_WIDTH) || []).length;
    const oddSpaces = (s.match(ODD_SPACES) || []).length;
    let phrases = 0;
    AI_PHRASES.forEach(p => {
      const m = s.match(p.regex);
      if (m) phrases += m.length;
    });
    return { invisible, oddSpaces, phrases };
  }

  function clean(text, options = {}) {
    const original = String(text || '');
    const stats = scan(original);
    let out = original.replace(ZERO_WIDTH, '').replace(ODD_SPACES, ' ');
    out = out
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/…/g, '...');

    if (options.humanize) {
      AI_PHRASES.forEach(p => { out = out.replace(p.regex, p.rep); });
      // Mayúscula al inicio de cada oración tras quitar muletillas
      out = out.replace(/(^|[.!?]\s+|\n\s*)([a-záéíóúñ])/g, (m, pre, ch) => pre + ch.toUpperCase());
    }

    out = out
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text: out, stats };
  }

  function mountUI() {
    const input = U.$('#txtCleanInput');
    const output = U.$('#txtCleanOutput');
    if (!input || !output) return;
    const vInvisible = U.$('#cleanInvisible');
    const vSpaces = U.$('#cleanSpaces');
    const vPhrases = U.$('#cleanPhrases');

    const update = () => {
      const st = scan(input.value);
      vInvisible.textContent = st.invisible;
      vSpaces.textContent = st.oddSpaces;
      vPhrases.textContent = st.phrases;
    };
    input.addEventListener('input', update);
    update();

    const run = (humanize) => {
      if (!input.value.trim()) { U.toast('Pega un texto primero.', { type: 'warn' }); return; }
      const res = clean(input.value, { humanize });
      output.value = res.text;
      const removed = res.stats.invisible + res.stats.oddSpaces;
      U.toast(humanize
        ? `Listo: ${removed} caracteres corregidos y redacción suavizada.`
        : `Listo: ${removed} caracteres invisibles o raros corregidos.`, { type: 'ok' });
    };

    U.$('#btnCleanSanitize').addEventListener('click', () => run(false));
    U.$('#btnCleanHumanize').addEventListener('click', () => run(true));
    U.$('#btnCleanCopy').addEventListener('click', async () => {
      if (!output.value) return;
      U.toast(await U.copyText(output.value) ? 'Texto copiado.' : 'No se pudo copiar.', { type: 'ok' });
    });
    U.$('#btnCleanSaveNote').addEventListener('click', () => {
      if (!output.value) return;
      root.YarbisReminders.notes.add(output.value);
      U.toast('Guardado en tus notas.', { type: 'ok' });
    });
  }

  root.YarbisCleaner = { clean, scan, mountUI };
})(typeof window !== 'undefined' ? window : globalThis);
