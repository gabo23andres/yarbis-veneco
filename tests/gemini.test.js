'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./setup.js');

const { brain, win } = loadApp();
const R = win.YarbisReminders;
const G = win.YarbisGemini;
// Estas pruebas sí usan la IA (con un Gemini simulado)
brain.askAI = Object.getPrototypeOf(brain).askAI;
brain.setApiKey('AIzaSyPRUEBA_PRUEBA_PRUEBA_PRUEBA_123');
brain.geminiModel = 'gemini-2.5-flash';

test.after(() => R.schedule.stopTicking());

// Respuestas de Gemini en orden; cada una es una lista de "parts"
let script = [];
let requests = [];
const sse = (parts) => new Response(
  parts.map(p => `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [p] } }] })}\n\n`).join(''),
  { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

win.fetch = async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : null;
  requests.push({ url: String(url), body });
  const next = script.shift();
  if (typeof next === 'function') return next(url, body);
  if (!next) throw new Error(`petición inesperada: ${url}`);
  return sse(next);
};

test('Gemini usa herramientas: alarma y lista de compras', async () => {
  requests = [];
  R.schedule.alarms.slice().forEach(a => R.schedule.removeAlarm(a.id));
  script = [
    [
      { text: 'Voy con eso. ' },
      { functionCall: { name: 'crear_alarma', args: { hora: '06:30', motivo: 'Gym', repetir: 'lunes_a_viernes' } }, thoughtSignature: 'firma-1' },
      { functionCall: { name: 'agregar_notas', args: { textos: ['proteína', 'avena'], lista: 'compras' } } }
    ],
    [{ text: 'Listo: alarma de lunes a viernes a las 6:30 y agregué proteína y avena a Compras.' }]
  ];
  const chunks = [];
  const r = await brain.process('necesito levantarme temprano para el gym, y me falta proteína y avena', { onChunk: (t) => chunks.push(t) });

  assert.match(r.text, /Voy con eso\.\s+Listo: alarma de lunes a viernes/);
  assert.deepStrictEqual(r.tools, ['crear_alarma', 'agregar_notas']);
  assert.strictEqual(r.sound, 'success');
  assert.ok(r.effects.some(e => e.type === 'REMINDER'));
  assert.ok(chunks.length >= 2, 'la respuesta se pinta mientras llega');

  const alarm = R.schedule.alarms.find(a => a.label === 'Gym');
  assert.ok(alarm);
  assert.strictEqual(alarm.repeat, 'weekdays');
  assert.deepStrictEqual([alarm.h, alarm.m], [6, 30]);
  const compras = R.notes.inList('Compras').map(n => n.text);
  assert.ok(compras.includes('Proteína') && compras.includes('Avena'), compras.join());

  // La primera petición declara las herramientas
  assert.match(requests[0].url, /gemini-2\.5-flash:streamGenerateContent\?alt=sse/);
  assert.ok(requests[0].body.tools[0].function_declarations.some(t => t.name === 'crear_alarma'));
  // La segunda devuelve el resultado y conserva la firma de pensamiento
  const contents = requests[1].body.contents;
  const modelTurn = contents[contents.length - 2];
  const toolTurn = contents[contents.length - 1];
  assert.strictEqual(modelTurn.role, 'model');
  assert.strictEqual(modelTurn.parts.find(p => p.functionCall && p.functionCall.name === 'crear_alarma').thoughtSignature, 'firma-1');
  assert.deepStrictEqual(toolTurn.parts.map(p => p.functionResponse.name), ['crear_alarma', 'agregar_notas']);
  assert.strictEqual(toolTurn.parts[0].functionResponse.response.ok, true);
});

test('Gemini registra gastos, mensajes y eventos', async () => {
  brain.saveContact('Mamá', '0414 1234567');
  script = [
    [
      { functionCall: { name: 'registrar_gasto', args: { monto: 12, moneda: 'USD', categoria: 'Comida', nota: 'pizza' } } },
      { functionCall: { name: 'enviar_mensaje', args: { destinatario: 'mamá', mensaje: 'ya cené', via: 'whatsapp' } } }
    ],
    [{ text: 'Hecho.' }]
  ];
  const r = await brain.askAI('anota que gasté 12 en pizza y avísale a mamá que ya cené');
  assert.strictEqual(r.text, 'Hecho.');
  const exp = win.YarbisExpenses.store.items[0];
  assert.deepStrictEqual([exp.amount, exp.currency, exp.category], [12, 'USD', 'Comida']);
  assert.ok(r.effects.some(e => e.type === 'OPEN_URL' && e.url === 'https://wa.me/584141234567?text=ya%20cen%C3%A9'));
  const results = requests[requests.length - 1].body.contents.at(-1).parts.map(p => p.functionResponse.response);
  assert.ok(results.every(x => x.ok), JSON.stringify(results));
});

test('Gemini crea eventos en la fecha exacta', async () => {
  script = [
    [{ functionCall: { name: 'crear_evento', args: { titulo: 'Dentista', fecha: '2030-12-25', hora: '15:00' } } }],
    [{ text: 'Agendado.' }]
  ];
  const r = await brain.askAI('agéndame el dentista para navidad de 2030 a las 3 de la tarde');
  assert.ok(r.actions.some(a => /calendar\.google\.com.*text=Dentista&dates=20301225T150000\/20301225T160000/.test(a.url || '')), JSON.stringify(r.actions));
});

test('búsqueda en Google con fuentes', async () => {
  script = [
    [{ functionCall: { name: 'buscar_en_internet', args: { consulta: 'resultado del Caracas FC ayer' } } }],
    (url, body) => {
      assert.match(String(url), /:generateContent$/);
      assert.deepStrictEqual(body.tools, [{ google_search: {} }]);
      return new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: 'El Caracas FC ganó 2 a 1.' }] },
          groundingMetadata: { groundingChunks: [{ web: { uri: 'https://ejemplo.com/nota', title: 'ejemplo.com' } }] }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
    [{ text: 'Ayer el **Caracas FC** ganó 2 a 1.' }]
  ];
  const r = await brain.askAI('¿cómo quedó el Caracas ayer?');
  assert.match(r.text, /ganó 2 a 1/);
  assert.deepStrictEqual(r.actions[0], { label: '🔗 ejemplo.com', url: 'https://ejemplo.com/nota' });
  const fr = requests.at(-1).body.contents.at(-1).parts[0].functionResponse;
  assert.strictEqual(fr.response.resultado, 'El Caracas FC ganó 2 a 1.');
});

test('si Gemini falla se usa la IA gratuita', async () => {
  script = [
    () => new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), { status: 429 }),
    () => new Response(JSON.stringify({ choices: [{ message: { content: 'Respuesta de respaldo.' } }] }), { status: 200 }),
    () => new Response(JSON.stringify({ choices: [{ message: { content: 'Respuesta de respaldo.' } }] }), { status: 200 })
  ];
  const r = await brain.askAI('hola, cuéntame un chiste');
  assert.strictEqual(r.text, 'Respuesta de respaldo.');
  script = [];
});

test('memoria: recuerda, lista y olvida', async () => {
  G.Memory.clear();
  assert.match((await brain.process('recuerda que mi cumpleaños es el 5 de mayo')).text, /Lo recordaré/);
  assert.match((await brain.process('recuerda que mi esposa se llama Ana')).text, /Lo recordaré/);
  assert.strictEqual(G.Memory.all().length, 2);
  assert.match(brain.systemPrompt(), /mi cumpleaños es el 5 de mayo/);
  // Un aviso con hora no es un recuerdo
  await brain.process('recuerda que mañana a las 3 tengo dentista');
  assert.strictEqual(G.Memory.all().length, 2);
  assert.match((await brain.process('qué recuerdas de mí')).text, /esposa se llama Ana/);
  assert.match((await brain.process('olvida lo de cumpleaños')).text, /Olvidado/);
  assert.deepStrictEqual(G.Memory.all().map(m => m.text), ['mi esposa se llama Ana']);
  await brain.process('olvida todo lo que sabes de mí');
  assert.strictEqual(G.Memory.all().length, 0);
});

test('elección de modelo según preferencia', () => {
  const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-pro-preview', 'text-embedding-004'];
  assert.strictEqual(brain.chooseModel(models, 'auto'), 'gemini-2.5-flash');
  assert.strictEqual(brain.chooseModel(models, 'pro'), 'gemini-2.5-pro');
  assert.strictEqual(brain.chooseModel(models, 'lite'), 'gemini-2.5-flash-lite');
});

test('unir partes del streaming', () => {
  const merged = G.mergeParts([{ text: 'Ho' }, { text: 'la' }, { functionCall: { name: 'x', args: {} } }, { text: '!' }]);
  assert.deepStrictEqual(merged, [{ text: 'Hola' }, { functionCall: { name: 'x', args: {} } }, { text: '!' }]);
});

test('detecta el proveedor por la clave', () => {
  const P = win.YarbisAIProviders;
  assert.strictEqual(P.detect('sk-ant-api03-abc'), 'anthropic');
  assert.strictEqual(P.detect('sk-or-v1-abc'), 'openrouter');
  assert.strictEqual(P.detect('sk-proj-abc'), 'openai');
  assert.strictEqual(P.detect('gsk_abc'), 'groq');
  assert.strictEqual(P.detect('xai-abc'), 'xai');
  assert.strictEqual(P.detect('AIzaSyabc'), 'gemini');
  assert.strictEqual(P.detect('cualquiercosa'), null);
  assert.deepStrictEqual(P.toJsonSchema({ type: 'OBJECT', properties: { a: { type: 'ARRAY', items: { type: 'STRING' } } } }),
    { type: 'object', properties: { a: { type: 'array', items: { type: 'string' } } } });
});

test('otra API (compatible con OpenAI) actúa con herramientas', async () => {
  const P = win.YarbisAIProviders;
  P.save({ provider: 'groq', key: 'gsk_prueba', model: 'llama-3.3-70b-versatile', primary: true });
  assert.deepStrictEqual(brain.brainOrder(), ['provider', 'gemini']);
  assert.strictEqual(brain.aiLabel(), 'Groq');
  const delta = (d) => `data: ${JSON.stringify({ choices: [{ delta: d }] })}\n\n`;
  script = [
    (url, body) => {
      assert.strictEqual(String(url), 'https://api.groq.com/openai/v1/chat/completions');
      assert.strictEqual(body.model, 'llama-3.3-70b-versatile');
      assert.strictEqual(body.messages[0].role, 'system');
      assert.ok(body.tools.some(t => t.function.name === 'crear_temporizador'));
      return new Response(
        delta({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'crear_temporizador', arguments: '{"minu' } }] }) +
        delta({ tool_calls: [{ index: 0, function: { arguments: 'tos": 7, "motivo": "huevos"}' } }] }) + 'data: [DONE]\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    (url, body) => {
      const last = body.messages.at(-1);
      assert.strictEqual(last.role, 'tool');
      assert.strictEqual(last.tool_call_id, 'c1');
      assert.strictEqual(JSON.parse(last.content).ok, true);
      assert.strictEqual(body.messages.at(-2).tool_calls[0].function.name, 'crear_temporizador');
      return new Response(delta({ content: 'Temporizador de 7 minutos ' }) + delta({ content: 'para los huevos.' }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
  ];
  R.schedule.cancelAllTimers();
  const r = await brain.askAI('ponme algo para no quemar los huevos, como 7 minutos');
  assert.strictEqual(r.text, 'Temporizador de 7 minutos para los huevos.');
  assert.deepStrictEqual(R.schedule.timers.map(t => [t.label, t.durationMs / 1000]), [['huevos', 420]]);
  P.clear();
});

test('Claude actúa con herramientas y devuelve los bloques intactos', async () => {
  const P = win.YarbisAIProviders;
  P.save({ provider: 'anthropic', key: 'sk-ant-prueba', primary: true });
  const ev = (e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
  script = [
    (url, body) => {
      assert.strictEqual(String(url), 'https://api.anthropic.com/v1/messages');
      assert.strictEqual(body.model, 'claude-opus-5-5');
      assert.ok(body.system.includes('YARBIS'));
      assert.ok(body.tools.some(t => t.name === 'agregar_notas' && t.input_schema.type === 'object'));
      assert.strictEqual(body.messages.at(-1).role, 'user');
      return new Response(
        ev({ type: 'message_start', message: {} }) +
        ev({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }) +
        ev({ type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-xyz' } }) +
        ev({ type: 'content_block_stop', index: 0 }) +
        ev({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu_1', name: 'agregar_notas', input: {} } }) +
        ev({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"textos": ["pagar la luz"]' } }) +
        ev({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: ', "lista": "Personal"}' } }) +
        ev({ type: 'content_block_stop', index: 1 }) +
        ev({ type: 'message_delta', delta: { stop_reason: 'tool_use' } }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    (url, body) => {
      const [assistant, user] = body.messages.slice(-2);
      assert.deepStrictEqual(assistant.content[0], { type: 'thinking', thinking: '', signature: 'sig-xyz' });
      assert.deepStrictEqual(assistant.content[1].input, { textos: ['pagar la luz'], lista: 'Personal' });
      assert.strictEqual(user.content[0].type, 'tool_result');
      assert.strictEqual(user.content[0].tool_use_id, 'tu_1');
      return new Response(
        ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) +
        ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Anotado: pagar la luz.' } }) +
        ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
  ];
  const r = await brain.askAI('que no se me olvide pagar la luz');
  assert.strictEqual(r.text, 'Anotado: pagar la luz.');
  assert.ok(R.notes.items.some(n => n.text === 'Pagar la luz'));
  P.clear();
});

test('herramientas válidas para la API de Gemini (sin OBJECT vacíos)', () => {
  const TYPES = ['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT'];
  const check = (schema, where) => {
    assert.ok(TYPES.includes(schema.type), `${where}: tipo ${schema.type}`);
    if (schema.type === 'OBJECT') {
      assert.ok(schema.properties && Object.keys(schema.properties).length, `${where}: OBJECT sin propiedades`);
      if ('required' in schema) {
        assert.ok(schema.required.length, `${where}: required vacío`);
        schema.required.forEach(r => assert.ok(r in schema.properties, `${where}: required ${r} no existe`));
      }
      Object.entries(schema.properties).forEach(([k, v]) => check(v, `${where}.${k}`));
    }
    if (schema.type === 'ARRAY') check(schema.items, `${where}[]`);
  };
  for (const t of G.TOOLS) {
    assert.match(t.name, /^[a-z_]+$/);
    if (t.parameters !== undefined) check(t.parameters, t.name);
  }
  // Los proveedores tipo OpenAI/Claude reciben siempre un objeto
  assert.ok(G.TOOLS.some(t => t.parameters === undefined));
});

test('cuerpo para Gemini: pensamiento corto y tokens suficientes', () => {
  const b25 = brain.geminiBodyFor({ contents: [] }, 'gemini-2.5-flash');
  assert.deepStrictEqual(b25.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.ok(b25.generationConfig.maxOutputTokens >= 4096);
  assert.deepStrictEqual(brain.geminiBodyFor({ contents: [] }, 'gemini-2.5-pro').generationConfig.thinkingConfig, { thinkingBudget: 128 });
  assert.deepStrictEqual(brain.geminiBodyFor({ contents: [] }, 'gemini-3-flash').generationConfig.thinkingConfig, { thinkingLevel: 'low' });
  assert.strictEqual(brain.geminiBodyFor({ contents: [] }, 'gemini-2.0-flash').generationConfig.thinkingConfig, undefined);
});

test('probar clave: vale aunque Gemini devuelva texto vacío', async () => {
  const realFetch = win.fetch;
  win.fetch = async (url) => {
    if (String(url).includes('/models?')) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { role: 'model' } }] }), { status: 200 });
  };
  try {
    const r = await brain.testGeminiApiKey('AIzaSyCLAVE_DE_PRUEBA_DE_TREINTA_Y_NUEVE');
    assert.strictEqual(r.success, true, r.message);
    assert.match(r.message, /gemini-2\.5-flash/);
  } finally {
    win.fetch = realFetch;
  }
});

test('probar clave: mensaje claro si la clave es inválida', async () => {
  const realFetch = win.fetch;
  win.fetch = async () => new Response(JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }), { status: 400 });
  try {
    const r = await brain.testGeminiApiKey('AIzaSyCLAVE_DE_PRUEBA_DE_TREINTA_Y_NUEVE');
    assert.strictEqual(r.success, false);
    assert.match(r.message, /no es válida/);
  } finally {
    win.fetch = realFetch;
  }
});

test('Gemini reintenta con otro modelo si se agota el cupo y quita "thinking" si no se acepta', async () => {
  const realFetch = win.fetch;
  const calls = [];
  brain.geminiModel = 'gemini-2.5-flash';
  brain.geminiModelList = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  brain.noThinkingConfig = false;
  win.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url: String(url), thinking: body.generationConfig.thinkingConfig });
    if (calls.length === 1) return new Response(JSON.stringify({ error: { code: 429, message: 'Resource exhausted' } }), { status: 429 });
    if (calls.length === 2) return new Response(JSON.stringify({ error: { code: 400, message: 'Unknown name "thinkingConfig"' } }), { status: 400 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola desde el respaldo' }] } }] }), { status: 200 });
  };
  try {
    const text = await brain.geminiRequest({ contents: [{ role: 'user', parts: [{ text: 'hola' }] }] });
    assert.strictEqual(text, 'Hola desde el respaldo');
    assert.match(calls[0].url, /gemini-2\.5-flash:generateContent/);
    assert.match(calls[1].url, /gemini-2\.5-flash-lite:generateContent/);
    assert.ok(calls[1].thinking);
    assert.match(calls[2].url, /gemini-2\.5-flash-lite:generateContent/);
    assert.strictEqual(calls[2].thinking, undefined);
    // El modelo elegido por el usuario no cambia por un problema de cupo
    assert.strictEqual(brain.geminiModel, 'gemini-2.5-flash');
  } finally {
    win.fetch = realFetch;
    brain.noThinkingConfig = false;
    brain.geminiModelList = null;
  }
});

// Lista real de una cuenta gratis (octubre 2026)
const REAL_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-preview-tts', 'gemma-4-31b-it', 'gemini-flash-latest',
  'gemini-flash-lite-latest', 'gemini-pro-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-image', 'gemini-3-flash-preview',
  'gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools', 'gemini-3.1-flash-lite', 'gemini-3-pro-image', 'gemini-3.5-flash',
  'gemini-3.5-flash-lite', 'gemini-omni-1.1-flash', 'gemini-3.5-transcribe', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash',
  'gemini-4-argon', 'gemini-3.8-flash-tts', 'gemini-robotics-er-2-preview', 'deep-research-preview-04-2026', 'antigravity-preview-latest'];

test('candidatos de Gemini: sólo modelos normales y en orden de preferencia', () => {
  const auto = brain.geminiCandidates(REAL_MODELS, 'auto');
  assert.deepStrictEqual(auto.slice(0, 5), ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']);
  for (const bad of ['argon', 'omni', 'preview', 'tts', 'image', 'transcribe', 'customtools', 'gemma', 'robotics', 'research', 'antigravity']) {
    assert.ok(!auto.some(m => m.includes(bad)), bad);
  }
  assert.strictEqual(brain.geminiCandidates(REAL_MODELS, 'lite')[0], 'gemini-3.5-flash-lite');
  assert.strictEqual(brain.geminiCandidates(REAL_MODELS, 'pro')[0], 'gemini-2.5-pro');
  assert.strictEqual(auto.indexOf('gemini-flash-latest') > auto.indexOf('gemini-2.5-flash'), true);
});

test('elige probando: el más nuevo se cuelga, otro sin permiso, se queda con el que responde', async () => {
  const realFetch = win.fetch;
  const prevTimeouts = brain.geminiTimeouts;
  brain.geminiTimeouts = { request: 300, stream: 300, probe: 300, grace: 100 };
  win.localStorage.removeItem('yarbis_gemini_bad');
  const seen = [];
  win.fetch = (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/models?')) return Promise.resolve(new Response(JSON.stringify({ models: REAL_MODELS.map(m => ({ name: `models/${m}`, supportedGenerationMethods: ['generateContent'] })) }), { status: 200 }));
    const model = u.match(/models\/([^:]+):/)[1];
    seen.push(model);
    if (model === 'gemini-3.8-flash' || model === 'gemini-3.7-flash') {
      // Colgado: sólo termina cuando se cancela
      return new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    }
    if (model === 'gemini-2.5-flash') return Promise.resolve(new Response(JSON.stringify({ error: { code: 403, message: 'The caller does not have permission', status: 'PERMISSION_DENIED' } }), { status: 403 }));
    return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), { status: 200 }));
  };
  try {
    const r = await brain.testGeminiApiKey('AQ.CLAVE_DE_PRUEBA_LARGA_PARA_EL_FORMATO_NUEVO');
    assert.strictEqual(r.success, true, r.message);
    assert.strictEqual(r.model, 'gemini-3.6-flash');
    assert.strictEqual(brain.geminiModel, 'gemini-3.6-flash');
    assert.ok(seen.includes('gemini-3.8-flash') && seen.includes('gemini-3.6-flash'));
  } finally {
    win.fetch = realFetch;
    brain.geminiTimeouts = prevTimeouts;
  }
});

test('geminiFetch: 403 o cuelgue pasan a otro modelo y lo guardan; clave inválida no reintenta', async () => {
  const realFetch = win.fetch;
  const prevTimeouts = brain.geminiTimeouts;
  brain.geminiTimeouts = { request: 300, stream: 300, probe: 300, grace: 100 };
  brain.geminiModelList = REAL_MODELS;
  win.localStorage.removeItem('yarbis_gemini_bad');
  const seen = [];
  let mode = 'hang';
  win.fetch = (url, opts = {}) => {
    const model = String(url).match(/models\/([^:]+):/)[1];
    seen.push(model);
    if (mode === 'invalid') return Promise.resolve(new Response(JSON.stringify({ error: { code: 401, message: 'API key not valid.', details: [{ reason: 'ACCESS_TOKEN_TYPE_UNSUPPORTED' }] } }), { status: 401 }));
    if (model === 'gemini-3.8-flash') return new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    if (model === 'gemini-3.7-flash') return Promise.resolve(new Response(JSON.stringify({ error: { code: 403, message: 'The caller does not have permission' } }), { status: 403 }));
    return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] }), { status: 200 }));
  };
  try {
    brain.geminiModel = 'gemini-3.8-flash';
    assert.strictEqual(await brain.geminiRequest({ contents: [{ role: 'user', parts: [{ text: 'hola' }] }] }), 'Hola');
    assert.deepStrictEqual(seen, ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']);
    assert.strictEqual(brain.geminiModel, 'gemini-3.6-flash', 'se guarda el modelo que sí responde');

    mode = 'invalid';
    seen.length = 0;
    await assert.rejects(brain.geminiRequest({ contents: [{ role: 'user', parts: [{ text: 'hola' }] }] }), /no es válida/);
    assert.strictEqual(seen.length, 1, 'con clave inválida no se prueban otros modelos');
  } finally {
    win.fetch = realFetch;
    brain.geminiTimeouts = prevTimeouts;
    brain.geminiModelList = null;
    win.localStorage.removeItem('yarbis_gemini_bad');
  }
});

test('búsqueda en Google sin cupo: busca en Wikipedia y no insiste', async () => {
  const realFetch = win.fetch;
  brain.geminiModel = 'gemini-3.6-flash';
  win.localStorage.removeItem('yarbis_gemini_search_off');
  const seen = [];
  win.fetch = async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.includes('generativelanguage')) return new Response(JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota' } }), { status: 429 });
    if (u.includes('list=search')) return new Response(JSON.stringify({ query: { search: [{ title: 'Selección de fútbol de Venezuela', snippet: 'La <span>Vinotinto</span> es…' }] } }), { status: 200 });
    if (u.includes('page/summary')) return new Response(JSON.stringify({ extract: 'La selección de fútbol de Venezuela, conocida como la Vinotinto…' }), { status: 200 });
    throw new Error(`inesperado ${u}`);
  };
  try {
    const r = await G.webSearch(brain, 'Vinotinto');
    assert.strictEqual(r.via, 'wikipedia');
    assert.match(r.text, /Vinotinto/);
    assert.match(r.note, /no está incluida/);
    assert.match(r.sources[0].uri, /es\.wikipedia\.org\/wiki\/Selecci/);
    assert.strictEqual(seen.filter(u => u.includes('generativelanguage')).length, 1, 'no prueba otros modelos');
    assert.strictEqual(G.googleSearchOff(), true);
    // La siguiente búsqueda va directo a Wikipedia
    seen.length = 0;
    await G.webSearch(brain, 'Caracas');
    assert.ok(!seen.some(u => u.includes('generativelanguage')));
  } finally {
    win.fetch = realFetch;
    win.localStorage.removeItem('yarbis_gemini_search_off');
  }
});
