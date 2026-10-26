/* ==========================================================================
   YARBIS - GEMINI COMO CEREBRO
   Gemini decide qué hacer y usa "herramientas" de la app: alarmas,
   temporizadores, notas, gastos, mensajes, apps, calendario, clima,
   búsqueda en Google y memoria de datos del usuario.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;
  const MEM_KEY = 'yarbis_memories';
  const MAX_MEMORIES = 60;
  const MAX_ROUNDS = 5;

  /* ------------------------------------------
     MEMORIA: datos duraderos del usuario
     ------------------------------------------ */
  const Memory = {
    all() {
      const list = S.get(MEM_KEY, []);
      return Array.isArray(list) ? list : [];
    },
    add(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.]+$/, '');
      if (clean.length < 3) return null;
      const list = this.all();
      const same = list.find(m => U.normalize(m.text) === U.normalize(clean));
      if (same) return same;
      const item = { id: U.uid(), text: clean.slice(0, 300), t: Date.now() };
      list.push(item);
      S.set(MEM_KEY, list.slice(-MAX_MEMORIES));
      return item;
    },
    // Borra los recuerdos que contengan las palabras indicadas
    forget(query) {
      const words = U.normalize(query).split(' ').filter(w => w.length > 2);
      if (!words.length) return 0;
      const list = this.all();
      const keep = list.filter(m => {
        const t = U.normalize(m.text);
        return !words.every(w => t.includes(w));
      });
      S.set(MEM_KEY, keep);
      return list.length - keep.length;
    },
    remove(id) {
      S.set(MEM_KEY, this.all().filter(m => m.id !== id));
    },
    clear() {
      S.remove(MEM_KEY);
    },
    prompt() {
      const list = this.all();
      if (!list.length) return '';
      return `\nDatos que el usuario te pidió recordar (algunos escritos por él en primera persona):\n- ${list.map(m => m.text).join('\n- ')}`;
    }
  };

  /* ------------------------------------------
     HERRAMIENTAS que Gemini puede usar
     ------------------------------------------ */
  const str = (description, extra = {}) => ({ type: 'STRING', description, ...extra });
  const num = (description) => ({ type: 'NUMBER', description });
  // Gemini rechaza (error 400) un OBJECT sin propiedades o con "required" vacío:
  // las herramientas sin datos van sin "parameters".
  const obj = (properties, required = []) => {
    if (!Object.keys(properties).length) return undefined;
    return required.length ? { type: 'OBJECT', properties, required } : { type: 'OBJECT', properties };
  };

  const TOOLS = [
    {
      name: 'crear_alarma',
      description: 'Programa una alarma o recordatorio a una hora concreta.',
      parameters: obj({
        hora: str('Hora en formato 24 h HH:MM, por ejemplo "06:30" o "18:00".'),
        motivo: str('Para qué es la alarma (opcional).'),
        fecha: str('Fecha YYYY-MM-DD si no es la próxima vez que llegue esa hora (opcional).'),
        repetir: str('Repetición.', { enum: ['ninguna', 'diaria', 'lunes_a_viernes', 'fines_de_semana'] })
      }, ['hora'])
    },
    {
      name: 'crear_temporizador',
      description: 'Inicia una cuenta regresiva (temporizador).',
      parameters: obj({
        minutos: num('Minutos (puede ser 0).'),
        segundos: num('Segundos adicionales (opcional).'),
        motivo: str('Para qué es (opcional).')
      }, ['minutos'])
    },
    {
      name: 'agregar_notas',
      description: 'Guarda una o varias notas o pendientes. Usa la lista "Compras" para productos del mercado.',
      parameters: obj({
        textos: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Cada nota o producto por separado.' },
        lista: str('Nombre de la lista: Personal, Compras, Trabajo u otra (opcional).')
      }, ['textos'])
    },
    {
      name: 'registrar_gasto',
      description: 'Anota un gasto del usuario en su control de gastos.',
      parameters: obj({
        monto: num('Monto gastado.'),
        moneda: str('Moneda.', { enum: ['USD', 'VES'] }),
        categoria: str('Categoría: Comida, Transporte, Servicios, Salud, Ocio u Otros.'),
        nota: str('Detalle del gasto (opcional).')
      }, ['monto', 'moneda'])
    },
    {
      name: 'registrar_ingreso',
      description: 'Anota dinero que le entró al usuario: le dieron o regalaron plata, sueldo, remesa, venta, pago móvil recibido, bono, trabajo extra, préstamo recibido.',
      parameters: obj({
        monto: num('Monto recibido.'),
        moneda: str('Moneda.', { enum: ['USD', 'VES'] }),
        categoria: str('Tipo: Sueldo, Regalo, Remesa, Ventas, Trabajo extra, Bonos, Préstamo u Otros.'),
        nota: str('De quién o por qué (opcional). Ej: "De mi papá", "Venta de tortas".')
      }, ['monto', 'moneda'])
    },
    {
      name: 'balance_del_mes',
      description: 'Dice cuánto dinero entró y salió este mes y cuánto le queda al usuario (ingresos menos gastos).',
      parameters: obj({})
    },
    {
      name: 'bolsa',
      description: 'Precios y señales técnicas (comprar, mantener, vender) de la Bolsa de Caracas (IBC y acciones), acciones de EE. UU., fondos (S&P 500), oro, divisas y cripto.',
      parameters: obj({
        consulta: str('Nombre o símbolo a consultar, por ejemplo "Apple", "IBC", "Banco Provincial", "oro" (opcional).'),
        mercado: str('Mercado (opcional).', { enum: ['bvc', 'us', 'etf', 'commodities', 'crypto'] })
      })
    },
    {
      name: 'tasas_del_dia',
      description: 'Devuelve las tasas actualizadas del dólar BCV, paralelo, euro y USDT en bolívares.',
      parameters: obj({})
    },
    {
      name: 'alerta_dolar',
      description: 'Avisa al usuario cuando una tasa suba o baje de un valor.',
      parameters: obj({
        tasa: str('Tasa a vigilar.', { enum: ['bcv', 'paralelo'] }),
        direccion: str('Avisar si sube o si baja del valor.', { enum: ['sube', 'baja'] }),
        valor: num('Valor en bolívares.')
      }, ['tasa', 'direccion', 'valor'])
    },
    {
      name: 'llamar',
      description: 'Llama por teléfono a un contacto guardado o a un número.',
      parameters: obj({ contacto: str('Nombre del contacto o número.') }, ['contacto'])
    },
    {
      name: 'enviar_mensaje',
      description: 'Prepara un mensaje de WhatsApp, SMS o correo para un contacto.',
      parameters: obj({
        destinatario: str('Nombre del contacto, número o correo.'),
        mensaje: str('Texto del mensaje (o asunto del correo).'),
        via: str('Medio.', { enum: ['whatsapp', 'sms', 'correo'] })
      }, ['destinatario', 'mensaje'])
    },
    {
      name: 'abrir_app',
      description: 'Abre una app o sitio: WhatsApp, YouTube, Instagram, Maps, bancos venezolanos, etc.',
      parameters: obj({ nombre: str('Nombre de la app o sitio.') }, ['nombre'])
    },
    {
      name: 'poner_musica',
      description: 'Busca y reproduce música o videos.',
      parameters: obj({
        busqueda: str('Canción, artista o género.'),
        plataforma: str('Dónde.', { enum: ['spotify', 'youtube'] })
      }, ['busqueda'])
    },
    {
      name: 'crear_evento',
      description: 'Crea un evento en el calendario del teléfono.',
      parameters: obj({
        titulo: str('Título del evento.'),
        fecha: str('Fecha YYYY-MM-DD.'),
        hora: str('Hora 24 h HH:MM (opcional; sin hora es de todo el día).')
      }, ['titulo', 'fecha'])
    },
    {
      name: 'clima',
      description: 'Consulta el clima actual y el pronóstico.',
      parameters: obj({ ciudad: str('Ciudad (opcional; sin ella usa la del usuario).') })
    },
    {
      name: 'lugares_cercanos',
      description: 'Busca lugares cerca del usuario en el mapa (farmacias, gasolineras, restaurantes…).',
      parameters: obj({ que: str('Qué buscar.') }, ['que'])
    },
    {
      name: 'mi_ubicacion',
      description: 'Dice dónde está el usuario ahora mismo.',
      parameters: obj({})
    },
    {
      name: 'buscar_en_internet',
      description: 'Busca en Google información actual: noticias, resultados deportivos, precios, horarios, eventos recientes o cualquier dato que no sepas con seguridad.',
      parameters: obj({ consulta: str('Qué buscar.') }, ['consulta'])
    },
    {
      name: 'guardar_recuerdo',
      description: 'Guarda un dato duradero del usuario para recordarlo siempre (cumpleaños, gustos, familia, trabajo, preferencias).',
      parameters: obj({ dato: str('El dato, en tercera persona. Ej: "Su cumpleaños es el 5 de mayo".') }, ['dato'])
    },
    {
      name: 'olvidar_recuerdo',
      description: 'Borra un dato que el usuario pidió olvidar.',
      parameters: obj({ dato: str('Palabras clave del dato a olvidar.') }, ['dato'])
    },
    {
      name: 'ejecutar_orden',
      description: 'Ejecuta cualquier otra orden de la app escrita en español, por ejemplo: "borra la lista de compras", "cancela los temporizadores", "modo oscuro", "abre finanzas", "escanea un QR", "enciende la linterna", "comparte mis datos de pago móvil", "traduce al inglés: hola".',
      parameters: obj({ orden: str('La orden en español.') }, ['orden'])
    }
  ];

  const REPEAT = { diaria: 'daily', lunes_a_viernes: 'weekdays', fines_de_semana: 'weekends' };
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function parseHM(value) {
    const m = String(value || '').match(/(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2] || 0);
    return h <= 23 && min <= 59 ? { h, m: min } : null;
  }

  function parseYMD(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function isoDate(d = new Date()) {
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /* ------------------------------------------
     EJECUCIÓN DE HERRAMIENTAS
     ------------------------------------------ */
  // Pasa la respuesta de una intención local al resultado acumulado
  function collect(out, r) {
    if (!r) return { ok: false, error: 'La app no reconoció esa orden.' };
    if (r.effect) out.effects.push(r.effect);
    if (r.effects) out.effects.push(...r.effects);
    if (r.actions) out.actions.push(...r.actions);
    if (r.sound) out.sound = r.sound;
    return { ok: !r.error, resultado: String(r.text || '').replace(/\*\*|__|`/g, '') };
  }

  // Borrar o cancelar sólo si la persona lo pidió con sus palabras. Un texto de internet,
  // de Wikipedia o compartido desde otra app podría traer órdenes escondidas para la IA.
  const DESTRUCTIVE_RE = /\b(borra\w*|elimina\w*|vacia\w*|limpia\w*|olvida\w*|quita\w*|cancela\w*|resetea\w*|reinicia\w*|desactiva\w*)\b/;
  const NOT_ASKED = 'El usuario no pidió borrar ni cancelar nada en su mensaje. No lo hagas; si crees que hace falta, pregúntale primero.';
  const SHARED_PREFIX = /^explicame o resume esto\b/;

  function lastUserText(messages) {
    const m = [...(messages || [])].reverse().find(x => x && x.role === 'user');
    return m ? String(m.text || '') : '';
  }

  function userAsked(out, re) {
    const t = U.normalize(out.userText || '');
    return !SHARED_PREFIX.test(t) && re.test(t);
  }

  async function execute(brain, name, args, out) {
    const a = args || {};
    const R = brain.reminders;
    switch (name) {
      case 'crear_alarma': {
        const hm = parseHM(a.hora);
        if (!hm) return { ok: false, error: 'Hora inválida.' };
        const day = parseYMD(a.fecha);
        const at = new Date(day || new Date());
        at.setHours(hm.h, hm.m, 0, 0);
        if (!day && at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
        if (at.getTime() <= Date.now()) return { ok: false, error: 'Esa hora ya pasó.' };
        const alarm = R.schedule.addAlarm(at.getTime(), a.motivo || 'Alarma', REPEAT[a.repetir] || 'none');
        if (!alarm) return { ok: false, error: 'No se pudo crear la alarma.' };
        out.effects.push({ type: 'REMINDER', id: alarm.id });
        out.actions.push({ label: '📅 Que suene con la app cerrada', command: 'phone-alarm', value: { title: alarm.label, at: alarm.at, repeat: alarm.repeat } });
        out.sound = 'success';
        return { ok: true, programada_para: new Date(alarm.at).toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }), repite: alarm.repeat };
      }
      case 'crear_temporizador': {
        const secs = Math.round((Number(a.minutos) || 0) * 60 + (Number(a.segundos) || 0));
        if (secs < 1) return { ok: false, error: 'Duración inválida.' };
        const timer = R.schedule.addTimer(secs, a.motivo || '');
        out.effects.push({ type: 'REMINDER', id: timer && timer.id });
        out.sound = 'success';
        return { ok: true, duracion: U.fmtDuration(secs) };
      }
      case 'agregar_notas': {
        const texts = (Array.isArray(a.textos) ? a.textos : [a.textos]).map(t => U.capitalize(String(t || '').trim())).filter(Boolean);
        if (!texts.length) return { ok: false, error: 'Sin texto.' };
        const list = a.lista ? R.notes.addList(a.lista) || 'Personal' : 'Personal';
        const added = texts.length > 1 ? R.notes.addMany(texts, list) : [R.notes.add(texts[0], list)].filter(Boolean);
        out.actions.push({ label: `Ver ${list}`, command: 'open-list', value: list });
        out.sound = 'success';
        return { ok: true, guardadas: added.length, lista: list };
      }
      case 'registrar_gasto': {
        const E = root.YarbisExpenses && root.YarbisExpenses.store;
        if (!E) return { ok: false, error: 'Gastos no disponible.' };
        const exp = E.add({ amount: a.monto, currency: a.moneda, category: a.categoria, note: a.nota || '' });
        if (!exp) return { ok: false, error: 'Monto inválido.' };
        out.actions.push({ label: 'Ver gastos', view: 'finance' });
        out.sound = 'success';
        const b = E.budgetStatus();
        const bal = root.YarbisExpenses.balance();
        return { ok: true, categoria: exp.category, en_dolares: Number(exp.usd.toFixed(2)), total_del_mes_usd: Number(E.summary().totalUsd.toFixed(2)), presupuesto_usado_pct: b.budget ? Math.round(b.pct) : null, ...(bal.incomeUsd ? { le_queda_este_mes_usd: Number(bal.balanceUsd.toFixed(2)) } : {}) };
      }
      case 'registrar_ingreso': {
        const X = root.YarbisExpenses;
        if (!X || !X.incomes) return { ok: false, error: 'Ingresos no disponible.' };
        const inc = X.incomes.add({ amount: a.monto, currency: a.moneda, category: a.categoria, note: a.nota || '' });
        if (!inc) return { ok: false, error: 'Monto inválido.' };
        out.actions.push({ label: 'Ver ingresos', view: 'finance' });
        out.sound = 'success';
        const b = X.balance();
        return { ok: true, categoria: inc.category, en_dolares: Number(inc.usd.toFixed(2)), entro_este_mes_usd: Number(b.incomeUsd.toFixed(2)), salio_este_mes_usd: Number(b.expenseUsd.toFixed(2)), le_queda_usd: Number(b.balanceUsd.toFixed(2)) };
      }
      case 'balance_del_mes': {
        const X = root.YarbisExpenses;
        if (!X || !X.balance) return { ok: false, error: 'Finanzas no disponible.' };
        const b = X.balance();
        out.actions.push({ label: 'Ver finanzas', view: 'finance' });
        return { ok: true, entro_usd: Number(b.incomeUsd.toFixed(2)), salio_usd: Number(b.expenseUsd.toFixed(2)), le_queda_usd: Number(b.balanceUsd.toFixed(2)), tasa_bcv: b.bcv };
      }
      case 'bolsa': {
        const B = root.YarbisStocks;
        if (!B) return { ok: false, error: 'Bolsa no disponible.' };
        await B.load();
        out.actions.push({ label: 'Ver la bolsa', view: 'finance' });
        const pick = (x) => ({ nombre: x.name, simbolo: x.symbol, mercado: x.groupTitle, precio: x.price, moneda: x.currency, variacion_dia_pct: x.changePct, senal: x.signal, razones: x.reasons, rsi: x.rsi, rend_1_mes_pct: x.ret1m });
        const detail = (x) => ({ ...pick(x), promedio_20_dias: x.sma20, promedio_50_dias: x.sma50, rend_3_meses_pct: x.ret3m, maximo_1_ano: x.high52, minimo_1_ano: x.low52 });
        if (a.consulta) {
          const x = B.find(a.consulta) || B.mentioned(a.consulta);
          if (x) return { ok: true, actualizado: B.data.updatedAt, ...detail(x), aviso: B.data.disclaimer };
        }
        const r = B.recommendations(4, B.data, a.mercado || null);
        const g = a.mercado ? B.data.groups[a.mercado] : null;
        return {
          ok: true,
          ...(a.consulta ? { no_encontrado: `No sigo "${a.consulta}"; éstas son las señales generales.` } : {}),
          actualizado: B.data.updatedAt,
          indices: ((g || B.data.groups.bvc).indices || []).map(pick),
          comprar: r.buy.map(pick),
          vender: r.sell.map(pick),
          aviso: B.data.disclaimer
        };
      }
      case 'tasas_del_dia': {
        const r = await brain.finance.ensureFresh();
        out.actions.push({ label: 'Abrir convertidor', view: 'finance' });
        return {
          ok: true,
          dolar_bcv: r.bcv, paralelo: r.paralelo, euro_bcv: r.eur,
          usdt: r.crypto && r.crypto.USDT ? r.crypto.USDT.price : null,
          estado: brain.finance.statusLabel(r.fx)
        };
      }
      case 'alerta_dolar': {
        const alert = brain.finance.addAlert(a.tasa === 'paralelo' ? 'paralelo' : 'bcv', a.direccion === 'baja' ? 'below' : 'above', Number(a.valor));
        if (!alert) return { ok: false, error: 'Valor inválido.' };
        out.effects.push({ type: 'REMINDER' });
        return { ok: true, alerta: brain.finance.describeAlert(alert, true) };
      }
      case 'llamar':
        return collect(out, await brain.localIntent(`llama a ${a.contacto}`));
      case 'enviar_mensaje': {
        const via = a.via || 'whatsapp';
        const cmd = via === 'correo'
          ? `manda un correo a ${a.destinatario} con asunto ${a.mensaje}`
          : via === 'sms'
            ? `mandale un mensaje de texto a ${a.destinatario} que diga ${a.mensaje}`
            : `manda un whatsapp a ${a.destinatario} que diga ${a.mensaje}`;
        return collect(out, await brain.localIntent(cmd));
      }
      case 'abrir_app':
        return collect(out, await brain.localIntent(`abre ${a.nombre}`));
      case 'poner_musica': {
        const q = encodeURIComponent(String(a.busqueda || '').trim());
        const url = a.plataforma === 'youtube' ? `https://www.youtube.com/results?search_query=${q}` : `https://open.spotify.com/search/${q}`;
        out.effects.push({ type: 'OPEN_URL', url });
        out.actions.push({ label: a.plataforma === 'youtube' ? 'Abrir YouTube' : 'Abrir Spotify', url });
        return { ok: true };
      }
      case 'crear_evento': {
        const day = parseYMD(a.fecha);
        if (!day) return { ok: false, error: 'Fecha inválida.' };
        const hm = parseHM(a.hora);
        let raw = `${a.titulo} el ${day.getDate()} de ${MONTHS[day.getMonth()]}`;
        if (hm) {
          const h12 = hm.h % 12 || 12;
          raw += ` a las ${h12}:${String(hm.m).padStart(2, '0')} ${hm.h < 12 ? 'am' : 'pm'}`;
        }
        return collect(out, brain.calendarResponse(raw, U.normalize(raw), day));
      }
      case 'clima':
        return collect(out, await brain.localIntent(a.ciudad ? `clima en ${a.ciudad}` : 'como esta el clima'));
      case 'lugares_cercanos':
        return collect(out, await brain.nearby(String(a.que || '')));
      case 'mi_ubicacion':
        return collect(out, await brain.whereAmI());
      case 'buscar_en_internet': {
        const found = await webSearch(brain, String(a.consulta || ''));
        found.sources.slice(0, 2).forEach(s => out.actions.push({ label: `🔗 ${s.title}`, url: s.uri }));
        out.searched = true;
        return { ok: true, resultado: found.text, fuentes: found.sources.map(s => s.title), ...(found.note ? { nota: found.note } : {}) };
      }
      case 'guardar_recuerdo': {
        const m = Memory.add(a.dato);
        return m ? { ok: true, guardado: m.text } : { ok: false, error: 'Dato vacío.' };
      }
      case 'olvidar_recuerdo':
        if (!userAsked(out, DESTRUCTIVE_RE)) return { ok: false, error: NOT_ASKED };
        return { ok: true, borrados: Memory.forget(a.dato) };
      case 'ejecutar_orden': {
        const orden = String(a.orden || '');
        if (DESTRUCTIVE_RE.test(U.normalize(orden)) && !userAsked(out, DESTRUCTIVE_RE)) return { ok: false, error: NOT_ASKED };
        return collect(out, await brain.localIntent(orden));
      }
      default:
        return { ok: false, error: `Herramienta desconocida: ${name}` };
    }
  }

  /* ------------------------------------------
     BÚSQUEDA EN GOOGLE (grounding de Gemini)
     ------------------------------------------ */
  const SEARCH_OFF_KEY = 'yarbis_gemini_search_off';

  // En cuentas gratis la búsqueda en Google puede no estar incluida (cupo 0):
  // se recuerda por 24 h y mientras tanto se busca en Wikipedia.
  function googleSearchOff() {
    const t = Number(S.getRaw(SEARCH_OFF_KEY, '0'));
    return !!t && Date.now() - t < 24 * 3600 * 1000;
  }

  async function wikiSearch(query) {
    const q = encodeURIComponent(String(query || '').slice(0, 200));
    const res = await U.fetchWithTimeout(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`, {}, 10000);
    const data = await res.json().catch(() => ({}));
    const hits = (data.query && data.query.search) || [];
    if (!hits.length) return { text: 'No encontré resultados en Wikipedia.', sources: [], via: 'wikipedia' };
    const title = hits[0].title;
    let extract = '';
    try {
      const sum = await U.fetchWithTimeout(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {}, 8000);
      const sd = await sum.json();
      extract = sd.extract || '';
    } catch (e) { /* sólo los fragmentos */ }
    const snippets = hits.map(h => `${h.title}: ${String(h.snippet || '').replace(/<[^>]+>/g, '')}`).join('\n');
    return {
      text: `${extract ? `${title}: ${extract}\n\n` : ''}${snippets}`.trim(),
      sources: hits.slice(0, 2).map(h => ({ uri: `https://es.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`, title: `Wikipedia: ${h.title}` })),
      via: 'wikipedia'
    };
  }

  async function webSearch(brain, query) {
    if (!brain.geminiApiKey || googleSearchOff()) return wikiSearch(query);
    try {
      const { res } = await brain.geminiFetch({
        contents: [{ role: 'user', parts: [{ text: `Hoy es ${isoDate()}. Busca en internet y responde en español con datos concretos, cifras y fechas: ${query}` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3 }
      }, { noAlternate: true });
      const data = await res.json().catch(() => ({}));
      const cand = data.candidates && data.candidates[0];
      const parts = (cand && cand.content && cand.content.parts) || [];
      const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
      const chunks = (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
      const sources = chunks.map(c => c.web).filter(w => w && w.uri).map(w => ({ uri: w.uri, title: w.title || 'Fuente' }));
      return { text: text || 'No encontré resultados.', sources, via: 'google' };
    } catch (e) {
      if (e.fatal) throw e;
      if (e.status === 429 || e.status === 403 || e.status === 400) S.setRaw(SEARCH_OFF_KEY, String(Date.now()));
      const w = await wikiSearch(query);
      w.note = 'La búsqueda en Google no está incluida en el plan gratis de Gemini; se buscó en Wikipedia.';
      return w;
    }
  }

  // Declaraciones para Gemini: sin búsqueda en Google, la herramienta busca en Wikipedia
  function toolsFor(brain) {
    if (brain.geminiApiKey && !googleSearchOff()) return TOOLS;
    return TOOLS.map(t => (t.name === 'buscar_en_internet'
      ? { ...t, description: 'Busca información en Wikipedia (la búsqueda en Google no está incluida en este plan). Sirve para datos generales; no tiene noticias del día.' }
      : t));
  }

  /* ------------------------------------------
     CONVERSACIÓN CON HERRAMIENTAS
     ------------------------------------------ */
  function rules() {
    return `
Eres el cerebro de la app: además de conversar, puedes ACTUAR con tus herramientas.
- Responde primero exactamente lo que te preguntaron, en la primera frase; después, los detalles que ayuden. No cambies de tema ni respondas con listas genéricas.
- Bolsa, cripto, oro o dólares: usa la herramienta bolsa (o tasas_del_dia para el dólar en bolívares) y nunca inventes precios.
  · Si preguntan por UN activo ("¿compro bitcoin?", "¿cómo ves Apple?"), llama a bolsa con consulta=<ese activo> y habla SÓLO de él: precio y variación, la señal y lo que significa en palabras sencillas (tendencia frente al promedio de 50 días, RSI alto = subió rápido / bajo = cayó mucho, rendimiento de 1 y 3 meses, si está cerca del máximo o mínimo del año), pros y riesgos, y un consejo práctico: comprar por partes y sólo con dinero que no necesite; si es cripto, que sea una parte pequeña porque es muy volátil. Si conoces su balance del mes, tenlo en cuenta.
  · Si piden recomendaciones generales, usa bolsa sin consulta y explica las 2 o 3 mejores con su razón; sugiere diversificar (por ejemplo, fondos como el S&P 500).
  · Termina con una sola frase corta: son señales técnicas automáticas, no asesoría financiera. No la repitas.
- Si al usuario le dan, regalan o pagan dinero (sueldo, remesa, venta…), usa registrar_ingreso; si pregunta cuánto le queda, balance_del_mes.
- Si el usuario pide hacer algo (alarma, temporizador, nota, compra, gasto, llamada, mensaje, abrir app, música, evento, clima, lugares), usa la herramienta adecuada en vez de explicarle cómo hacerlo. Puedes usar varias seguidas.
- Para noticias, resultados, precios de productos, horarios o cualquier dato actual que no sepas con seguridad, usa buscar_en_internet. Para el dólar usa tasas_del_dia.
- Si el usuario te cuenta un dato personal duradero o te pide recordar algo, usa guardar_recuerdo.
- Fecha de hoy: ${isoDate()} (${new Date().toLocaleDateString('es-VE', { weekday: 'long' })}). Convierte "mañana", "el viernes", "a las 3 de la tarde" a fechas YYYY-MM-DD y horas HH:MM de 24 h.
- Tras usar herramientas, confirma en una o dos frases lo que hiciste, sin repetir datos técnicos. Si una herramienta falla, explícalo y propone una alternativa.`;
  }

  // Une las partes recibidas en streaming conservando las firmas de pensamiento
  function mergeParts(parts) {
    const merged = [];
    parts.forEach(p => {
      const last = merged[merged.length - 1];
      if (p.text !== undefined && !p.thought && last && last.text !== undefined && !last.thought && !last.functionCall) {
        last.text += p.text;
        if (p.thoughtSignature) last.thoughtSignature = p.thoughtSignature;
      } else {
        merged.push({ ...p });
      }
    });
    return merged;
  }

  async function round(brain, body, onText) {
    const { res } = await brain.geminiFetch(body, { stream: true });
    const raw = [];
    let text = '';
    let blocked = '';
    let finish = '';
    await brain.readSSE(res, (payload) => {
      let data;
      try { data = JSON.parse(payload); } catch (e) { return; }
      if (data.promptFeedback && data.promptFeedback.blockReason) blocked = data.promptFeedback.blockReason;
      const cand = data.candidates && data.candidates[0];
      if (cand && cand.finishReason) finish = cand.finishReason;
      const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      (parts || []).forEach(p => {
        raw.push(p);
        if (typeof p.text === 'string' && !p.thought) {
          text += p.text;
          if (onText) onText(text);
        }
      });
    });
    if (blocked && !raw.length) throw new Error(`respuesta bloqueada (${blocked})`);
    const parts = mergeParts(raw);
    if (!text.trim() && !parts.some(p => p.functionCall)) {
      throw new Error(`respuesta vacía${finish && finish !== 'STOP' ? ` (${finish})` : ''}`);
    }
    return { parts, text };
  }

  async function run(brain, messages, onChunk) {
    const body = brain.geminiChatBody(messages);
    body.system_instruction.parts[0].text += rules();
    body.tools = [{ function_declarations: toolsFor(brain) }];

    const out = { effects: [], actions: [], sound: null, tools: [], userText: lastUserText(messages) };
    let shown = '';
    let finalText = '';

    for (let i = 0; i < MAX_ROUNDS; i++) {
      const r = await round(brain, body, (t) => onChunk && onChunk(shown + t));
      const calls = r.parts.filter(p => p.functionCall);
      if (!calls.length) {
        finalText = shown + r.text;
        break;
      }
      if (r.text.trim()) shown += `${r.text.trim()}\n\n`;
      body.contents.push({ role: 'model', parts: r.parts });
      const responses = [];
      for (const c of calls) {
        const { name, args, id } = c.functionCall;
        out.tools.push(name);
        let result;
        try {
          result = await execute(brain, name, args, out);
        } catch (e) {
          result = { ok: false, error: e.message };
        }
        const fr = { name, response: result };
        if (id) fr.id = id;
        responses.push({ functionResponse: fr });
      }
      body.contents.push({ role: 'user', parts: responses });
      if (i === MAX_ROUNDS - 1) finalText = shown.trim();
    }

    return finish(out, finalText);
  }

  function finish(out, text) {
    let finalText = String(text || '').trim();
    if (!finalText) {
      if (!out.tools.length) throw new Error('respuesta vacía');
      finalText = '✅ Listo.';
    }
    // Sin botones repetidos
    const seen = new Set();
    out.actions = out.actions.filter(a => {
      const k = `${a.label}|${a.url || a.view || a.command || ''}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 4);
    return { text: finalText, ...out };
  }

  // El mismo cerebro con otra API (OpenAI, Claude, Groq…). La búsqueda en
  // Google sólo está disponible si también hay clave de Gemini.
  async function runProvider(brain, messages, onChunk) {
    const P = root.YarbisAIProviders;
    const out = { effects: [], actions: [], sound: null, tools: [], userText: lastUserText(messages) };
    const tools = toolsFor(brain);
    const r = await P.run({
      system: brain.systemPrompt() + rules(),
      messages,
      tools,
      onText: onChunk,
      execute: async (name, args) => {
        out.tools.push(name);
        return execute(brain, name, args, out);
      }
    });
    return finish(out, r.text);
  }

  root.YarbisGemini = { Memory, TOOLS, run, runProvider, execute, webSearch, wikiSearch, googleSearchOff, mergeParts, isoDate };
})(typeof window !== 'undefined' ? window : globalThis);
