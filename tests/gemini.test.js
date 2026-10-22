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
