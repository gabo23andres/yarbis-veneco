// Carga los módulos del navegador en Node con un localStorage simulado.
'use strict';
const path = require('path');

function createStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; }
  };
}

function loadApp() {
  globalThis.window = globalThis;
  globalThis.localStorage = createStorage();
  const root = path.join(__dirname, '..', 'js');
  for (const file of ['utils.js', 'voiceRecorder.js', 'mathEngine.js', 'finance.js', 'reminders.js', 'cleaner.js', 'appLauncher.js', 'expenses.js', 'pagomovil.js', 'voicetools.js', 'aiProviders.js', 'geminiAgent.js', 'yarbisBrain.js']) {
    delete require.cache[require.resolve(path.join(root, file))];
    require(path.join(root, file));
  }
  // Sin red en las pruebas: usar las tasas en memoria
  globalThis.YarbisFinance.ensureFresh = async () => globalThis.YarbisFinance.getRates();
  globalThis.YarbisFinance.groups.fx.data = { bcv: 100, paralelo: 120, eur: 110 };
  globalThis.YarbisFinance.groups.fx.status = 'live';
  globalThis.YarbisFinance.groups.fx.updatedAt = Date.now();
  globalThis.YarbisFinance.groups.fiat.data = { USD: 1, EUR: 0.92 };
  const brain = new globalThis.YARBISBrain();
  // La IA nunca se consulta en las pruebas
  brain.askAI = async () => ({ text: '__AI__', ai: true });
  return { brain, win: globalThis };
}

module.exports = { loadApp, createStorage };
