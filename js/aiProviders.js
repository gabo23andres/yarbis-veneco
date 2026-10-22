/* ==========================================================================
   YARBIS - OTRAS APIs DE IA
   Conecta cualquier proveedor con tu propia clave: OpenAI (ChatGPT), Claude,
   Groq, OpenRouter, DeepSeek, Mistral, Grok o cualquier API compatible con
   OpenAI. Todas pueden usar las herramientas de la app (alarmas, notas…).
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const KEY = 'yarbis_ai_provider';
  const MODEL_CACHE = 'yarbis_ai_provider_model';

  const PROVIDERS = {
    openai: {
      name: 'OpenAI (ChatGPT)', format: 'openai', base: 'https://api.openai.com/v1',
      keyRe: /^sk-(?!ant-|or-)/, link: 'https://platform.openai.com/api-keys',
      prefer: [/^gpt-5(\.\d+)?-mini$/, /^gpt-4\.1-mini$/, /^gpt-4o-mini$/], fallback: 'gpt-4o-mini'
    },
    anthropic: {
      name: 'Claude (Anthropic)', format: 'anthropic', base: 'https://api.anthropic.com/v1',
      keyRe: /^sk-ant-/, link: 'https://console.anthropic.com/settings/keys',
      fixed: 'claude-opus-5-5'
    },
    groq: {
      name: 'Groq', format: 'openai', base: 'https://api.groq.com/openai/v1',
      keyRe: /^gsk_/, link: 'https://console.groq.com/keys',
      prefer: [/^llama-3\.3-70b-versatile$/, /gpt-oss-120b/, /^llama/], fallback: 'llama-3.3-70b-versatile'
    },
    openrouter: {
      name: 'OpenRouter', format: 'openai', base: 'https://openrouter.ai/api/v1',
      keyRe: /^sk-or-/, link: 'https://openrouter.ai/keys', fixed: 'openrouter/auto'
    },
    deepseek: {
      name: 'DeepSeek', format: 'openai', base: 'https://api.deepseek.com/v1',
      link: 'https://platform.deepseek.com/api_keys', fixed: 'deepseek-chat'
    },
    mistral: {
      name: 'Mistral', format: 'openai', base: 'https://api.mistral.ai/v1',
      link: 'https://console.mistral.ai/api-keys', fixed: 'mistral-small-latest'
    },
    xai: {
      name: 'Grok (xAI)', format: 'openai', base: 'https://api.x.ai/v1',
      keyRe: /^xai-/, link: 'https://console.x.ai', prefer: [/^grok-\d[\w.-]*mini/, /^grok-\d/], fallback: 'grok-3-mini'
    },
    custom: { name: 'Otra (compatible con OpenAI)', format: 'openai', base: '' }
  };

  // Adivina el proveedor por el formato de la clave
  function detect(key) {
    const k = String(key || '').trim();
    if (/^(AIza|AQ\.)/.test(k)) return 'gemini';
    for (const id of ['anthropic', 'openrouter', 'groq', 'xai', 'openai']) {
      if (PROVIDERS[id].keyRe && PROVIDERS[id].keyRe.test(k)) return id;
    }
    return null;
  }

  function config() {
    const c = S.get(KEY, null);
    return c && c.key && PROVIDERS[c.provider] ? c : null;
  }

  function save(cfg) {
    const p = PROVIDERS[cfg.provider];
    if (!p) throw new Error('Proveedor desconocido.');
    const clean = {
      provider: cfg.provider,
      key: String(cfg.key || '').trim().replace(/^Bearer\s+/i, ''),
      model: String(cfg.model || '').trim(),
      base: String(cfg.base || '').trim().replace(/\/+$/, ''),
      primary: !!cfg.primary
    };
    S.set(KEY, clean);
    S.remove(MODEL_CACHE);
    return clean;
  }

  function clear() {
    S.remove(KEY);
    S.remove(MODEL_CACHE);
  }

  function isReady() {
    const c = config();
    return !!(c && (c.provider !== 'custom' || (c.base && c.model)));
  }

  function label() {
    const c = config();
    return c ? PROVIDERS[c.provider].name.replace(/\s*\(.*\)$/, '') : '';
  }

  function baseUrl(c) {
    return (c.provider === 'custom' ? c.base : (c.base || PROVIDERS[c.provider].base)).replace(/\/+$/, '');
  }

  function headers(c) {
    if (PROVIDERS[c.provider].format === 'anthropic') {
      return {
        'Content-Type': 'application/json',
        'x-api-key': c.key,
        'anthropic-version': '2023-06-01',
        // Necesario para llamar a la API de Claude directo desde el navegador
        'anthropic-dangerous-direct-browser-access': 'true'
      };
    }
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` };
    if (c.provider === 'openrouter') {
      h['HTTP-Referer'] = 'https://gabo23andres.github.io/yarbis-veneco/';
      h['X-Title'] = 'YARBIS';
    }
    return h;
  }

  async function errorOf(res) {
    const data = await res.json().catch(() => ({}));
    const msg = (data.error && (data.error.message || data.error)) || data.message || `HTTP ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    return err;
  }

  // Modelo a usar: el que escribió el usuario, o uno bueno de la lista del proveedor
  async function resolveModel(c = config()) {
    if (c.model) return c.model;
    const p = PROVIDERS[c.provider];
    if (p.fixed) return p.fixed;
    const cached = S.getRaw(MODEL_CACHE, '');
    if (cached) return cached;
    let model = p.fallback;
    try {
      const res = await U.fetchWithTimeout(`${baseUrl(c)}/models`, { headers: headers(c) }, 10000);
      if (res.ok) {
        const data = await res.json();
        const ids = (data.data || []).map(m => m.id);
        for (const re of p.prefer || []) {
          const hit = ids.filter(id => re.test(id)).sort().pop();
          if (hit) { model = hit; break; }
        }
      }
    } catch (e) { /* se usa el modelo por defecto */ }
    S.setRaw(MODEL_CACHE, model);
    return model;
  }

  /* ------------------------------------------
     Esquemas de herramientas (formato Gemini -> JSON Schema)
     ------------------------------------------ */
  function toJsonSchema(s) {
    if (!s || typeof s !== 'object') return s;
    const out = {};
    Object.entries(s).forEach(([k, v]) => {
      if (k === 'type') out.type = String(v).toLowerCase();
      else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toJsonSchema(pv)]));
      else if (k === 'items') out.items = toJsonSchema(v);
      else out[k] = v;
    });
    if (out.type === 'object' && !out.properties) out.properties = {};
    return out;
  }

  function parseArgs(text) {
    if (!text) return {};
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /* ------------------------------------------
     Formato OpenAI (y compatibles)
     ------------------------------------------ */
  function openaiMessages(system, messages) {
    return [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))];
  }

  async function openaiTurn(c, model, body, onText) {
    const res = await fetch(`${baseUrl(c)}/chat/completions`, {
      method: 'POST', headers: headers(c), body: JSON.stringify({ ...body, model, stream: true })
    });
    if (!res.ok) throw await errorOf(res);
    let text = '';
    const calls = [];
    const isJson = /json/.test(res.headers.get('content-type') || '') && !/event-stream/.test(res.headers.get('content-type') || '');
    if (isJson) {
      const data = await res.json();
      const msg = data.choices && data.choices[0] && data.choices[0].message;
      text = (msg && msg.content) || '';
      ((msg && msg.tool_calls) || []).forEach(tc => calls.push({ id: tc.id, name: tc.function.name, args: tc.function.arguments || '' }));
      if (text && onText) onText(text);
    } else {
      await readSSE(res, (payload) => {
        let data;
        try { data = JSON.parse(payload); } catch (e) { return; }
        const delta = data.choices && data.choices[0] && data.choices[0].delta;
        if (!delta) return;
        if (delta.content) {
          text += delta.content;
          if (onText) onText(text);
        }
        (delta.tool_calls || []).forEach(tc => {
          const i = tc.index ?? calls.length;
          if (!calls[i]) calls[i] = { id: '', name: '', args: '' };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function && tc.function.name) calls[i].name += tc.function.name;
          if (tc.function && tc.function.arguments) calls[i].args += tc.function.arguments;
        });
      });
    }
    return { text, calls: calls.filter(Boolean).map((x, i) => ({ ...x, id: x.id || `call_${i}` })) };
  }

  /* ------------------------------------------
     Formato Claude (Anthropic Messages API)
     ------------------------------------------ */
  function anthropicMessages(messages) {
    const out = [];
    messages.forEach(m => {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const last = out[out.length - 1];
      if (last && last.role === role && typeof last.content === 'string') last.content += `\n${m.text}`;
      else out.push({ role, content: m.text });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  // Los modelos Claude 5 aceptan "effort" (bajo = respuestas ágiles para voz) y,
  // en Opus/Sonnet 5.5, un modelo de respaldo si el principal declina responder.
  function anthropicExtras(model) {
    const extras = /^claude-(opus|sonnet|haiku|fable)-5/.test(model) ? { output_config: { effort: 'low' } } : {};
    if (/^claude-(opus|sonnet)-5-5$/.test(model)) extras.fallbacks = 'default';
    return extras;
  }

  function anthropicHeaders(c, model) {
    const h = headers(c);
    if (/^claude-(opus|sonnet)-5-5$/.test(model)) h['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    return h;
  }

  async function anthropicTurn(c, model, body, onText) {
    const res = await fetch(`${baseUrl(c)}/messages`, {
      method: 'POST', headers: anthropicHeaders(c, model),
      body: JSON.stringify({ model, max_tokens: 4096, ...anthropicExtras(model), ...body, stream: true })
    });
    if (!res.ok) throw await errorOf(res);
    const blocks = [];
    const json = [];
    let text = '';
    let stop = '';
    await readSSE(res, (payload) => {
      let ev;
      try { ev = JSON.parse(payload); } catch (e) { return; }
      if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'error de Claude');
      if (ev.type === 'content_block_start') {
        blocks[ev.index] = { ...ev.content_block };
        json[ev.index] = '';
      } else if (ev.type === 'content_block_delta') {
        const b = blocks[ev.index];
        const d = ev.delta || {};
        if (!b) return;
        if (d.type === 'text_delta') {
          b.text = (b.text || '') + d.text;
          text += d.text;
          if (onText) onText(text);
        } else if (d.type === 'input_json_delta') {
          json[ev.index] += d.partial_json || '';
        } else if (d.type === 'thinking_delta') {
          b.thinking = (b.thinking || '') + d.thinking;
        } else if (d.type === 'signature_delta') {
          b.signature = d.signature;
        }
      } else if (ev.type === 'content_block_stop') {
        const b = blocks[ev.index];
        if (b && b.type === 'tool_use') b.input = parseArgs(json[ev.index]) || {};
      } else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) {
        stop = ev.delta.stop_reason;
      }
    });
    const content = blocks.filter(Boolean);
    if (stop === 'refusal' && !text.trim()) throw new Error('Claude no quiso responder a eso.');
    const calls = content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, args: b.input }));
    return { text, calls, content };
  }

  /* ------------------------------------------
     Conversación con herramientas
     ------------------------------------------ */
  async function run({ system, messages, tools, onText, execute, maxRounds = 5 }) {
    const c = config();
    if (!c) throw new Error('Sin proveedor configurado.');
    const model = await resolveModel(c);
    const isClaude = PROVIDERS[c.provider].format === 'anthropic';
    let useTools = !!(tools && tools.length);
    let shown = '';
    let finalText = '';
    const used = [];

    const chat = isClaude ? anthropicMessages(messages) : openaiMessages(system, messages);
    const toolDefs = () => (isClaude
      ? tools.map(t => ({ name: t.name, description: t.description, input_schema: toJsonSchema(t.parameters) }))
      : tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: toJsonSchema(t.parameters) } })));

    for (let i = 0; i < maxRounds; i++) {
      const body = isClaude ? { system, messages: chat } : { messages: chat };
      if (useTools) body.tools = toolDefs();
      let r;
      try {
        r = isClaude
          ? await anthropicTurn(c, model, body, (t) => onText && onText(shown + t))
          : await openaiTurn(c, model, body, (t) => onText && onText(shown + t));
      } catch (e) {
        // Algunos modelos no aceptan herramientas: se reintenta sólo conversando
        if (useTools && i === 0 && e.status === 400 && /tool|function/i.test(e.message)) {
          useTools = false;
          i -= 1;
          continue;
        }
        throw e;
      }
      if (!r.calls.length) {
        finalText = shown + r.text;
        break;
      }
      if (r.text.trim()) shown += `${r.text.trim()}\n\n`;
      const results = [];
      for (const call of r.calls) {
        used.push(call.name);
        const args = typeof call.args === 'string' ? parseArgs(call.args) : call.args;
        let result;
        if (!args) result = { ok: false, error: 'Argumentos inválidos (JSON).' };
        else {
          try { result = await execute(call.name, args); } catch (e) { result = { ok: false, error: e.message }; }
        }
        results.push({ call, result });
      }
      if (isClaude) {
        chat.push({ role: 'assistant', content: r.content });
        chat.push({
          role: 'user',
          content: results.map(({ call, result }) => ({
            type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result), ...(result.ok === false ? { is_error: true } : {})
          }))
        });
      } else {
        chat.push({
          role: 'assistant',
          content: r.text || null,
          tool_calls: r.calls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args) } }))
        });
        results.forEach(({ call, result }) => chat.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) }));
      }
      if (i === maxRounds - 1) finalText = shown.trim();
    }
    return { text: String(finalText || '').trim(), tools: used };
  }

  // Una consulta suelta, sin historial
  async function complete(system, userText) {
    const r = await run({ system, messages: [{ role: 'user', text: userText }], tools: [], maxRounds: 1 });
    if (!r.text) throw new Error('respuesta vacía');
    return r.text;
  }

  // Visión: describe una foto
  async function vision(prompt, dataUrl) {
    const c = config();
    const model = await resolveModel(c);
    if (PROVIDERS[c.provider].format === 'anthropic') {
      const media = (String(dataUrl).match(/^data:(image\/[\w+.-]+);base64,/) || [])[1] || 'image/jpeg';
      const data = String(dataUrl).replace(/^data:image\/[\w+.-]+;base64,/, '');
      const r = await anthropicTurn(c, model, {
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: media, data } }, { type: 'text', text: prompt }] }]
      });
      return r.text.trim();
    }
    const r = await openaiTurn(c, model, {
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }]
    });
    return r.text.trim();
  }

  // Voz a texto con Whisper (OpenAI o Groq)
  const WHISPER = { openai: 'whisper-1', groq: 'whisper-large-v3' };

  function canTranscribe() {
    const c = config();
    return !!(c && WHISPER[c.provider]);
  }

  async function transcribe(blob, lang = 'es') {
    const c = config();
    if (!c || !WHISPER[c.provider]) throw new Error('Este proveedor no convierte voz en texto.');
    const ext = /mp4|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    const form = new root.FormData();
    form.append('file', blob, `voz.${ext}`);
    form.append('model', WHISPER[c.provider]);
    form.append('language', String(lang || 'es').slice(0, 2));
    const res = await fetch(`${baseUrl(c)}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.key}` },
      body: form
    });
    if (!res.ok) throw await errorOf(res);
    const data = await res.json();
    return String(data.text || '').trim();
  }

  async function test(cfg) {
    const prev = S.get(KEY, null);
    const prevModel = S.getRaw(MODEL_CACHE, '');
    try {
      save(cfg);
      const model = await resolveModel();
      const text = await complete('Responde exactamente: OK', 'Di OK');
      return { success: true, model, message: `✅ Conectado a ${PROVIDERS[cfg.provider].name} · ${model}.`, reply: text };
    } catch (e) {
      if (prev) S.set(KEY, prev); else S.remove(KEY);
      if (prevModel) S.setRaw(MODEL_CACHE, prevModel); else S.remove(MODEL_CACHE);
      return { success: false, message: `❌ No funcionó: ${e.message}` };
    }
  }

  // Lector SSE (compartido por todos los formatos)
  async function readSSE(res, onData) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const flush = (line) => {
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (payload && payload !== '[DONE]') onData(payload);
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        flush(line);
      }
    }
    flush(buffer.trim());
  }

  root.YarbisAIProviders = { PROVIDERS, detect, config, save, clear, isReady, label, resolveModel, run, complete, vision, test, toJsonSchema, canTranscribe, transcribe };
})(typeof window !== 'undefined' ? window : globalThis);
