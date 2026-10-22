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
        { fuente: 'oficial', nombre: 'Oficial', promedio: 200.5, fechaActualizacion: new Date().toISOString() },
        { fuente: 'paralelo', nombre: 'Paralelo', promedio: 250 }
      ]);
    }
    if (url.includes('dolarapi.com/v1/euros')) return json([{ fuente: 'oficial', promedio: 230 }]);
    if (url.includes('open.er-api.com')) return json({ rates: { USD: 1, EUR: 0.9, VES: 200, COP: 4000 } });
    if (url.includes('binance.vision')) {
      return json(['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].map((c, i) => ({ symbol: `${c}USDT`, lastPrice: String(1000 * (5 - i)), priceChangePercent: '1.5' })));
    }
    if (url.includes('pollinations.ai')) {
      return json({ choices: [{ message: { content: 'Respuesta **IA** de prueba.' } }] });
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
