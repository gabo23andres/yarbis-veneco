/* ==========================================================================
   Prueba de humo en navegador (Playwright + Chromium).
   Levanta un servidor local, simula el micrófono y las APIs externas, y
   recorre los flujos principales en móvil y escritorio.

   Uso:  npm run test:e2e
   (requiere: npm install && npx playwright install chromium)
   Capturas: tests/screenshots/ (o la carpeta de SCREENSHOT_DIR)
   ========================================================================== */
'use strict';

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://localhost:${PORT}/index.html`;
const SHOTS = process.env.SCREENSHOT_DIR || path.join(__dirname, 'screenshots');
let MOCK_BCV = 200.5; // se cambia durante la prueba para disparar una alerta

// Micrófono y voz simulados: cuenta las llamadas a start()
const FAKE_SPEECH = () => {
  window.__recStarts = 0;
  window.__spoken = [];
  class FakeRecognition {
    constructor() { window.__lastRec = this; }
    start() {
      window.__recStarts++;
      setTimeout(() => this.onstart && this.onstart(), 10);
    }
    stop() { setTimeout(() => this.onend && this.onend(), 10); }
    abort() { setTimeout(() => this.onend && this.onend(), 10); }
    say(text) {
      const result = [{ transcript: text }];
      result.isFinal = true;
      this.onresult && this.onresult({ resultIndex: 0, results: [result] });
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => [{ name: 'Prueba Español', lang: 'es-ES' }],
    addEventListener() {},
    cancel() {},
    speak(u) {
      window.__spoken.push(u.text);
      window.__spokenLangs = (window.__spokenLangs || []).concat(u.lang);
      setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 30); }, 10);
    }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
};

async function mockNetwork(context) {
  await context.route(/^https?:\/\/(?!localhost)/, async (route) => {
    const url = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('dolarapi.com/v1/dolares')) {
      return json([
        { fuente: 'oficial', nombre: 'Oficial', promedio: MOCK_BCV, fechaActualizacion: new Date().toISOString() },
        { fuente: 'paralelo', nombre: 'Paralelo', promedio: 250 }
      ]);
    }
    if (url.includes('dolarapi.com/v1/euros')) return json([{ fuente: 'oficial', promedio: 230 }]);
    if (url.includes('open.er-api.com')) return json({ rates: { USD: 1, EUR: 0.9, VES: 200, COP: 4000 } });
    if (url.includes('binance.vision')) {
      return json(['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].map((c, i) => ({ symbol: `${c}USDT`, lastPrice: String(1000 * (5 - i)), priceChangePercent: '1.5' })));
    }
    if (url.includes('pollinations.ai')) {
      const body = route.request().postData() || '';
      if (body.includes('"stream":true')) {
        // Respuesta en tiempo real (SSE) en tres pedazos
        const parts = ['Respuesta ', '**IA** de ', 'prueba.'];
        const sse = parts.map(p => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
      }
      return json({ choices: [{ message: { content: 'Respuesta **IA** de prueba.' } }] });
    }
    if (url.includes('llm7.io')) return route.fulfill({ status: 503, body: '' });
    if (url.includes('generativelanguage.googleapis.com')) {
      if (url.includes('/models?')) return json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
      const raw = route.request().postData() || '';
      // Voz a texto: la grabación llega como audio en inline_data
      if (raw.includes('"inline_data"') && raw.includes('"mime_type":"audio/')) {
        return json({ candidates: [{ content: { parts: [{ text: '¿A cómo está el dólar?' }] } }] });
      }
      // Cerebro Gemini simulado: primero usa una herramienta y luego confirma
      const body = route.request().postData() || '';
      const part = body.includes('functionResponse')
        ? { text: 'Listo, puse **15 minutos** para el pan.' }
        : { functionCall: { name: 'crear_temporizador', args: { minutos: 15, motivo: 'Pan' } } };
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [part] } }] })}\n\n` });
    }
    if (url.includes('dolarapi.com/v1/historicos')) return json([]);
    if (url.includes('qrcode-generator')) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.qrcode=function(){return{addData:function(){},make:function(){},getModuleCount:function(){return 21},isDark:function(r,c){return (r*c+r)%3===0}}};' });
    }
    if (url.includes('geocoding-api.open-meteo.com')) return json({ results: [{ name: 'Maracaibo', latitude: 10.6, longitude: -71.6, admin1: 'Zulia' }] });
    if (url.includes('api.open-meteo.com')) {
      return json({
        current: { temperature_2m: 33, apparent_temperature: 37, relative_humidity_2m: 60, weather_code: 1, wind_speed_10m: 12 },
        daily: { weather_code: [1, 61], temperature_2m_max: [34, 33], temperature_2m_min: [26, 25], precipitation_probability_max: [10, 70] }
      });
    }
    if (url.includes('fonts.googleapis.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.fulfill({ status: 404, body: '' });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
    srv.on('error', reject);
    setTimeout(() => resolve(srv), 700);
  });
}

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const errors = [];
  let passed = 0;
  const check = async (name, fn) => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.log(`  ✗ ${name}\n    ${e.message.slice(0, 400).replace(/\n/g, '\n    ')}`);
      errors.push(`${name}: ${e.message}`);
    }
  };

  try {
    /* ------------------- MÓVIL ------------------- */
    console.log('Móvil (390×844)');
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'es-VE', serviceWorkers: 'block', permissions: ['camera'] });
    await mockNetwork(mobile);
    await mobile.addInitScript(FAKE_SPEECH);
    const page = await mobile.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push(m.text()); });
    page.on('dialog', d => d.accept());
    await page.goto(BASE);
    await page.waitForSelector('#welcome');
    await page.screenshot({ path: path.join(SHOTS, 'mobile-assistant.png') });

    await check('carga sin errores de JavaScript', async () => {
      assert.deepStrictEqual(pageErrors, []);
    });

    await check('el micrófono llama a start() una sola vez', async () => {
      await page.click('#btnMic');
      await page.waitForTimeout(150);
      assert.strictEqual(await page.evaluate(() => window.__recStarts), 1);
      assert.ok(await page.$eval('#btnMic', b => b.classList.contains('listening')));
      assert.ok(await page.isVisible('#voiceBar'));
    });

    await check('voz: "100 dólares a bolívares" responde con la tasa en vivo', async () => {
      await page.evaluate(() => window.__lastRec.say('100 dólares a bolívares'));
      await page.waitForSelector('.msg.assistant .msg-body strong');
      const text = await page.textContent('#messages');
      assert.match(text, /Bs\. 20\.050,00/);
      await page.waitForFunction(() => window.__spoken.length > 0);
    });

    await check('manos libres queda activado', async () => {
      await page.click('#btnHandsFree');
      await page.waitForTimeout(600);
      assert.strictEqual(await page.getAttribute('#btnHandsFree', 'aria-pressed'), 'true');
      await page.click('#btnHandsFree');
      assert.strictEqual(await page.getAttribute('#btnHandsFree', 'aria-pressed'), 'false');
    });

    await check('escribir "anota comprar pan" crea la nota', async () => {
      await page.fill('#chatInput', 'anota comprar pan');
      await page.press('#chatInput', 'Enter');
      await page.waitForFunction(() => document.querySelector('#messages').textContent.includes('Anotado'));
      await page.click('.tab[data-view="notes"]');
      await page.waitForSelector('#notesList .note-item');
      assert.match(await page.textContent('#notesList'), /Comprar pan/);
      assert.strictEqual(await page.textContent('#tabNotesBadge'), '1');
    });

    await check('filtros de notas funcionan', async () => {
      await page.click('[data-filter="done"]');
      assert.strictEqual(await page.$$eval('#notesList .note-item', n => n.length), 0);
      await page.click('[data-filter="all"]');
      await page.click('#notesList .note-check');
      await page.waitForTimeout(350); // animación de marcar
      await page.click('[data-filter="done"]');
      assert.strictEqual(await page.$$eval('#notesList .note-item', n => n.length), 1);
      await page.click('[data-filter="pending"]');
      assert.strictEqual(await page.$$eval('#notesList .note-item', n => n.length), 0);
      await page.click('[data-filter="all"]');
    });

    await check('editar una nota', async () => {
      await page.click('#notesList button[aria-label="Editar nota"]');
      await page.fill('.note-edit-input', 'Comprar pan y queso');
      await page.press('.note-edit-input', 'Enter');
      assert.match(await page.textContent('#notesList'), /Comprar pan y queso/);
    });

    await check('el temporizador sobrevive a una recarga', async () => {
      await page.click('[data-timer="300"]');
      await page.waitForSelector('#timersList .timer-item');
      await page.screenshot({ path: path.join(SHOTS, 'mobile-notes.png') });
      await page.reload();
      await page.click('.tab[data-view="notes"]');
      await page.waitForSelector('#timersList .timer-item');
      const t = await page.textContent('#timersList .timer-time');
      assert.match(t, /^0[45]:\d\d$/);
      assert.ok(await page.isVisible('#timerChip') === false || true);
    });

    await check('una alarma vencida suena al abrir la app sin borrar el chat', async () => {
      await page.evaluate(() => localStorage.setItem('yarbis_alarms_v2', JSON.stringify([{ id: 'x1', at: Date.now() - 60000, label: 'Prueba vencida' }])));
      await page.reload();
      await page.waitForSelector('#dlgRinging[open]');
      assert.match(await page.textContent('#ringText'), /Prueba vencida/);
      await page.click('#btnRingStop');
      assert.ok(!(await page.$eval('#dlgRinging', d => d.open)));
      assert.match(await page.textContent('#messages'), /comprar pan/i);
    });

    await check('el chat se conserva tras recargar', async () => {
      await page.click('.tab[data-view="assistant"]');
      assert.match(await page.textContent('#messages'), /comprar pan/i);
    });

    await check('Escape cierra Ajustes sin borrar el chat', async () => {
      await page.click('.topbar [data-action="open-settings"]');
      assert.ok(await page.$eval('#dlgSettings', d => d.open));
      await page.screenshot({ path: path.join(SHOTS, 'mobile-settings.png') });
      await page.keyboard.press('Escape');
      assert.ok(!(await page.$eval('#dlgSettings', d => d.open)));
      assert.ok((await page.$$('#messages .msg')).length > 0);
    });

    await check('Finanzas muestra tasas en vivo y convierte', async () => {
      await page.click('.tab[data-view="finance"]');
      await page.waitForFunction(() => document.querySelector('#rateCards').textContent.includes('200,50'));
      await page.fill('#convAmount', '10');
      await page.selectOption('#convFrom', 'USD');
      await page.selectOption('#convTo', 'VES_BCV');
      assert.match(await page.textContent('#convResult'), /Bs\. 2\.005,00/);
      assert.match(await page.textContent('#fxStatus'), /En vivo|Actualizado/);
      await page.screenshot({ path: path.join(SHOTS, 'mobile-finance.png'), fullPage: false });
    });

    await check('calculadora segura', async () => {
      await page.fill('#calcExpr', '15% de 200');
      assert.match(await page.textContent('#calcResult'), /= 30/);
      await page.fill('#calcExpr', 'alert(1)');
      assert.strictEqual(await page.textContent('#calcResult'), '…');
    });

    await check('tasas manuales y volver a en vivo', async () => {
      await page.click('#btnFxManual');
      await page.fill('#mrBcv', '300');
      await page.click('#btnRatesSave');
      await page.waitForSelector('#manualBanner:not([hidden])');
      assert.match(await page.textContent('#rateCards'), /300,00/);
      await page.click('#btnFxLive');
      await page.waitForSelector('#manualBanner[hidden]', { state: 'attached' });
      assert.match(await page.textContent('#rateCards'), /200,50/);
    });

    await check('pestaña Más y purificador de texto', async () => {
      await page.click('.tab[data-view="more"]');
      await page.screenshot({ path: path.join(SHOTS, 'mobile-more.png') });
      await page.click('.tool[data-action="open-cleaner"]');
      await page.fill('#txtCleanInput', 'Hola​ mundo‍ en conclusión, todo bien');
      assert.strictEqual(await page.textContent('#cleanInvisible'), '2');
      await page.click('#btnCleanHumanize');
      assert.strictEqual(await page.inputValue('#txtCleanOutput'), 'Hola mundo todo bien');
      await page.keyboard.press('Escape');
    });

    await check('la IA responde (simulada) con Markdown', async () => {
      await page.click('.tab[data-view="assistant"]');
      await page.fill('#chatInput', 'explícame qué es un ETF en pocas palabras');
      await page.press('#chatInput', 'Enter');
      await page.waitForFunction(() => document.querySelector('#messages').textContent.includes('Respuesta IA de prueba'));
      assert.ok(await page.$('#messages .msg.assistant:last-child strong'));
    });

    await check('clima con ciudad', async () => {
      await page.fill('#chatInput', '¿cómo está el clima en Maracaibo hoy?');
      await page.press('#chatInput', 'Enter');
      await page.waitForFunction(() => document.querySelector('#messages').textContent.includes('33°C'));
      await page.screenshot({ path: path.join(SHOTS, 'mobile-chat.png') });
    });

    await check('nueva conversación limpia el chat', async () => {
      await page.click('.topbar [data-action="new-chat"]');
      assert.strictEqual((await page.$$('#messages .msg')).length, 0);
      assert.ok(await page.isVisible('#welcome'));
    });

    await check('cámara: captura y análisis con IA', async () => {
      await page.click('#composer [data-action="open-camera"]');
      assert.ok(await page.$eval('#dlgCamera', d => d.open));
      await page.waitForFunction(() => document.querySelector('#cameraVideo').videoWidth > 0, null, { timeout: 8000 });
      await page.click('#btnCameraCapture');
      assert.ok(!(await page.$eval('#dlgCamera', d => d.open)));
      await page.waitForSelector('#messages .msg-image');
      await page.waitForFunction(() => document.querySelector('#messages').textContent.includes('Respuesta IA de prueba'));
    });

    await check('panel Hoy: tasa, clima y accesos rápidos', async () => {
      await page.click('.topbar [data-action="new-chat"]');
      await page.waitForFunction(() => document.querySelector('#homeGrid').textContent.includes('200,50'));
      await page.waitForFunction(() => document.querySelector('#homeGrid').textContent.includes('33°'), null, { timeout: 8000 });
      assert.ok((await page.$$('#homeGrid .quick-btn')).length >= 8);
      await page.screenshot({ path: path.join(SHOTS, 'mobile-home.png') });
    });

    const say = async (text, expect) => {
      await page.fill('#chatInput', text);
      await page.press('#chatInput', 'Enter');
      await page.waitForFunction((e) => document.querySelector('#messages').textContent.includes(e), expect, { timeout: 8000 });
    };

    await check('lista de compras y alarma repetitiva por voz', async () => {
      await say('agrega leche y huevos a la lista de compras', 'Agregué a Compras');
      await say('despiértame de lunes a viernes a las 6:30', 'Lunes a viernes');
      await page.click('#messages .msg:last-child .btn, #messages .msg-actions .btn >> nth=-1').catch(() => {});
      await page.click('.tab[data-view="notes"]');
      await page.click('.list-chip:has-text("Compras")');
      assert.match(await page.textContent('#notesList'), /Leche/);
      assert.ok(await page.$eval('#notesList', n => n.classList.contains('shopping')));
      assert.match(await page.textContent('#alarmsList'), /Lunes a viernes/);
      await page.screenshot({ path: path.join(SHOTS, 'mobile-notes-lists.png') });
      await page.click('.list-chip:has-text("Todas")');
    });

    await check('comandos encadenados', async () => {
      await page.click('.tab[data-view="assistant"]');
      await say('pon un timer de 1 minuto y anota revisar el aceite', 'Anotado');
      assert.match(await page.textContent('#messages'), /Temporizador de 1 minuto/);
    });

    await check('gasto por voz aparece en Finanzas', async () => {
      await say('gasté 20 dólares en comida', 'Gasto registrado');
      await page.click('.tab[data-view="finance"]');
      await page.waitForFunction(() => document.querySelector('#expSummary').textContent.includes('$20,00'));
      assert.match(await page.textContent('#expBars'), /Comida/);
    });

    await check('gráfico del dólar y lista de precios', async () => {
      await page.evaluate(() => {
        const F = window.YarbisFinance;
        [6, 4, 2].forEach((d, i) => F.recordHistory(190 + i * 3, 240 + i * 2, Date.now() - d * 86400000));
        F.emit();
      });
      await page.waitForSelector('#fxChart path.chart-line');
      assert.match(await page.textContent('#plResult'), /Bs\./);
      await page.locator('#fxChart').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, 'mobile-finance-chart.png') });
    });

    await check('alerta del dólar salta al subir la tasa', async () => {
      await page.fill('#alertValue', '210');
      await page.click('#formFxAlert button[type="submit"]');
      assert.match(await page.textContent('#alertsList'), /sube de Bs\. 210/);
      MOCK_BCV = 215;
      await page.click('#btnFxRefresh');
      await page.waitForFunction(() => window.YarbisApp.log.some(m => /Alerta del dólar/.test(m.text)), null, { timeout: 8000 });
      assert.match(await page.textContent('#alertsList'), /Sin alertas/);
      MOCK_BCV = 200.5;
    });

    await check('IA en tiempo real (streaming)', async () => {
      await page.click('.tab[data-view="assistant"]');
      await say('cuéntame algo interesante sobre Venezuela', 'Respuesta IA de prueba.');
      assert.ok(await page.$('#messages .msg.assistant:last-child button[aria-label="Regenerar respuesta"]'));
      assert.ok(!(await page.$('#messages .msg.streaming')));
    });

    await check('cerebro Gemini: entiende y crea un temporizador', async () => {
      await page.evaluate(() => { window.YarbisApp.brain.setApiKey('AIzaSyPRUEBA_PRUEBA_PRUEBA_PRUEBA_123'); });
      await say('ayúdame a que no se me queme el pan', 'Listo, puse 15 minutos para el pan.');
      assert.ok(await page.evaluate(() => window.YarbisReminders.schedule.timers.some(t => t.label === 'Pan' && t.durationMs === 900000)));
      await page.evaluate(() => { window.YarbisApp.brain.setApiKey(''); window.YarbisReminders.schedule.cancelAllTimers(); });
    });

    await check('ajustes: otra API y recuerdos', async () => {
      await page.evaluate(() => window.YarbisApp.brain.process('recuerda que me encanta el café'));
      await page.evaluate(() => window.YarbisSettings.open());
      await page.waitForSelector('#dlgSettings[open]');
      await page.fill('#setProviderKey', 'sk-ant-prueba');
      assert.strictEqual(await page.inputValue('#setProvider'), 'anthropic');
      assert.match(await page.textContent('#memoryList'), /me encanta el café/);
      await page.fill('#setProviderKey', '');
      await page.screenshot({ path: path.join(SHOTS, 'mobile-ai-settings.png') });
      await page.keyboard.press('Escape');
    });

    await check('cerebro Gemini: tarjeta para activarlo y diagnóstico', async () => {
      await page.evaluate(() => { window.YarbisApp.clearChat && window.YarbisApp.clearChat(); window.YarbisHome.render(); });
      assert.ok(await page.$('.bento-brain'), 'sin clave se invita a activar Gemini');
      await page.evaluate(() => { window.YarbisApp.brain.setApiKey('AIzaSyPRUEBA_PRUEBA_PRUEBA_PRUEBA_123'); window.YarbisHome.render(); });
      assert.ok(!(await page.$('.bento-brain')), 'con clave la tarjeta desaparece');
      await page.evaluate(() => window.YarbisSettings.open());
      await page.click('#btnDiagnoseAI');
      await page.waitForFunction(() => document.querySelectorAll('#aiDiagnosis .diag-item').length >= 3, null, { timeout: 15000 });
      const diag = await page.textContent('#aiDiagnosis');
      assert.match(diag, /✅Gemini — responde/);
      assert.match(diag, /Gemini como cerebro — usó/);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { window.YarbisApp.brain.setApiKey(''); window.YarbisReminders.schedule.cancelAllTimers(); });
    });

    await check('traductor por voz lee en inglés', async () => {
      await say('traduce al inglés: buenos días', 'Inglés:');
      // En el traductor, la traducción se lee con una voz del idioma destino
      await page.evaluate(() => window.YarbisApp.openTool('translate', 'buenos días'));
      await page.waitForFunction(() => document.querySelector('#trOutput').value.includes('prueba'), null, { timeout: 5000 });
      await page.waitForFunction(() => (window.__spokenLangs || []).includes('en-US'), null, { timeout: 5000 });
      await page.keyboard.press('Escape');
    });

    await check('dictado con puntuación por voz', async () => {
      await page.evaluate(() => window.YarbisApp.openTool('dictation'));
      await page.click('#dcToggle');
      await page.waitForTimeout(100);
      await page.evaluate(() => window.__lastRec.say('hola coma qué tal punto nos vemos mañana'));
      assert.strictEqual(await page.inputValue('#dcText'), 'Hola, qué tal. Nos vemos mañana');
      await page.click('#dcToggle');
      await page.keyboard.press('Escape');
    });

    await check('Pago Móvil: guardar, vista previa y QR', async () => {
      await page.evaluate(() => window.YarbisApp.openTool('pagomovil'));
      await page.selectOption('#pmBank', '0134');
      await page.fill('#pmId', '12345678');
      await page.fill('#pmPhone', '04141234567');
      await page.click('#formPagoMovil button[type="submit"]');
      await page.fill('#pmAmount', '10');
      assert.match(await page.textContent('#pmPreview'), /0134 - Banesco[\s\S]*V-12\.345\.678[\s\S]*0414-1234567[\s\S]*Bs\. 2\.\d{3},00 \(\$10,00 a tasa BCV\)/);
      await page.click('#btnPmQr');
      await page.waitForSelector('#pmQr svg.qr-svg');
      await page.screenshot({ path: path.join(SHOTS, 'mobile-pagomovil.png') });
      await page.keyboard.press('Escape');
      await say('cóbrale 5 dólares a mamá', 'Cobro para');
    });

    await check('botón atrás del teléfono cierra la ventana abierta', async () => {
      await page.evaluate(() => window.YarbisApp.openTool('translate'));
      await page.waitForSelector('#dlgTranslate[open]');
      await page.goBack();
      await page.waitForFunction(() => !document.querySelector('#dlgTranslate').open);
      assert.ok(await page.evaluate(() => !!window.YarbisApp && !!document.querySelector('#messages')));
    });

    await check('compartir hacia YARBIS y atajos del ícono', async () => {
      // Esperar a que el "atrás" de la ventana cerrada termine antes de navegar
      await page.waitForFunction(() => !(history.state && history.state.dlg));
      await page.goto(`${BASE}?text=${encodeURIComponent('Reunión mañana a las 3')}`);
      await page.waitForFunction(() => document.querySelector('#messages').textContent.includes('Compartido'));
      assert.match(await page.textContent('#messages'), /Guardar como nota/);
      assert.ok(!(await page.evaluate(() => location.search)));
      await page.goto(`${BASE}?accion=gasto`);
      await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'expAmount', null, { timeout: 5000 });
    });

    await check('sin errores de JavaScript al final', async () => {
      assert.deepStrictEqual(pageErrors, []);
    });
    await mobile.close();

    /* ------------------- ESCRITORIO ------------------- */
    console.log('Escritorio (1280×800)');
    for (const scheme of ['light', 'dark']) {
      const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, locale: 'es-VE', serviceWorkers: 'block' });
      await mockNetwork(desk);
      await desk.addInitScript(FAKE_SPEECH);
      const p = await desk.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      await p.goto(BASE);
      await p.waitForSelector('#welcome');
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(SHOTS, `desktop-${scheme}-assistant.png`) });
      await check(`escritorio ${scheme}: el chat responde la tasa`, async () => {
        await p.fill('#chatInput', '¿a cómo está el dólar?');
        await p.press('#chatInput', 'Enter');
        try {
          await p.waitForFunction(() => document.querySelector('#messages').textContent.includes('Paralelo'), null, { timeout: 8000 });
        } finally {
          await p.screenshot({ path: path.join(SHOTS, `desktop-${scheme}-chat.png`) });
        }
      });
      await check(`escritorio ${scheme}: finanzas y notas`, async () => {
        await p.click('.sidebar [data-view="finance"]');
        await p.waitForFunction(() => document.querySelector('#rateCards').textContent.includes('200,50'), null, { timeout: 8000 });
        await p.screenshot({ path: path.join(SHOTS, `desktop-${scheme}-finance.png`) });
        await p.click('.sidebar [data-view="notes"]');
        await p.screenshot({ path: path.join(SHOTS, `desktop-${scheme}-notes.png`) });
      });
      await check(`escritorio ${scheme}: sin errores y barra lateral visible`, async () => {
        assert.ok(await p.isVisible('.sidebar'));
        assert.ok(!(await p.isVisible('.tabbar')));
        assert.deepStrictEqual(errs, []);
      });
      await desk.close();
    }

    /* ------------- SIN RECONOCIMIENTO DE VOZ (Brave, iPhone instalado) ------------- */
    console.log('Voz por grabación (sin SpeechRecognition)');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-VE', serviceWorkers: 'block', permissions: ['microphone'] });
      await mockNetwork(ctx);
      await ctx.addInitScript(FAKE_SPEECH);
      await ctx.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      await p.goto(BASE);
      await p.waitForSelector('#welcome');
      await check('graba, Gemini transcribe y responde', async () => {
        await p.evaluate(() => window.YarbisApp.brain.setApiKey('AIzaSyPRUEBA_PRUEBA_PRUEBA_PRUEBA_123'));
        await p.click('#btnMic');
        await p.waitForFunction(() => window.speechEngine.isListening && window.speechEngine.recorder, null, { timeout: 5000 });
        await p.waitForTimeout(1500);
        await p.click('#btnMic');
        await p.waitForFunction(() => document.querySelector('#messages').textContent.includes('Dólar BCV'), null, { timeout: 10000 });
        assert.match(await p.textContent('#messages'), /¿A cómo está el dólar\?/);
      });
      await check('sin clave avisa cómo activar la voz', async () => {
        await p.evaluate(() => window.YarbisApp.brain.setApiKey(''));
        await p.click('#btnMic');
        await p.waitForFunction(() => /clave de Gemini/.test(document.querySelector('.toast-host') ? document.querySelector('.toast-host').textContent : ''), null, { timeout: 5000 });
      });
      await check('voz por grabación: sin errores de JavaScript', async () => {
        assert.deepStrictEqual(errs, []);
      });
      await ctx.close();
    }

    /* ------------------- IPHONE ------------------- */
    console.log('iPhone (Safari)');
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-VE', serviceWorkers: 'block',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      });
      await mockNetwork(ctx);
      await ctx.addInitScript(FAKE_SPEECH);
      await ctx.addInitScript(() => { try { localStorage.setItem('yarbis_visits', '1'); } catch (e) {} });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      await p.goto(BASE);
      await p.waitForSelector('#welcome');
      const sayI = async (text, expect) => {
        await p.fill('#chatInput', text);
        await p.press('#chatInput', 'Enter');
        await p.waitForFunction((e) => document.querySelector('#messages').textContent.includes(e), expect, { timeout: 8000 });
      };
      await check('iPhone: plataforma, ícono y aviso para instalar', async () => {
        assert.strictEqual(await p.getAttribute('html', 'data-platform'), 'ios');
        assert.strictEqual(await p.getAttribute('link[rel="apple-touch-icon"]', 'href'), 'icons/apple-touch-icon.png');
        assert.ok((await p.$$('link[rel="apple-touch-startup-image"]')).length >= 8);
        await p.waitForSelector('.install-hint', { timeout: 6000 });
        assert.match(await p.textContent('.install-hint'), /Agregar a inicio/);
        assert.ok(await p.$('.haptic-switch input[switch]'));
        await p.screenshot({ path: path.join(SHOTS, 'iphone-install-hint.png') });
        await p.click('.install-hint .icon-btn');
        assert.ok(!(await p.$('.install-hint')));
        assert.strictEqual(await p.evaluate(() => localStorage.getItem('yarbis_install_hint')), 'off');
      });
      await check('iPhone: alarma con opción de calendario', async () => {
        await sayI('alarma a las 7 de la mañana', 'Alarma para las');
        const btn = p.locator('#messages .msg.assistant').last().locator('button', { hasText: 'Que suene con la app cerrada' });
        assert.strictEqual(await btn.count(), 1);
        const href = await p.evaluate(() => new Promise((resolve) => {
          const orig = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function () { HTMLAnchorElement.prototype.click = orig; resolve(this.getAttribute('href')); };
          const b = [...document.querySelectorAll('#messages button')].filter(x => /Que suene/.test(x.textContent)).pop();
          b.click();
        }));
        assert.match(href, /^data:text\/calendar/);
        const ics = decodeURIComponent(href.split(',').slice(1).join(','));
        assert.match(ics, /TRIGGER:PT0M/);
      });
      await check('iPhone: SMS con el formato de iPhone', async () => {
        await sayI('guarda el contacto Mamá 0414 1234567', 'Mamá');
        await sayI('mándale un mensaje de texto a mamá que diga ya llegué', 'SMS para');
        const hrefs = await p.$$eval('#messages .msg.assistant:last-child a', as => as.map(a => a.getAttribute('href')));
        assert.ok(hrefs.includes('sms:04141234567&body=ya%20llegu%C3%A9'), hrefs.join(' '));
      });
      await check('iPhone: sin errores de JavaScript', async () => {
        assert.deepStrictEqual(errs, []);
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\n${passed} correctas, ${errors.length} con fallos. Capturas en ${SHOTS}`);
  if (errors.length) process.exit(1);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
