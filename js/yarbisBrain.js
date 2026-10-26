/* ==========================================================================
   YARBIS - CEREBRO CONVERSACIONAL
   1. Intenciones locales (rápidas y sin internet cuando es posible):
      dólar/conversiones, cálculos, timers, alarmas, notas, clima, llamadas,
      WhatsApp, apps, música, búsquedas, cámara, temas, juegos...
   2. IA con memoria de conversación: Google Gemini (con tu clave) o IA
      gratuita. Si nada responde, lo dice claramente.

   Cada respuesta tiene la forma:
   { text, speak?, actions?: [{ label, url? , view?, command? }], effect?, sound? }
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;

  const HISTORY_KEY = 'yarbis_ai_history';
  const MAX_HISTORY = 24;

  const WORD_NUMBERS = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
    nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16,
    diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30,
    cuarenta: 40, cuarentaicinco: 45, cincuenta: 50, sesenta: 60, noventa: 90, cien: 100
  };
  const WORD_NUMBER_RE = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join('|')})\\b`, 'g');

  const APPS = [
    { keys: ['whatsapp', 'wasap', 'guasap', 'whats'], name: 'WhatsApp', url: 'https://wa.me/' },
    { keys: ['youtube', 'yutub'], name: 'YouTube', url: 'https://www.youtube.com' },
    { keys: ['spotify'], name: 'Spotify', url: 'https://open.spotify.com' },
    { keys: ['gmail', 'correo', 'email'], name: 'Gmail', url: 'https://mail.google.com' },
    { keys: ['netflix'], name: 'Netflix', url: 'https://www.netflix.com' },
    { keys: ['instagram', 'insta'], name: 'Instagram', url: 'https://www.instagram.com' },
    { keys: ['twitter', 'x'], name: 'X (Twitter)', url: 'https://x.com' },
    { keys: ['facebook', 'face'], name: 'Facebook', url: 'https://www.facebook.com' },
    { keys: ['tiktok', 'tik tok'], name: 'TikTok', url: 'https://www.tiktok.com' },
    { keys: ['telegram'], name: 'Telegram', url: 'https://web.telegram.org' },
    { keys: ['waze'], name: 'Waze', url: 'https://www.waze.com/live-map' },
    { keys: ['google maps', 'maps', 'mapa', 'mapas'], name: 'Google Maps', url: 'https://maps.google.com' },
    { keys: ['uber'], name: 'Uber', url: 'https://m.uber.com' },
    { keys: ['yummy'], name: 'Yummy', url: 'https://www.yummy.com.ve' },
    { keys: ['ridery'], name: 'Ridery', url: 'https://ridery.app' },
    { keys: ['pedidosya', 'pedidos ya'], name: 'PedidosYa', url: 'https://www.pedidosya.com.ve' },
    { keys: ['mercado libre', 'mercadolibre'], name: 'Mercado Libre', url: 'https://www.mercadolibre.com.ve' },
    { keys: ['amazon'], name: 'Amazon', url: 'https://www.amazon.com' },
    { keys: ['google drive', 'drive'], name: 'Google Drive', url: 'https://drive.google.com' },
    { keys: ['chatgpt', 'chat gpt'], name: 'ChatGPT', url: 'https://chatgpt.com' },
    { keys: ['gemini'], name: 'Gemini', url: 'https://gemini.google.com' },
    { keys: ['discord'], name: 'Discord', url: 'https://discord.com/app' },
    { keys: ['zoom'], name: 'Zoom', url: 'https://zoom.us' },
    { keys: ['canva'], name: 'Canva', url: 'https://www.canva.com' },
    { keys: ['github'], name: 'GitHub', url: 'https://github.com' },
    { keys: ['banco de venezuela', 'bdv'], name: 'BDV en Línea', url: 'https://bdvenlinea.banvenez.com/' },
    { keys: ['banesco'], name: 'Banesco Online', url: 'https://www.banesconline.com/' },
    { keys: ['mercantil'], name: 'Mercantil en Línea', url: 'https://www.mercantilbanco.com/' },
    { keys: ['provincial', 'bbva'], name: 'BBVA Provincial', url: 'https://www.provincial.com/' },
    { keys: ['bnc', 'banco nacional de credito'], name: 'BNC', url: 'https://www.bncenlinea.com/' },
    { keys: ['patria', 'plataforma patria'], name: 'Plataforma Patria', url: 'https://www.patria.org.ve/' },
    { keys: ['seniat'], name: 'SENIAT', url: 'https://www.seniat.gob.ve/' },
    { keys: ['bcv', 'banco central'], name: 'Banco Central de Venezuela', url: 'https://www.bcv.org.ve/' }
  ];

  const VIEWS = [
    { keys: ['notas', 'mis notas', 'recordatorios', 'pendientes'], view: 'notes', name: 'tus notas' },
    { keys: ['finanzas', 'terminal financiero', 'calculadora', 'convertidor', 'tasas', 'monitor'], view: 'finance', name: 'Finanzas' },
    { keys: ['ajustes', 'configuracion', 'opciones'], view: 'settings', name: 'Ajustes' },
    { keys: ['purificador', 'limpiador', 'anti marcas'], view: 'cleaner', name: 'el purificador de texto' },
    { keys: ['herramientas', 'mas opciones'], view: 'more', name: 'Herramientas' }
  ];

  const ACCENTS = {
    neon: ['neon', 'azul', 'cian', 'normal', 'por defecto'],
    mark85: ['mark 85', 'rojo', 'nano'],
    warmachine: ['war machine', 'gris', 'plateado'],
    spideriron: ['spider', 'spider iron'],
    wakanda: ['wakanda', 'pantera', 'black panther', 'morado', 'violeta'],
    stealth: ['sigilo', 'verde', 'matrix'],
    hulkbuster: ['hulkbuster', 'dorado', 'amarillo', 'naranja']
  };

  const LANGS = { 'es-ES': 'español', 'en-US': 'inglés', 'pt-BR': 'portugués', 'fr-FR': 'francés', 'it-IT': 'italiano', 'de-DE': 'alemán' };
  const LANG_WORDS = { ingles: 'en-US', espanol: 'es-ES', portugues: 'pt-BR', frances: 'fr-FR', italiano: 'it-IT', aleman: 'de-DE' };

  const ACCENT_NAMES = {
    neon: 'Neón', mark85: 'Mark 85', warmachine: 'War Machine', spideriron: 'Spider-Iron',
    wakanda: 'Wakanda', stealth: 'Sigilo', hulkbuster: 'Hulkbuster'
  };

  const CURRENCY_WORDS = [
    { re: /^(dolares?|usd|\$|verdes?|lechugas?)$/, code: 'USD' },
    { re: /^(bolivares?|bs|bolos?|ves|bss)$/, code: 'VES' },
    { re: /^(euros?|eur|€)$/, code: 'EUR' },
    { re: /^(usdt|tether)$/, code: 'USDT' },
    { re: /^(pesos? colombianos?|cop)$/, code: 'COP' },
    { re: /^(pesos? mexicanos?|mxn)$/, code: 'MXN' },
    { re: /^(pesos? chilenos?|clp)$/, code: 'CLP' },
    { re: /^(pesos? argentinos?|ars)$/, code: 'ARS' },
    { re: /^(soles|sol peruano|pen)$/, code: 'PEN' },
    { re: /^(reales?|brl)$/, code: 'BRL' },
    { re: /^(libras?|gbp)$/, code: 'GBP' },
    { re: /^(bitcoins?|btc)$/, code: 'BTC' },
    { re: /^(ethereum|eth|ether)$/, code: 'ETH' },
    { re: /^(solana)$/, code: 'SOL' }
  ];
  const CURRENCY_ALT = '(?:dolares?|usd|\\$|verdes|bolivares?|bs|bolos?|ves|euros?|eur|€|usdt|tether|pesos? colombianos?|cop|pesos? mexicanos?|mxn|pesos? chilenos?|clp|pesos? argentinos?|ars|soles|reales?|brl|libras?|gbp|bitcoins?|btc|ethereum|eth|solana)';

  const TRIVIA = [
    { q: '¿Cuál es la caída de agua más alta del mundo, ubicada en Venezuela?', a: ['salto angel', 'kerepakupai', 'angel'], explain: 'El Salto Ángel mide 979 metros.' },
    { q: '¿Cómo se le dice en Venezuela a un amigo de confianza?', a: ['pana', 'el mio', 'compadre', 'hermano', 'brother'], explain: '"Pana" o "el mío", ¡clásico!' },
    { q: '¿Cuál es el plato nacional con arroz, caraotas, carne mechada y tajadas?', a: ['pabellon'], explain: 'El Pabellón Criollo.' },
    { q: '¿En qué año nació Simón Bolívar?', a: ['1783'], explain: 'Nació el 24 de julio de 1783 en Caracas.' },
    { q: '¿Cuál es el pico más alto de Venezuela?', a: ['pico bolivar', 'bolivar'], explain: 'El Pico Bolívar, con 4.978 metros.' },
    { q: '¿Qué se come en Navidad envuelto en hojas de plátano?', a: ['hallaca', 'hallacas'], explain: '¡La hallaca, reina de diciembre!' },
    { q: '¿Cuál es el lago más grande de Venezuela?', a: ['maracaibo', 'lago de maracaibo'], explain: 'El Lago de Maracaibo.' },
    { q: '¿Cómo se llama el ave nacional de Venezuela?', a: ['turpial'], explain: 'El turpial.' }
  ];

  const JOKES = [
    '¿Por qué la arepa no va al gimnasio? Porque ya está bien rellena. 🫓',
    '¿Qué le dice un tequeño a otro? ¡Qué queso tan bueno tienes, chamo!',
    'Mi jefe me dijo: "Ponte las pilas". Y aquí estoy, cargando al 1%. 🔋',
    '¿Cuál es el colmo de un electricista? Que su esposa se llame Luz y los hijos le salgan con corriente. ⚡',
    '—Doctor, me siento como una hallaca. —Tranquilo, eso es la temporada. 🎄'
  ];

  /* ------------------------------------------
     TEXTO
     ------------------------------------------ */
  // Minúsculas y sin acentos, conservando la longitud (para recortar el original)
  function align(text) {
    let out = '';
    for (const ch of text) {
      let c = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (/[¿?¡!,;"“”«»()[\]{}]/.test(c)) c = ' ';
      if (c.length !== ch.length) c = (c + ' '.repeat(ch.length)).slice(0, ch.length);
      out += c;
    }
    return out;
  }

  function wordsToDigits(s) {
    return s.replace(WORD_NUMBER_RE, w => String(WORD_NUMBERS[w]));
  }

  function parseAmount(raw) {
    let s = String(raw).trim().replace(/\s+/g, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.500,50
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // 1,500.50
    else s = s.replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  // "1 hora 30 minutos", "media hora", "5 min y medio" -> segundos
  function parseDuration(n) {
    const s = wordsToDigits(n);
    let total = 0;
    let found = false;
    if (/\bmedia\s+hora\b/.test(s)) { total += 1800; found = true; }
    if (/\b(un\s+)?cuarto\s+de\s+hora\b/.test(s)) { total += 900; found = true; }
    const re = /(\d+(?:[.,]\d+)?)\s*(horas?|hrs?|h|minutos?|mins?|min|m|segundos?|segs?|seg|s)\b(\s+y\s+medi[ao])?/g;
    let m;
    while ((m = re.exec(s))) {
      const v = parseFloat(m[1].replace(',', '.'));
      const unit = m[2];
      found = true;
      if (unit.startsWith('h')) total += v * 3600 + (m[3] ? 1800 : 0);
      else if (unit.startsWith('m')) total += v * 60 + (m[3] ? 30 : 0);
      else total += v;
    }
    return found ? Math.round(total) : null;
  }

  // "a las 7:30 pm", "a las 6 de la mañana", "a la 1 y media", "al mediodia"
  function parseClock(n) {
    const s = wordsToDigits(n);
    const special = s.match(/\b(?:al|a)\s+medio\s?dia\b/) || s.match(/\b(?:a\s+la\s+)?medianoche\b/);
    if (special) {
      return {
        h: /medianoche/.test(special[0]) ? 0 : 12, m: 0, explicit: true,
        before: s.slice(0, special.index), after: s.slice(special.index + special[0].length)
      };
    }
    const re = /\ba\s+las?\s+(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?(\s+y\s+media|\s+y\s+cuarto|\s+menos\s+cuarto)?\s*(a\s*m|p\s*m|de\s+la\s+manana|de\s+la\s+madrugada|de\s+la\s+tarde|de\s+la\s+noche)?\b/;
    const m = s.match(re);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    let min = m[2] ? parseInt(m[2], 10) : 0;
    if (m[3]) {
      if (/media/.test(m[3])) min = 30;
      else if (/menos/.test(m[3])) { h = h - 1; min = 45; }
      else min = 15;
    }
    const period = (m[4] || '').replace(/\s/g, '');
    let explicit = false;
    if (/pm|tarde|noche/.test(period)) { if (h < 12) h += 12; explicit = true; }
    else if (/am|manana|madrugada/.test(period)) { if (h === 12) h = 0; explicit = true; }
    if (h > 23 || min > 59 || h < 0) return null;
    if (h >= 13 || h === 0) explicit = true;
    return { h, m: min, explicit, before: s.slice(0, m.index), after: s.slice(m.index + m[0].length) };
  }

  const MONTHS = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

  // "mañana", "pasado mañana", "el viernes", "el 25", "el 3 de noviembre" -> fecha (00:00)
  function parseDay(n, now = new Date()) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const add = (d) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
    const s = n.replace(/de la manana/g, '');
    let m;
    if (/\bpasado\s+manana\b/.test(s)) return { date: add(2), match: 'pasado manana' };
    if (/\bmanana\b/.test(s)) return { date: add(1), match: 'manana' };
    if (/\bhoy\b/.test(s)) return { date: base, match: 'hoy' };
    if ((m = s.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/))) {
      let d = new Date(base.getFullYear(), MONTHS[m[2]], Number(m[1]));
      if (d < base) d = new Date(base.getFullYear() + 1, MONTHS[m[2]], Number(m[1]));
      return { date: d, match: m[0] };
    }
    if ((m = s.match(/\b(?:el\s+)?(?:proximo\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?:\s+que\s+viene)?\b/))) {
      const target = DAY_WORDS[m[1]];
      let diff = (target - base.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return { date: add(diff), match: m[0] };
    }
    if ((m = s.match(/\bel\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?::|h\b|horas?|minutos?))/))) {
      const day = Number(m[1]);
      if (day >= 1 && day <= 31) {
        let d = new Date(base.getFullYear(), base.getMonth(), day);
        if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, day);
        return { date: d, match: m[0] };
      }
    }
    return null;
  }

  const DAY_WORDS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const REPEAT_WORDS_RE = /\b(todos los dias|todo los dias|diariamente|diario|a diario|cada dia|de lunes a viernes|entre semana|dias de semana|dias laborables|dias habiles|los fines? de semana|fines? de semana|sabados y domingos|(todos los|cada)\s+(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)((\s*,\s*|\s+y\s+)(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?))*)\b/g;

  // "todos los días", "de lunes a viernes", "cada martes y jueves" -> repetición
  function parseRepeat(n) {
    if (/\b(todos los dias|todo los dias|diariamente|diario|a diario|cada dia)\b/.test(n)) return 'daily';
    if (/\b(de lunes a viernes|entre semana|dias de semana|dias laborables|dias habiles)\b/.test(n)) return 'weekdays';
    if (/\b(fines? de semana|sabados y domingos)\b/.test(n)) return 'weekends';
    const m = n.match(/\b(?:todos los|cada)\s+((?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)(?:(?:\s*,\s*|\s+y\s+)(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?))*)/);
    if (m) {
      const days = m[1].split(/\s*,\s*|\s+y\s+/).map(d => DAY_WORDS[d.replace(/^(sabado|domingo)s$/, '$1')]).filter(d => d !== undefined);
      if (days.length) return [...new Set(days)];
    }
    return 'none';
  }

  // Próxima hora válida. Sin "am/pm": si la hora ya pasó, prueba la versión de la
  // tarde antes que mañana (salvo para despertar). "mañana" fuerza el día siguiente.
  function nextAlarmTime({ h, m, explicit }, opts = {}) {
    const at = (hh, addDays = 0) => {
      const d = new Date();
      d.setDate(d.getDate() + addDays);
      d.setHours(hh, m, 0, 0);
      return d.getTime();
    };
    const now = Date.now();
    if (opts.tomorrow) return at(h, 1);
    if (at(h) > now) return at(h);
    if (!explicit && !opts.wake && h < 12 && at(h + 12) > now) return at(h + 12);
    return at(h, 1);
  }

  function venezuelanPhone(raw) {
    let digits = String(raw || '').replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits.slice(1);
    digits = digits.replace(/\D/g, '');
    if (/^0(4\d{2})\d{7}$/.test(digits)) return '58' + digits.slice(1);
    if (/^4\d{9}$/.test(digits)) return '58' + digits;
    return digits;
  }

  // Agrega punto final salvo que ya termine en uno (p. ej. "8:00 p. m.")
  function sentence(text) {
    return /[.!?…](\*\*|_)?$/.test(text) ? text : `${text}.`;
  }

  function has(text, re) {
    return re.test(text);
  }

  // Preguntas de conocimiento ("¿qué es…?", "¿quién fue…?", "historia de…"): las responde la IA
  const KNOWLEDGE_RE = /^(que es|que son|que significa|quien es|quien fue|quienes fueron|cual es la historia|historia de|hablame de|hablame del|cuentame de|cuentame del|explicame que|por que se llama|de donde viene|cuando se creo|cuantos anos tiene)\b|\bes la moneda de\b/;

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ==========================================
     CEREBRO
     ========================================== */
  class YARBISBrain {
    constructor(deps = {}) {
      this.finance = deps.finance || root.YarbisFinance;
      this.reminders = deps.reminders || root.YarbisReminders;
      this.math = deps.math || root.YarbisMath;

      this.assistantName = S.getRaw('yarbis_assistant_name', 'YARBIS');
      this.userName = S.getRaw('yarbis_user_name', '');
      this.geminiApiKey = S.getRaw('yarbis_gemini_api_key', '');
      this.geminiModel = S.getRaw('yarbis_gemini_model', '');
      this.history = S.get(HISTORY_KEY, []);
      if (!Array.isArray(this.history)) this.history = [];

      this.trivia = null;
      this.lastAiEngine = '';
      // Límites de espera de Gemini (ms): petición, primer dato en streaming y prueba de modelos
      this.geminiTimeouts = { request: 20000, stream: 15000, probe: 15000, grace: 2000 };
    }

    get name() {
      return this.userName || 'mi pana';
    }

    setNames(assistantName, userName) {
      this.assistantName = String(assistantName || '').trim() || 'YARBIS';
      this.userName = String(userName || '').trim();
      S.setRaw('yarbis_assistant_name', this.assistantName);
      S.setRaw('yarbis_user_name', this.userName);
    }

    cleanKey(raw) {
      return String(raw || '').trim().replace(/^['"`]+|['"`]+$/g, '').replace(/^Bearer\s+/i, '').replace(/^key=/i, '').trim();
    }

    setApiKey(key) {
      const clean = this.cleanKey(key);
      if (clean !== this.geminiApiKey) {
        this.geminiModel = '';
        this.geminiModelList = null;
        S.remove('yarbis_gemini_model');
        S.remove('yarbis_gemini_bad');
        S.remove('yarbis_gemini_search_off');
      }
      this.geminiApiKey = clean;
      if (clean) S.setRaw('yarbis_gemini_api_key', clean);
      else S.remove('yarbis_gemini_api_key');
    }

    // Motores con clave, en orden de preferencia
    brainOrder() {
      const order = [];
      const P = root.YarbisAIProviders;
      const other = P && P.isReady();
      if (other && P.config().primary) order.push('provider');
      if (this.geminiApiKey && root.YarbisGemini) order.push('gemini');
      if (other && !order.includes('provider')) order.push('provider');
      return order;
    }

    aiLabel() {
      const first = this.brainOrder()[0];
      if (first === 'gemini') return 'Gemini';
      if (first === 'provider') return root.YarbisAIProviders.label();
      return 'IA gratuita';
    }

    greeting() {
      const hour = new Date().getHours();
      const saludo = hour < 12 ? '¡Buenos días' : hour < 19 ? '¡Buenas tardes' : '¡Buenas noches';
      const who = this.userName ? `, ${this.userName}` : '';
      return pick([
        `${saludo}${who}! ¿Qué hacemos hoy?`,
        `¡Épale${who}! Aquí estoy, ¿en qué te ayudo?`,
        `${saludo}${who}! Pregúntame lo que quieras o pídeme la tasa del dólar.`
      ]);
    }

    /* ------------------------------------------
       HISTORIAL
       ------------------------------------------ */
    remember(role, text) {
      this.history.push({ role, text: String(text).slice(0, 4000) });
      if (this.history.length > MAX_HISTORY) this.history = this.history.slice(-MAX_HISTORY);
      S.set(HISTORY_KEY, this.history);
    }

    resetConversation() {
      this.history = [];
      this.trivia = null;
      S.set(HISTORY_KEY, []);
    }

    /* ------------------------------------------
       ENTRADA PRINCIPAL
       ------------------------------------------ */
    // Divide "pon un timer de 5 minutos y anota comprar pan" en órdenes separadas.
    // Sólo corta en " y " cuando lo que sigue empieza con un verbo de orden.
    splitChain(text) {
      const parts = [];
      let rest = String(text);
      const re = /\s*(?:;|,?\s+y\s+luego|,?\s+y\s+despu[eé]s|,?\s+luego|,?\s+despu[eé]s|,?\s+y\s+tambi[eé]n|,?\s+y)\s+(?=(?:pon(?:me)?|anota(?:me)?|apunta|agrega|a[ñn]ade|crea|recu[eé]rdame|av[ií]same|abre|ll[aá]ma(?:me)?|manda(?:le)?|env[ií]a|dime|gast[eé]|pagu[eé]|busca|activa|apaga|cancela|borra|programa|despi[eé]rtame|convierte|calcula|mu[eé]strame|lee(?:me)?)\b)/gi;
      let last = 0;
      let m;
      while ((m = re.exec(rest))) {
        const chunk = rest.slice(last, m.index).trim();
        if (chunk) parts.push(chunk);
        last = m.index + m[0].length;
      }
      const tail = rest.slice(last).trim();
      if (tail) parts.push(tail);
      return parts;
    }

    async process(userText, opts = {}) {
      const original = String(userText || '').trim();
      if (!original) return { text: '¿Qué necesitas?' };

      const parts = this.splitChain(original);
      if (parts.length > 1 && parts.length <= 5) {
        const results = [];
        for (const part of parts) {
          let r = null;
          try { r = await this.localIntent(part); } catch (e) { console.warn(e); }
          if (!r) r = await this.askAI(part, { localFallback: () => this.localIntent(part, { noDefer: true }) });
          else {
            this.remember('user', part);
            this.remember('assistant', r.text);
          }
          results.push(r);
        }
        return {
          text: results.map(r => r.text).join('\n\n'),
          speak: results.map(r => U.toSpeech(r.speak || r.text)).join(' '),
          actions: results.flatMap(r => r.actions || []).slice(0, 4),
          effects: results.flatMap(r => r.effects || (r.effect ? [r.effect] : [])),
          sound: results.some(r => r.sound === 'success') ? 'success' : undefined,
          error: results.every(r => r.error)
        };
      }

      let response = null;
      try {
        response = await this.localIntent(original);
      } catch (e) {
        console.warn('Error en intención local:', e);
      }

      if (!response) {
        response = await this.askAI(original, { ...opts, localFallback: () => this.localIntent(original, { noDefer: true }) });
      } else {
        // Los comandos locales también quedan en el historial para dar contexto a la IA
        this.remember('user', original);
        this.remember('assistant', response.text);
      }
      return response;
    }

    async localIntent(original, opts = {}) {
      // Quitar "oye yarbis", "hey jarvis"...
      const wake = align(original).match(/^\s*(?:(?:oye|hey|ey|ok|hola)\s+)?(?:yarbis|jarvis|asistente)\b[\s,]*/);
      const text = wake ? original.slice(wake[0].length).trim() : original;
      if (!text) return { text: `¿Sí${this.userName ? ', ' + this.userName : ''}? Te escucho.` };

      const a = align(text);
      const n = a.replace(/\s+/g, ' ').trim();
      // Recorta del texto original lo capturado por un grupo (conserva acentos y mayúsculas)
      const grab = (re, group = 1) => {
        const m = re.exec(a);
        if (!m || !m.indices || !m.indices[group]) return null;
        return text.slice(m.indices[group][0], m.indices[group][1]).trim();
      };
      const has = (re) => re.test(n);

      /* ---------- Juego de trivia activo ---------- */
      if (this.trivia) {
        if (has(/\b(salir|cancelar|terminar|parar|ya no|basta)\b/)) {
          this.trivia = null;
          return { text: 'Listo, terminamos la trivia. ¿Qué más hacemos?' };
        }
        return this.answerTrivia(n);
      }

      /* ---------- Control de voz ---------- */
      if (has(/^(para|parar|detente|silencio|callate|stop|basta|shh+)$/)) {
        return { text: 'Ok, me callo. 🤐', effect: { type: 'STOP' }, silent: true };
      }
      if (has(/\b(activa|enciende|prende|inicia)\b.*\bmanos libres\b/)) {
        return { text: 'Manos libres activado: te escucho después de cada respuesta. Di "desactiva manos libres" para parar.', effect: { type: 'HANDS_FREE', on: true } };
      }
      if (has(/\b(desactiva|apaga|quita|deten)\b.*\bmanos libres\b/)) {
        return { text: 'Manos libres desactivado.', effect: { type: 'HANDS_FREE', on: false } };
      }

      /* ---------- Conversación básica ---------- */
      if (n.split(' ').length <= 5 && has(/^(hola|epale|buenas|buenos dias|buenas tardes|buenas noches|que mas|que hubo|quiubo|saludos|hey|como estas|como andas|que tal)\b/)) {
        return { text: this.greeting() };
      }
      if (has(/^(muchas )?gracias\b|^(mil gracias|te pasaste|eres lo maximo)/)) {
        return { text: pick(['¡A la orden! 🙌', '¡Con gusto, para eso estoy!', '¡De nada, mi pana!']) };
      }
      if (has(/^(ayuda|que puedes hacer|que sabes hacer|comandos|como te uso|que haces)\b/)) {
        return this.helpResponse();
      }
      if (has(/^(como te llamas|quien eres|cual es tu nombre)\b/)) {
        return { text: `Soy ${this.assistantName}, tu asistente personal. Puedo darte la tasa del dólar, convertir montos, calcular, poner alarmas, tomar notas, escanear códigos QR y conversar contigo.` };
      }
      const myName = grab(/^(?:me llamo|mi nombre es|llamame)\s+([a-z ]{2,30})$/d);
      if (myName && !/^(la|el|un|una|que|como|cuanto)\b/i.test(myName)) {
        this.setNames(this.assistantName, U.capitalize(myName));
        return { text: `¡Mucho gusto, ${this.userName}! Lo recordaré.`, effect: { type: 'PROFILE' } };
      }

      /* ---------- Memoria: "recuerda que…" ---------- */
      const mem = root.YarbisGemini && root.YarbisGemini.Memory;
      if (mem) {
        const fact = grab(/^(?:recuerda|acuerdate(?:\s+de)?|no\s+olvides|ten\s+en\s+cuenta|guarda\s+en\s+tu\s+memoria)\s+que\s+(.{3,})$/d);
        // "recuerda que mañana a las 3 tengo dentista" es un aviso, no un dato para la memoria
        if (fact && !/\b(a las \d|manana|hoy|esta (tarde|noche)|en \d+ (minutos?|horas?))\b/.test(U.normalize(fact))) {
          const m = mem.add(fact);
          return { text: m ? `🧠 Lo recordaré: _${m.text}_.` : 'No entendí qué debo recordar.', speak: m ? 'Listo, lo recordaré.' : undefined };
        }
        if (has(/^(?:que\s+(?:sabes|recuerdas)\s+(?:de\s+mi|sobre\s+mi)|que\s+recuerdas|que\s+te\s+he\s+dicho\s+de\s+mi)$/)) {
          const all = mem.all();
          return all.length
            ? { text: `🧠 Esto es lo que recuerdo de ti:\n${all.map(m => `- ${m.text}`).join('\n')}`, speak: `Recuerdo ${all.length} cosa${all.length === 1 ? '' : 's'} de ti.`, actions: [{ label: 'Administrar recuerdos', view: 'settings' }] }
            : { text: '🧠 Aún no me has pedido recordar nada. Di por ejemplo "recuerda que mi cumpleaños es el 5 de mayo".' };
        }
        if (has(/^olvida\s+(?:todo\s+lo\s+que\s+sabes\s+de\s+mi|todos\s+tus\s+recuerdos|todo\s+lo\s+que\s+te\s+dije)$/)) {
          mem.clear();
          return { text: '🧠 Listo, olvidé todo lo que me habías contado.' };
        }
        const forget = grab(/^olvida\s+(?:que|lo\s+de)\s+(.{3,})$/d);
        if (forget) {
          const k = mem.forget(forget);
          return { text: k ? `🧠 Olvidado${k > 1 ? ` (${k} datos)` : ''}.` : 'No encontré nada parecido en mis recuerdos.' };
        }
      }

      /* ---------- Hora y fecha ---------- */
      if (has(/\b(que hora es|que horas son|dime la hora|la hora)\b/) && n.split(' ').length <= 6) {
        return { text: sentence(`Son las ${new Date().toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}`) };
      }
      if (has(/\b(que dia es hoy|que fecha es|fecha de hoy|en que dia estamos|a cuanto estamos)\b/)) {
        const d = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return { text: `Hoy es ${d}.` };
      }

      /* ---------- Chat ---------- */
      if (has(/\b(borra|limpia|elimina|vacia)\b.*\b(chat|conversacion|pantalla|historial)\b/) || has(/^nueva conversacion$/)) {
        this.resetConversation();
        return { text: 'Conversación nueva. ¿En qué te ayudo?', effect: { type: 'CLEAR_CHAT' } };
      }

      /* ---------- Gastos ---------- */
      const income = this.incomeIntent(text, a, n);
      if (income) return income;
      const exp = this.expenseIntent(text, a, n);
      if (exp) return exp;

      /* ---------- Teléfono: calendario, SMS, correo y ubicación ---------- */
      const phone = await this.phoneIntent(text, a, n);
      if (phone) return phone;

      /* ---------- Alertas del dólar ---------- */
      const fxAlert = n.match(/\b(?:avisame|alertame|alerta|notificame|aviso)\b.*\b(dolar|bcv|paralelo|tasa|usdt|binance|euro)\b.*?\b(pase|pasa|supere|supera|suba|sube|llegue|llega|este por encima|este sobre|baje|baja|caiga|cae|este por debajo|bajo)\s+(?:de\s+|a\s+|los\s+)*(?:bs\s*)?(\d[\d.,]*)/);
      if (fxAlert) {
        const rate = /paralelo|usdt|binance/.test(n) ? 'paralelo' : 'bcv';
        const dir = /baj|cae|caiga|debajo/.test(fxAlert[2]) ? 'below' : 'above';
        const value = parseAmount(fxAlert[3]);
        const alert = this.finance.addAlert(rate, dir, value);
        if (alert) {
          const r = this.finance.getRates();
          const current = rate === 'paralelo' ? r.paralelo : r.bcv;
          return {
            text: `🔔 Listo: te aviso cuando el **${this.finance.describeAlert(alert, true)}**. Ahora está en ${U.fmtBs(current)}.`,
            effect: { type: 'REMINDER' },
            actions: [{ label: 'Ver alertas', view: 'finance' }],
            sound: 'success'
          };
        }
      }
      if (has(/\b(mis|que|cuales)\s+alertas\b/)) {
        const list = this.finance.alerts;
        if (!list.length) return { text: 'No tienes alertas del dólar. Dime por ejemplo "avísame cuando el dólar pase de 250".' };
        return { text: '🔔 Tus alertas:\n' + list.map(x => `- ${U.capitalize(this.finance.describeAlert(x))}`).join('\n'), actions: [{ label: 'Ver alertas', view: 'finance' }] };
      }

      /* ---------- Temporizadores ---------- */
      const isTimerWord = has(/\b(temporizador|temporizadores|timer|timers|cuenta regresiva|cronometro)\b/);
      if (isTimerWord && has(/\b(cancela|cancelar|quita|quitar|borra|borrar|elimina|deten|detener|para|parar|apaga|apagar)\b/)) {
        const count = this.reminders.schedule.cancelAllTimers();
        return { text: count ? `Listo, cancelé ${count === 1 ? 'el temporizador' : `${count} temporizadores`}.` : 'No tienes temporizadores activos.' };
      }
      const relative = /^(?:avisame|recuerdame|recordarme|despiertame|alertame)\s+en\s+/.test(n);
      if (isTimerWord || relative) {
        const seconds = parseDuration(n);
        if (seconds && seconds > 0) {
          let label = '';
          if (relative) {
            const after = grab(/(?:segundos?|segs?|minutos?|mins?|min|horas?|hrs?|media\s+hora)(?:\s+y\s+medi[ao])?\s+(?:que\s+|para\s+|de\s+|a\s+)?(.+)$/d);
            label = after ? U.capitalize(after) : '';
          } else {
            const lbl = grab(/\b(?:para|de nombre|llamado)\s+((?!\d)[a-zñ].{2,})$/d);
            if (lbl && !/\b(minutos?|segundos?|horas?)\b/.test(align(lbl))) label = U.capitalize(lbl);
          }
          const timer = this.reminders.schedule.addTimer(seconds, label);
          const when = U.fmtTime(Date.now() + seconds * 1000);
          return {
            text: sentence(`⏱️ Temporizador de **${U.describeDuration(seconds)}**${label ? ` para "${label}"` : ''}. Sonará a las ${when}`),
            speak: `Listo, temporizador de ${U.describeDuration(seconds)}${label ? ` para ${label}` : ''}.`,
            effect: { type: 'REMINDER', id: timer && timer.id },
            actions: [{ label: 'Ver temporizadores', view: 'notes' }],
            sound: 'success'
          };
        }
        if (isTimerWord) return { text: '¿De cuánto tiempo pongo el temporizador? Por ejemplo: "temporizador de 10 minutos".' };
      }

      /* ---------- Alarmas ---------- */
      const isAlarmWord = has(/\b(alarma|alarmas|despiertame|despertador|recuerdame|recordarme|avisame)\b/);
      if (isAlarmWord && has(/\b(cancela|borra|elimina|quita|apaga)\b.*\balarmas?\b/)) {
        const list = this.reminders.schedule.alarms.slice();
        list.forEach(a2 => this.reminders.schedule.removeAlarm(a2.id));
        return { text: list.length ? `Eliminé ${list.length === 1 ? 'la alarma' : `${list.length} alarmas`}.` : 'No tienes alarmas programadas.' };
      }
      if (has(/\b(que|cuales|mis)\s+alarmas\b/)) {
        const list = this.reminders.schedule.alarms;
        if (!list.length) return { text: 'No tienes alarmas programadas.' };
        return {
          text: `Tienes ${list.length === 1 ? 'una alarma' : `${list.length} alarmas`}:\n` + list.map(x => `- **${U.fmtTime(x.at)}** · ${x.label}${x.repeat && x.repeat !== 'none' ? ` (🔁 ${this.reminders.repeatLabel(x.repeat)})` : ''}`).join('\n'),
          actions: [{ label: 'Ver alarmas', view: 'notes' }]
        };
      }
      const repeat = parseRepeat(n);
      if (isAlarmWord || (repeat !== 'none' && parseClock(n))) {
        const clock = parseClock(n);
        if (clock) {
          // "Recuérdame llamar a mamá a las 3": de la tarde (despertar a las 3 sí sería de madrugada)
          if (!clock.explicit && clock.h >= 1 && clock.h <= 7 && has(/\b(recuerdame|recordarme|avisame|alertame)\b/) && !has(/\b(despiertame|despertador|levantame)\b/)) {
            clock.h += 12;
            clock.explicit = true;
          }
          const tomorrow = repeat === 'none' && /\bmanana\b/.test(n.replace(/de la manana/g, ''));
          const at = repeat !== 'none'
            ? this.reminders.ScheduleStore.nextOccurrence(clock.h, clock.m, repeat)
            : nextAlarmTime(clock, { tomorrow, wake: has(/\b(despiertame|despertador|levantame)\b/) });
          // Etiqueta: lo que viene después de la hora, o lo que hay entre el verbo y la hora
          const stripDay = (x) => x
            .replace(REPEAT_WORDS_RE, ' ')
            .replace(/\b(para\s+)?(hoy|manana|en la manana|en la noche|en la tarde)\b/g, ' ')
            .replace(/\s+/g, ' ').trim();
          let label = stripDay(clock.after).replace(/^(para|que|de|y|a)\s+/, '').trim();
          if (!label) {
            label = stripDay(clock.before
              .replace(/^(pon(me)?|programa(me)?|crea(me)?|agrega|configura|activa)?\s*((una|1)\s+)?(alarma|despertador)?\s*/, '')
              .replace(/^(despiertame|recuerdame|recordarme|avisame)\s*/, ''))
              .replace(/^(para|que|de)\s+/, '')
              .trim();
          }
          if (label) {
            // Recupera acentos y mayúsculas del texto original si es posible
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
            label = grab(new RegExp(`(${escaped})`, 'd')) || label;
          }
          label = label ? U.capitalize(label) : 'Alarma';
          const alarm = this.reminders.schedule.addAlarm(at, label, repeat);
          const isTomorrow = new Date(at).toDateString() !== new Date().toDateString();
          const repText = this.reminders.repeatLabel(repeat);
          return {
            text: sentence(`⏰ Alarma para las **${U.fmtTime(at)}**${repText ? ` · 🔁 ${repText}` : isTomorrow ? ' (mañana)' : ''}${label !== 'Alarma' ? ` · ${label}` : ''}`),
            speak: sentence(`Alarma programada para las ${U.fmtTime(at)}${repText ? `, ${repText.toLowerCase()}` : isTomorrow ? ' de mañana' : ''}`),
            effect: { type: 'REMINDER', id: alarm && alarm.id },
            actions: [
              { label: '📅 Que suene con la app cerrada', command: 'phone-alarm', value: { title: label, at: alarm ? alarm.at : at, repeat } },
              { label: 'Ver alarmas', view: 'notes' }
            ],
            sound: 'success'
          };
        }
        if (has(/\b(alarma|despertador)\b/)) {
          return { text: '¿A qué hora pongo la alarma? Por ejemplo: "alarma a las 6:30 de la mañana".' };
        }
      }

      /* ---------- Listas (compras, trabajo...) ---------- */
      const notes = this.reminders.notes;
      const listAdd = /^(?:agrega(?:me)?|agregar|anade|anademe|pon(?:me)?|mete|anota|apunta|suma|incluye)\s+(.+?)\s+(?:a|en)\s+(?:la\s+|mi\s+)?lista(?:\s+(?:de\s+(?:las\s+|la\s+|los\s+)?|del\s+)(.+))?$/d.exec(a);
      if (listAdd) {
        const raw = text.slice(listAdd.indices[1][0], listAdd.indices[1][1]);
        const listName = listAdd[2] ? text.slice(listAdd.indices[2][0], listAdd.indices[2][1]) : 'compras';
        const items = raw.split(/\s*,\s*|\s+y\s+|\s+e\s+/i).map(x => x.replace(/^(un|una|unos|unas|el|la|los|las)\s+/i, '').trim()).filter(Boolean);
        const target = notes.resolveList(listName);
        const added = notes.addMany(items, target);
        const already = items.length - added.length;
        return {
          text: added.length
            ? `🛒 Agregué a **${target}**: ${added.map(x => x.text).join(', ')}.${already ? ` (${already} ya estaba${already === 1 ? '' : 'n'})` : ''}`
            : `Eso ya está en la lista ${target}.`,
          actions: [{ label: `Ver lista ${target}`, command: 'open-list', value: target }],
          sound: 'success'
        };
      }
      const listRead = /(?:^|\b)(?:que\s+(?:hay|tengo|falta)\s+en|lee(?:me)?|dime|muestrame|ver|abre|revisa)?\s*(?:la\s+|mi\s+)?lista\s+(?:de\s+(?:las\s+|la\s+)?|del\s+)(.+)$/.exec(n);
      const listClear = has(/^(borra|vacia|limpia|elimina)\s+(toda\s+)?(la\s+|mi\s+)?lista\b/);
      if (listRead && (listClear || has(/^(que\s+(hay|tengo|falta)|lee|leeme|dime|muestrame|ver|abre|revisa|mi\s+lista|la\s+lista|lista)\b/))) {
        const target = notes.resolveList(listRead[1]);
        const items = notes.inList(target);
        if (listClear) {
          return {
            text: items.length ? `¿Borro los ${items.length} elementos de la lista **${target}**?` : `La lista ${target} ya está vacía.`,
            actions: items.length ? [{ label: 'Sí, vaciar lista', command: 'list-clear-confirmed', value: target, danger: true }] : []
          };
        }
        const pendingItems = items.filter(x => !x.done);
        if (!pendingItems.length) {
          return { text: `La lista **${target}** está vacía. Dime "agrega leche a la lista de ${target.toLowerCase()}".`, actions: [{ label: `Abrir ${target}`, command: 'open-list', value: target }] };
        }
        return {
          text: `🛒 **${target}** (${pendingItems.length}):\n` + pendingItems.slice(0, 15).map(x => `- ${x.text}`).join('\n'),
          speak: `En ${target} tienes: ${pendingItems.slice(0, 15).map(x => x.text).join(', ')}.`,
          actions: [{ label: `Abrir ${target}`, command: 'open-list', value: target }]
        };
      }

      /* ---------- Notas ---------- */
      if (has(/\b(lee|leeme|dime|cuales son|muestrame|ensename|ver|mostrar|abre|abrir)\s+(mis\s+|las\s+)?(notas|pendientes|recordatorios)\b/) || has(/\bque\s+(notas|pendientes|tareas)\s+tengo\b/) || has(/^mis (notas|pendientes)$/)) {
        const pending = notes.pending();
        const openIt = has(/^(abre|abrir|ver|mostrar|muestrame|ensename)\b/);
        const effect = openIt ? { type: 'OPEN_VIEW', view: 'notes' } : undefined;
        if (!pending.length) return { text: 'No tienes notas pendientes. 🎉', actions: [{ label: 'Abrir notas', view: 'notes' }], effect };
        const top = pending.slice(0, 7);
        return {
          effect,
          text: `Tienes ${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'}:\n` + top.map(x => `- ${x.text}`).join('\n') + (pending.length > top.length ? `\n- …y ${pending.length - top.length} más` : ''),
          speak: `Tienes ${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'}: ${top.map(x => x.text).join('. ')}.`,
          actions: [{ label: 'Abrir notas', view: 'notes' }]
        };
      }
      if (has(/\b(borra|elimina|limpia|quita)\s+(todas\s+)?(mis\s+|las\s+)?notas\b/) && !has(/\bnota\s+(de|que)\b/)) {
        if (!notes.items.length) return { text: 'No tienes notas que borrar.' };
        return {
          text: `¿Seguro que quieres borrar ${notes.items.length === 1 ? 'tu nota' : `tus ${notes.items.length} notas`}? Esto no se puede deshacer.`,
          actions: [{ label: 'Sí, borrar todas', command: 'notes-clear-all-confirmed', danger: true }]
        };
      }
      const doneQuery =
        grab(/^(?:marca|tacha|completa)\s+(?:como\s+(?:hecha|lista|completada)\s+)?(?:la\s+nota|la\s+tarea|el\s+pendiente)\s+(?:de\s+|que\s+dice\s+|del?\s+|sobre\s+)?(.+?)(?:\s+como\s+(?:hecha|lista|completada))?$/d) ||
        grab(/^(?:marca|tacha)\s+como\s+(?:hecha|lista|completada)\s+(?:la\s+(?:de\s+)?)?(.+)$/d) ||
        grab(/^(?:marca|tacha)\s+(?:la\s+de\s+)(.+?)\s+como\s+(?:hecha|lista|completada)$/d);
      const doneSoft = !doneQuery && grab(/^(?:ya\s+hice|termine|ya\s+compre)\s+(?:la\s+nota\s+de\s+|lo\s+de\s+)?(.+)$/d);
      if (doneSoft) {
        const note = notes.findByQuery(doneSoft);
        if (note && !note.done) {
          notes.toggle(note.id, true);
          return { text: `✅ ¡Bien ahí! Marqué como hecha: "${note.text}".` };
        }
      }
      if (doneQuery) {
        const note = notes.findByQuery(doneQuery);
        if (note) {
          notes.toggle(note.id, true);
          return { text: `✅ Marqué como hecha: "${note.text}".` };
        }
        return { text: `No encontré una nota sobre "${doneQuery}".`, actions: [{ label: 'Ver notas', view: 'notes' }] };
      }
      const delQuery = grab(/^(?:borra|elimina|quita)\s+la\s+nota\s+(?:de\s+|que\s+dice\s+|del?\s+|sobre\s+)?(.+)$/d);
      if (delQuery) {
        const note = notes.findByQuery(delQuery);
        if (note) {
          notes.remove(note.id);
          return { text: `🗑️ Borré la nota "${note.text}".` };
        }
        return { text: `No encontré una nota sobre "${delQuery}".` };
      }
      const noteText = grab(/^(?:anota(?:me)?|apunta(?:me)?|toma\s+nota(?:\s+de)?|(?:agrega|agregar|anade|crea|crear|guarda|guardar|pon|nueva)\s+(?:una\s+)?(?:nota|tarea|pendiente)(?:\s+que\s+dice)?|nota|recuerdame|recordarme|no\s+me\s+dejes\s+olvidar)\s*:?\s+(?:que\s+)?(.{2,})$/d);
      if (noteText) {
        const note = notes.add(U.capitalize(noteText));
        return {
          text: `📝 Anotado: "${note.text}".`,
          actions: [{ label: 'Ver notas', view: 'notes' }],
          sound: 'success'
        };
      }

      /* ---------- Contactos ---------- */
      const saveContact = /^(?:guarda|agrega|anade|registra|nuevo)\s+(?:el\s+|un\s+)?(?:contacto|numero)\s+(?:de\s+)?(.+?)\s+(?:con\s+el\s+)?(?:numero|telefono|tlf|cel|celular)?\s*:?\s*(\+?[\d][\d\s-]{6,})$/d.exec(a);
      if (saveContact) {
        const cName = text.slice(saveContact.indices[1][0], saveContact.indices[1][1]).trim();
        const phone = saveContact[2].replace(/[^\d+]/g, '');
        this.saveContact(cName, phone);
        return { text: `📇 Guardé a **${U.capitalize(cName)}** con el número ${phone}.`, effect: { type: 'CONTACTS' } };
      }

      /* ---------- Llamadas ---------- */
      if (has(/^(llama|llamar|llamame|marca|marcar|telefonea)\b/) || has(/\bhaz(me)?\s+una\s+llamada\b/)) {
        if (has(/\b(emergencia|policia|ambulancia|bomberos|911|171)\b/)) {
          return { text: 'Para emergencias en Venezuela marca **911** (o 171). Toca el botón para llamar.', actions: [{ label: '📞 Llamar al 911', url: 'tel:911' }] };
        }
        const digits = wordsToDigits(n).match(/(\+?\d[\d\s-]{5,}\d)/);
        if (digits) {
          const num = digits[1].replace(/[\s-]/g, '');
          return { text: `Llamando al ${num}…`, actions: [{ label: `📞 Llamar al ${num}`, url: `tel:${num}` }], effect: { type: 'OPEN_URL', url: `tel:${num}` } };
        }
        const who = grab(/^(?:llama|llamar|llamame|marca|marcar|telefonea|hazme\s+una\s+llamada|haz\s+una\s+llamada)\s+(?:a\s+|al\s+)?(?:mi\s+)?(.+)$/d);
        if (who) return this.callContact(who);
        return { text: '¿A quién llamo? Di por ejemplo "llama a mamá" o un número.' };
      }

      /* ---------- WhatsApp ---------- */
      if (has(/\b(whatsapp|wasap|guasap|whats|wsp)\b/)) {
        return this.whatsappIntent(text, a, n);
      }

      /* ---------- Traductor y dictado ---------- */
      const tr = /^(?:traduce(?:me)?|traducir|como\s+se\s+dice)\s+(?:(?:esto|esta\s+frase|lo\s+siguiente)\s+)?(?:al?\s+)?(ingles|espanol|portugues|frances|italiano|aleman)\s*:?\s+([\s\S]{2,})$/d.exec(a) ||
        /^(?:como\s+se\s+dice|traduce(?:me)?)\s+([\s\S]{2,}?)\s+(?:en|al)\s+(ingles|espanol|portugues|frances|italiano|aleman)$/d.exec(a);
      if (tr) {
        const langFirst = LANG_WORDS[tr[1]] !== undefined;
        const lang = LANG_WORDS[langFirst ? tr[1] : tr[2]];
        const g = langFirst ? 2 : 1;
        const phrase = text.slice(tr.indices[g][0], tr.indices[g][1]).trim().replace(/^["“]+|["”]+$/g, '');
        const out = await this.translate(phrase, lang);
        if (!out) return { text: '⚠️ No pude traducir ahora mismo. Revisa tu conexión.', error: true };
        return {
          text: `🌐 **${LANGS[lang][0].toUpperCase() + LANGS[lang].slice(1)}:** ${out}`,
          speak: out,
          speakLang: lang,
          actions: [{ label: 'Copiar', command: 'copy', value: out }, { label: 'Abrir traductor', command: 'open-tool', value: 'translate' }]
        };
      }
      if (has(/\b(abre|abrir|activa|usa)?\s*(el\s+)?(traductor|modo traductor|traductor de voz)\b/) && n.split(' ').length <= 5) {
        return { text: 'Abriendo el traductor de voz.', effect: { type: 'OPEN_TOOL', tool: 'translate' } };
      }
      if (has(/\b(modo dictado|quiero dictar|voy a dictar|dictado|dictar un texto|abre el dictado)\b/)) {
        return { text: 'Abriendo el dictado. Habla y yo escribo; di "punto", "coma" o "nueva línea".', effect: { type: 'OPEN_TOOL', tool: 'dictation' } };
      }

      /* ---------- Pago Móvil ---------- */
      const PM = root.YarbisPagoMovil;
      if (PM && has(/\b(pago movil|mis datos de pago|datos bancarios|mis datos para que me paguen)\b/) && !has(/^(abre|abrir)\s+pago movil$/) || PM && has(/^(cobrale|cobra|cobrar|cobrarle|pidele|pedirle)\b/)) {
        const data = PM.get();
        if (!data) {
          return { text: 'Todavía no has guardado tus datos de Pago Móvil. Ábrelo y guárdalos una vez.', actions: [{ label: 'Configurar Pago Móvil', command: 'open-tool', value: 'pagomovil' }] };
        }
        const charge = n.match(/^(?:cobrale|cobra|cobrar|cobrarle|pidele|pedirle)\s+(\$?\s?\d[\d.,]*)\s*(dolares?|usd|\$|bolivares?|bs|bolos?)?\s*(?:a|al)\s+(?:mi\s+)?([a-z ]{2,40})$/) ||
          n.match(/^(?:cobrale|cobra|cobrar|cobrarle|pidele|pedirle)\s+(?:a|al)\s+(?:mi\s+)?([a-z ]{2,40}?)\s+(\$?\s?\d[\d.,]*)\s*(dolares?|usd|\$|bolivares?|bs|bolos?)?$/);
        let amountUsd = null;
        let amountBs = null;
        let who = '';
        if (charge) {
          const first = /\d/.test(charge[1]);
          const num = U.parseNumber((first ? charge[1] : charge[2]).replace('$', ''));
          const cur = first ? charge[2] : charge[3];
          who = (first ? charge[3] : charge[1]).trim();
          const rate = this.finance.getRates().bcv;
          if (cur && /^(bolivares?|bs|bolos?)$/.test(cur)) { amountBs = num; amountUsd = num / rate; }
          else { amountUsd = num; amountBs = num * rate; }
        }
        const message = PM.message({ amountUsd, amountBs });
        let url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        if (who) {
          const found = this.findContacts(who);
          if (found.length) url = `https://wa.me/${venezuelanPhone(found[0].phone)}?text=${encodeURIComponent(message)}`;
        }
        return {
          text: `${who ? `💰 Cobro para **${U.capitalize(who)}**:` : '📲 Tus datos de Pago Móvil:'}\n\n${message.replace(/\*/g, '**')}`,
          speak: who ? `Listo, mensaje de cobro para ${who}${amountBs ? ` por ${U.fmtNumber(amountBs, 2)} bolívares` : ''}.` : 'Aquí tienes tus datos de Pago Móvil.',
          actions: [
            { label: '💬 Enviar por WhatsApp', url },
            { label: 'Compartir', command: 'pm-share', value: { amountUsd, amountBs } },
            { label: 'Copiar', command: 'copy', value: message.replace(/\*/g, '') }
          ]
        };
      }
      if (has(/^(abre|abrir|configura|configurar)\s+(el\s+)?pago movil$/)) {
        return { text: 'Abriendo Pago Móvil.', effect: { type: 'OPEN_TOOL', tool: 'pagomovil' } };
      }

      /* ---------- Dinero: conversiones ---------- */
      const conversion = await this.conversionIntent(n);
      if (conversion) return conversion;

      // Preguntas de opinión sobre dinero ("¿me conviene…?", "¿compro bitcoin?") van al
      // cerebro con clave, que consulta los datos y razona; sin clave responde la plantilla.
      const deferToBrain = !opts.noDefer && this.brainOrder().length > 0 && this.isAdviceQuestion(n);
      if (!deferToBrain) {
        /* ---------- Bolsa de valores ---------- */
        const stocks = await this.stocksIntent(n);
        if (stocks) return stocks;

        /* ---------- Tasas del dólar / euro ---------- */
        if (this.isRateQuestion(n)) {
          return this.ratesIntent(n);
        }

        /* ---------- Criptomonedas ---------- */
        const cryptoMatch = n.match(/\b(bitcoin|btc|ethereum|eth|ether|solana|bnb|binance coin|xrp|ripple|cripto|criptos|criptomonedas?)\b/);
        if (cryptoMatch && !KNOWLEDGE_RE.test(n)) {
          return this.cryptoIntent(cryptoMatch[1]);
        }
      }

      /* ---------- Matemáticas ---------- */
      const math = this.math.evaluateNatural(n);
      if (math) {
        return { text: `🧮 ${math.expression} = **${math.formatted}**`, speak: `El resultado es ${math.formatted}.` };
      }

      /* ---------- Clima ---------- */
      if (has(/\b(clima|temperatura|pronostico|va a llover|esta lloviendo|llueve|lluvia|hace calor|hace frio|tiempo hace|hara buen tiempo|el tiempo (en|de|para|hoy|manana))\b/)) {
        return this.weatherIntent(n);
      }

      /* ---------- Navegación GPS ---------- */
      const dest = grab(/^(?:como\s+(?:llego|llegar|voy|ir)\s+(?:a|al|hasta)|ruta\s+(?:a|al|hacia|para)|llevame\s+(?:a|al)|navega(?:r)?\s+(?:a|al|hacia)|direccion\s+(?:a|al|de|del|hacia)|ir\s+(?:a|al))\s+(.+)$/d);
      if (dest) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
        return {
          text: `🗺️ Ruta hacia **${dest}**.`,
          actions: [
            { label: 'Abrir en Google Maps', url },
            { label: 'Abrir en Waze', url: `https://waze.com/ul?q=${encodeURIComponent(dest)}&navigate=yes` }
          ],
          effect: { type: 'OPEN_URL', url }
        };
      }

      /* ---------- Cámara / escáner ---------- */
      if (has(/\b(qr|codigo de barras|escanea(r)? (un |el |este )?codigo)\b/)) {
        return { text: 'Abriendo el lector de códigos QR…', effect: { type: 'OPEN_CAMERA', mode: 'qr' } };
      }
      if (has(/\b(traduce|traducir)\b.*\b(letrero|cartel|foto|imagen|texto de la camara|menu)\b/)) {
        return { text: 'Abriendo la cámara en modo traductor…', effect: { type: 'OPEN_CAMERA', mode: 'translate' } };
      }
      if (has(/\b(escanea(r)?|digitaliza(r)?|lee(r)?)\b.*\b(documento|factura|recibo|papel)\b/)) {
        return { text: 'Abriendo la cámara en modo documento…', effect: { type: 'OPEN_CAMERA', mode: 'document' } };
      }
      if (has(/\b(abre|abrir|activa|usa|enciende)\s+(la\s+)?(camara|vision|escaner)\b/) || has(/^(camara|escaner|que es esto|que estoy viendo)$/)) {
        return { text: 'Abriendo la cámara…', effect: { type: 'OPEN_CAMERA', mode: 'general' } };
      }

      /* ---------- Purificador de texto ---------- */
      const toClean = grab(/^(?:limpia|purifica|desinfecta|sanitiza|quita\s+las\s+marcas\s+de(?:\s+agua)?\s+de)\s+(?:este\s+)?texto\s*:\s*([\s\S]{5,})$/d);
      if (toClean && root.YarbisCleaner) {
        const res = root.YarbisCleaner.clean(toClean, { humanize: true });
        return { text: `🧹 Texto limpio (${res.stats.invisible} caracteres invisibles eliminados):\n\n${res.text}`, speak: 'Listo, aquí tienes el texto limpio.' };
      }
      if (has(/\b(purificador|marcas de agua|anti marcas|limpiar texto|limpia texto|limpiador de texto)\b/)) {
        return { text: 'Abriendo el purificador de texto. Pega ahí el texto a limpiar.', effect: { type: 'OPEN_VIEW', view: 'cleaner' } };
      }

      /* ---------- Linterna y batería ---------- */
      if (has(/\b(linterna|flash|luz del telefono)\b/)) {
        const off = has(/\b(apaga|apagar|desactiva|quita)\b/);
        return { text: off ? 'Apagando la linterna.' : 'Encendiendo la linterna (si tu teléfono lo permite).', effect: { type: 'TORCH', on: !off } };
      }
      if (has(/\b(bateria|cuanta carga|nivel de carga)\b/)) {
        return this.batteryIntent();
      }

      /* ---------- Temas ---------- */
      if (has(/\b(modo|tema)\s+(oscuro|noche|negro)\b/)) return { text: 'Modo oscuro activado. 🌙', effect: { type: 'THEME', mode: 'dark' } };
      if (has(/\b(modo|tema)\s+(claro|dia|blanco)\b/)) return { text: 'Modo claro activado. ☀️', effect: { type: 'THEME', mode: 'light' } };
      if (has(/\b(tema|color|protocolo|modo)\b/)) {
        for (const [accent, words] of Object.entries(ACCENTS)) {
          if (words.some(w => new RegExp(`\\b${w}\\b`).test(n))) {
            return { text: `Tema ${ACCENT_NAMES[accent]} activado.`, effect: { type: 'THEME', accent }, sound: 'success' };
          }
        }
      }

      /* ---------- Juegos y humor ---------- */
      if (has(/\b(trivia|juego de preguntas|preguntame algo)\b/)) {
        this.trivia = { index: 0, score: 0, order: TRIVIA.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 5) };
        return { text: `🎲 ¡Trivia venezolana! Son 5 preguntas. Di "salir" para terminar.\n\n**Pregunta 1:** ${TRIVIA[this.trivia.order[0]].q}` };
      }
      if (has(/\bpiedra,? papel( o|,)? tijeras?\b/) && !has(/^(piedra|papel|tijeras?)$/)) {
        return { text: '¡Dale! Di "piedra", "papel" o "tijera".' };
      }
      if (has(/^(piedra|papel|tijeras?)$/)) {
        return this.rps(n.startsWith('tijera') ? 'tijera' : n);
      }
      if (has(/\b(chiste|algo gracioso|hazme reir)\b/)) {
        return { text: pick(JOKES) };
      }
      if (has(/\b(lanza|tira)\s+(una\s+)?moneda\b|\bcara o sello\b/)) {
        return { text: `🪙 ¡${Math.random() < 0.5 ? 'Cara' : 'Sello'}!` };
      }
      if (has(/\b(lanza|tira)\s+(un\s+)?dado\b/)) {
        return { text: `🎲 Salió **${1 + Math.floor(Math.random() * 6)}**.` };
      }

      /* ---------- Música ---------- */
      const ytQuery = grab(/^(?:busca(?:me)?|buscar|pon(?:me)?|reproduce|ver)\s+(.+?)\s+en\s+youtube$/d);
      if (ytQuery) return this.openUrlResponse(`Buscando "${ytQuery}" en YouTube.`, `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`, 'Abrir YouTube');
      const music = grab(/^(?:pon(?:me)?|reproduce|reproducir|toca|quiero\s+escuchar)\s+(?:musica\s+de\s+|la\s+cancion\s+|el\s+tema\s+|canciones\s+de\s+)?(.+?)(?:\s+en\s+spotify)?$/d);
      if (music && !/^(un|una|el|la)\s+(alarma|temporizador|timer|nota|tema|modo)\b/.test(align(music))) {
        return this.openUrlResponse(`🎵 Buscando "${music}" en Spotify.`, `https://open.spotify.com/search/${encodeURIComponent(music)}`, 'Abrir Spotify', [
          { label: 'Buscar en YouTube', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(music)}` }
        ]);
      }

      /* ---------- Abrir apps y secciones ---------- */
      const target = grab(/^(?:abre|abrir|abreme|lanza|inicia|entra\s+a|entrar\s+a|ve\s+a|vamos\s+a|muestrame)\s+(?:la\s+app\s+de\s+|la\s+aplicacion\s+de\s+|la\s+pagina\s+de\s+|el\s+|la\s+|mi\s+)?(.+)$/d);
      if (target) {
        const t = U.normalize(target);
        const view = VIEWS.find(v => v.keys.some(k => t === k || t.startsWith(k + ' ')));
        if (view) return { text: `Abriendo ${view.name}.`, effect: { type: 'OPEN_VIEW', view: view.view } };
        const app = APPS.find(ap => ap.keys.some(k => new RegExp(`^${k}\\b`).test(t)));
        if (app) return this.openUrlResponse(`Abriendo ${app.name}…`, app.url, `Abrir ${app.name}`);
        if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(t.replace(/\s/g, ''))) {
          const url = `https://${t.replace(/\s/g, '')}`;
          return this.openUrlResponse(`Abriendo ${url}…`, url, 'Abrir página');
        }
        const store = root.YarbisApps ? root.YarbisApps.storeSearch(target) : `https://play.google.com/store/search?q=${encodeURIComponent(target)}&c=apps`;
        return {
          text: `No tengo un acceso directo para "${target}". Puedo buscarla en la tienda de apps o en Google.`,
          actions: [
            { label: `Buscar "${target}" en la tienda`, url: store },
            { label: 'Buscar en Google', url: `https://www.google.com/search?q=${encodeURIComponent(target)}` }
          ]
        };
      }

      /* ---------- Búsquedas ---------- */
      const search = grab(/^(?:busca(?:me)?|buscar|googlea|investiga)\s+(?:en\s+google\s+)?(.+?)(?:\s+en\s+google)?$/d);
      if (search) {
        return this.openUrlResponse(`🔎 Buscando "${search}" en Google.`, `https://www.google.com/search?q=${encodeURIComponent(search)}`, 'Ver resultados');
      }

      /* ---------- Wikipedia (respaldo rápido antes de la IA) ---------- */
      const topic = grab(/^(?:quien\s+es|quien\s+fue|que\s+es|que\s+fue|que\s+son|que\s+significa|hablame\s+de|cuentame\s+(?:sobre|de)|informacion\s+sobre)\s+(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?(.{3,60})$/d);
      if (topic && !this.hasAI()) {
        const wiki = await this.wikipedia(topic);
        if (wiki) return wiki;
      }

      return null;
    }

    hasAI() {
      return !!this.geminiApiKey || (root.navigator ? root.navigator.onLine !== false : true);
    }

    helpResponse() {
      return {
        text: [
          '**Esto es lo que puedo hacer:**',
          '- 💵 "¿A cómo está el dólar?" · "100 dólares a bolívares" · "5000 bs a dólares a tasa paralela"',
          '- 🧮 "¿Cuánto es 15% de 340?" · "raíz cuadrada de 81"',
          '- ⏱️ "Temporizador de 10 minutos" · "Recuérdame en 20 minutos sacar la pizza"',
          '- ⏰ "Alarma a las 6:30 de la mañana" · "Despiértame de lunes a viernes a las 6"',
          '- 🛒 "Agrega leche y huevos a la lista de compras" · "¿Qué hay en la lista de compras?"',
          '- 💸 "Gasté 20 dólares en comida" · "¿Cuánto he gastado este mes?"',
          '- 💰 "Me regalaron 20 dólares" · "Me pagaron el sueldo, 300 dólares" · "¿Cuánto me queda este mes?"',
          '- 📈 "¿Cómo está la bolsa de Caracas?" · "¿Qué acciones me recomiendas comprar?" · "¿Cómo está Apple?"',
          '- 🔔 "Avísame cuando el dólar pase de 250"',
          '- 📲 "Comparte mis datos de pago móvil" · "Cóbrale 10 dólares a Carlos"',
          '- 🌐 "Traduce al inglés: ¿dónde queda el baño?" · 🎙️ "Modo dictado"',
          '- 🔗 Puedes encadenar: "pon un timer de 5 minutos y anota comprar pan"',
          '- 📝 "Anota comprar harina PAN" · "Lee mis notas" · "Marca como hecha la de harina"',
          '- 🌦️ "¿Cómo está el clima en Maracaibo?" · "¿Va a llover mañana?"',
          '- 📞 "Llama a mamá" · "Manda un WhatsApp a Carlos que diga ya voy"',
          '- 🗺️ "Cómo llego al Sambil" · 🎵 "Pon salsa baúl"',
          '- 📷 "Escanea un QR" · "Traduce este letrero"',
          '- 💬 Y cualquier pregunta: te respondo con IA y recuerdo la conversación.'
        ].join('\n'),
        speak: 'Puedo darte la tasa del dólar, convertir montos, calcular, poner temporizadores y alarmas, tomar notas, darte el clima, llamar, enviar WhatsApp, escanear códigos QR y responder cualquier pregunta.'
      };
    }

    openUrlResponse(text, url, label, extraActions = []) {
      return { text, actions: [{ label, url }, ...extraActions], effect: { type: 'OPEN_URL', url } };
    }

    /* ------------------------------------------
       DINERO
       ------------------------------------------ */
    currencyCode(word) {
      const w = String(word || '').trim();
      const found = CURRENCY_WORDS.find(c => c.re.test(w));
      return found ? found.code : null;
    }

    async conversionIntent(n) {
      const s = wordsToDigits(n).replace(/(\d)\s+mil\b/g, (m, d) => `${d}000`).replace(/\bmil\b/g, '1000');
      const amountRe = '(\\$?\\s?\\d[\\d.,]*)\\s*(mil(?:es)?\\s+)?(?:de\\s+)?';
      let m = s.match(new RegExp(`${amountRe}(${CURRENCY_ALT.slice(3, -1)})(?=\\s|$)`));
      if (!m) {
        const dollar = s.match(/\$\s?(\d[\d.,]*)/);
        if (!dollar) return null;
        m = [dollar[0], dollar[1], '', 'usd'];
        m.index = dollar.index;
      }

      // Debe parecer una conversión, no "tengo 3 dólares de deuda" dentro de otra cosa
      const isQuestion = /\b(cuanto|cuantos|cuanta|convierte|convertir|pasa|pasame|equivale|equivalen|son|serian|al cambio)\b/.test(s) ||
        new RegExp(`\\b(a|en|para)\\s+(cuantos?\\s+)?(${CURRENCY_ALT.slice(3, -1)})(?=\\s|$)`).test(s.slice(m.index + m[0].length)) ||
        s.trim().split(/\s+/).length <= 3;
      // "préstamo de 1000 dólares al 10 %", "quiero ahorrar 100 dólares", "gasté 5 dólares": no es una conversión
      if (!isQuestion || /\b(prestamo|interes|intereses|cuota|cuotas|ahorrar|ahorro|gaste|pague|compre|me compre|vendi|me pagaron|me regalaron|debo|deuda|presupuesto)\b/.test(s)) return null;

      let amount = parseAmount(m[1].replace('$', ''));
      if (amount === null) return null;
      if (m[2]) amount *= 1000;
      let from = this.currencyCode(m[3]);
      if (m[1].includes('$') && !from) from = 'USD';
      if (!from) return null;

      const rest = s.slice(m.index + m[0].length);
      const toMatch = rest.match(new RegExp(`\\b(?:a|en|para|por)\\s+(?:cuantos?\\s+)?(${CURRENCY_ALT.slice(3, -1)})(?=\\s|$)`));
      let to = toMatch ? this.currencyCode(toMatch[1]) : null;
      if (!to || to === from) to = from === 'VES' ? 'USD' : 'VES';

      const parallel = /\b(paralelo|paralela|monitor|binance|usdt|calle|p2p)\b/.test(s);
      const rates = await this.finance.ensureFresh(10 * 60 * 1000);
      const meta = this.finance.statusLabel(rates.fx);
      const F = this.finance;

      const fromCode = from === 'VES' ? (parallel ? 'VES_PAR' : 'VES_BCV') : from;
      const toCode = to === 'VES' ? (parallel ? 'VES_PAR' : 'VES_BCV') : to;
      const result = F.convert(amount, fromCode, toCode, rates);
      if (result === null) return null;

      const fromLabel = from === 'VES' ? U.fmtBs(amount) : F.format(amount, fromCode);
      let text = `💱 **${fromLabel} = ${F.format(result, toCode)}**`;
      let speak = `${fromLabel.replace('Bs.', '')} ${from === 'VES' ? 'bolívares' : ''} son ${F.format(result, toCode).replace('Bs.', '')} ${to === 'VES' ? 'bolívares' : ''}`;

      if (from === 'VES' || to === 'VES') {
        const other = parallel ? 'BCV' : 'paralela';
        const otherFrom = from === 'VES' ? (parallel ? 'VES_BCV' : 'VES_PAR') : fromCode;
        const otherTo = to === 'VES' ? (parallel ? 'VES_BCV' : 'VES_PAR') : toCode;
        const alt = F.convert(amount, otherFrom, otherTo, rates);
        text += ` (tasa ${parallel ? 'paralela' : 'BCV'})\n- A tasa ${other}: ${F.format(alt, otherTo)}`;
        text += `\n- BCV ${U.fmtBs(rates.bcv)} · Paralelo ${U.fmtBs(rates.paralelo)}`;
        speak += parallel ? ' a tasa paralela.' : ' a tasa BCV.';
      }
      text += `\n\n_${meta}_`;
      return {
        text,
        speak: speak.replace(/\s+/g, ' ').trim(),
        actions: [{ label: 'Abrir convertidor', view: 'finance' }]
      };
    }

    /* ------------------------------------------
       FUNCIONES DEL TELÉFONO
       ------------------------------------------ */
    async phoneIntent(text, a, n) {
      // Calendario: "agenda reunión con Pedro mañana a las 3 pm"
      const cal = /^(?:agenda(?:me)?|agendar|anota\s+en\s+(?:el|mi)\s+calendario|pon(?:me)?\s+en\s+(?:el|mi)\s+calendario|crea(?:r)?\s+(?:un\s+)?evento(?:\s+de)?|programa(?:r)?\s+(?:una\s+)?(?=reunion|cita))\s*:?\s+([\s\S]{3,})$/d.exec(a);
      if (cal) return this.calendarResponse(text.slice(cal.indices[1][0]), U.normalize(text.slice(cal.indices[1][0])));

      // Correo: "manda un correo a ana@x.com con asunto informe"
      const mail = /^(?:manda(?:le)?|envia(?:le)?|escribe(?:le)?)\s+(?:un\s+)?(?:correo|email|e-mail|mail)\s+(?:a|al|para)\s+([^\s]+@[^\s]+)(?:\s+(?:con\s+(?:el\s+)?asunto|que\s+diga|diciendo|sobre)\s+([\s\S]+))?$/d.exec(a);
      if (mail) {
        const to = text.slice(mail.indices[1][0], mail.indices[1][1]);
        const subject = mail[2] ? text.slice(mail.indices[2][0], mail.indices[2][1]) : '';
        const url = `mailto:${to}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
        return { text: `✉️ Correo para **${to}**${subject ? ` · asunto "${subject}"` : ''}.`, actions: [{ label: 'Abrir correo', url }], effect: { type: 'OPEN_URL', url } };
      }

      // SMS o mensaje: "mándale un mensaje de texto a mamá que diga ya llegué"
      const msgM = /^(?:manda(?:le)?|envia(?:le)?|escribe(?:le)?)\s+(?:un\s+)?(sms|mensaje\s+de\s+texto|mensajito|mensaje)\s+(?:a|al|para)\s+(?:mi\s+)?(.+?)\s+(?:que\s+diga|diciendo|:)\s*([\s\S]+)$/d.exec(a);
      if (msgM) {
        const who = text.slice(msgM.indices[2][0], msgM.indices[2][1]).trim();
        const body = text.slice(msgM.indices[3][0], msgM.indices[3][1]).trim();
        const digits = who.replace(/[^\d+]/g, '');
        const found = digits.length >= 7 ? [{ name: who, phone: digits }] : this.findContacts(who);
        if (!found.length) {
          return { text: `No tengo el número de ${U.capitalize(who)}. Guárdalo en Ajustes o di "guarda el contacto ${who} 0414 1234567".`, actions: [{ label: 'Abrir agenda', view: 'settings' }] };
        }
        const num = found[0].phone;
        const sms = root.YarbisApps ? root.YarbisApps.smsUrl(num, body) : `sms:${num}?body=${encodeURIComponent(body)}`;
        const wa = `https://wa.me/${venezuelanPhone(num)}?text=${encodeURIComponent(body)}`;
        const isSms = msgM[1] !== 'mensaje';
        return {
          text: `${isSms ? '💬 SMS' : '💬 Mensaje'} para **${U.capitalize(found[0].name)}**: "${body}".`,
          actions: isSms
            ? [{ label: 'Enviar SMS', url: sms }, { label: 'Mejor por WhatsApp', url: wa }]
            : [{ label: 'Enviar por WhatsApp', url: wa }, { label: 'Enviar por SMS', url: sms }],
          effect: { type: 'OPEN_URL', url: isSms ? sms : wa }
        };
      }

      // Ubicación
      if (has(n, /\b(donde estoy|mi ubicacion|en que (ciudad|lugar|sitio|parte) estoy|ubicame|cual es mi direccion)\b/) && !has(n, /\b(comparte|compartir|manda|envia)\b/)) {
        return this.whereAmI();
      }
      const shareLoc = /\b(?:comparte|compartir|manda|mandale|envia|enviale)\s+(?:mi\s+)?ubicacion(?:\s+(?:a|con|al)\s+(?:mi\s+)?([a-z ]{2,40}))?/.exec(n);
      if (shareLoc) return this.shareLocation(shareLoc[1]);
      const near = n.match(/^(?:busca(?:me)?|buscar|donde\s+hay|hay|encuentra(?:me)?|muestrame)?\s*(?:una?s?\s+|el\s+|la\s+|los\s+|las\s+)?(.{3,40}?)\s+(?:cerca(?:\s+de\s+(?:mi|aqui|donde\s+estoy))?|por\s+aqui|cercan[oa]s?)$/);
      if (near && !/\b(alarma|nota|temporizador)\b/.test(near[1])) return this.nearby(near[1]);
      return null;
    }

    calendarResponse(raw, n, forcedDate = null) {
      const day = forcedDate ? { date: forcedDate } : parseDay(n);
      const clock = parseClock(n);
      const date = day ? day.date : new Date(new Date().setHours(0, 0, 0, 0));
      let start = null;
      if (clock) {
        start = new Date(date);
        let h = clock.h;
        if (!clock.explicit && h >= 1 && h <= 7) h += 12; // "a las 3" casi siempre es de la tarde
        start.setHours(h, clock.m, 0, 0);
        if (!day && start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
      }
      const title = U.capitalize(raw
        .replace(/\ba\s+las?\s+\d{1,2}([:.h]\d{2})?(\s+y\s+(media|cuarto))?(\s*(a\.?\s*m\.?|p\.?\s*m\.?|de\s+la\s+(mañana|tarde|noche)))?/gi, ' ')
        .replace(/\b(pasado\s+)?mañana\b|\bhoy\b/gi, ' ')
        .replace(/\b(el\s+)?(pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(\s+que\s+viene)?\b/gi, ' ')
        .replace(/\b(el\s+)?\d{1,2}\s+de\s+[a-záéíóú]+\b/gi, ' ')
        .replace(/\ba\s+las?\s+\d{1,2}([:.h]\d{2})?(\s+y\s+(media|cuarto))?(\s*(a\.?\s*m\.?|p\.?\s*m\.?|de\s+la\s+(mañana|tarde|noche)))?/gi, ' ')
        .replace(/\bal\s+mediod[ií]a\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^(para|de|que|una?|el|la)\s+/i, '')
        .trim()) || 'Evento';
      const pad = (x) => String(x).padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const fmtT = (d) => `${fmt(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
      let dates;
      let end;
      if (start) {
        end = new Date(start.getTime() + 3600000);
        dates = `${fmtT(start)}/${fmtT(end)}`;
      } else {
        const next = new Date(date.getTime() + 86400000);
        dates = `${fmt(date)}/${fmt(next)}`;
      }
      const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&ctz=America/Caracas`;
      const when = start
        ? start.toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }) + ' (todo el día)';
      const actions = [
        { label: '📅 Agregar al calendario', url: gcal },
        { label: 'Descargar evento (.ics)', command: 'ics', value: { title, start: (start || date).getTime(), end: start ? end.getTime() : date.getTime() + 86400000, allDay: !start } }
      ];
      if (start && start.getTime() - 30 * 60000 > Date.now()) {
        actions.push({ label: 'Avisarme 30 min antes', command: 'alarm-at', value: { at: start.getTime() - 30 * 60000, label: title } });
      }
      return { text: sentence(`📅 **${title}** · ${when}`), speak: sentence(`Listo: ${title}, ${when}`), actions };
    }

    getPosition() {
      return new Promise((resolve, reject) => {
        const geo = root.navigator && root.navigator.geolocation;
        if (!geo) { reject(new Error('Tu navegador no permite saber la ubicación.')); return; }
        geo.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
          (e) => reject(new Error(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en el navegador.' : 'No pude obtener tu ubicación.')),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60000 });
      });
    }

    async reverseGeocode(lat, lon) {
      try {
        const d = await this.fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es&zoom=17`, 7000, 1);
        const ad = (d && d.address) || {};
        const parts = [ad.road, ad.suburb || ad.neighbourhood, ad.city || ad.town || ad.village || ad.municipality, ad.state].filter(Boolean);
        return { label: parts.join(', ') || d.display_name || '', city: ad.city || ad.town || ad.village || ad.state || '' };
      } catch (e) {
        return { label: '', city: '' };
      }
    }

    async whereAmI() {
      try {
        const p = await this.getPosition();
        const place = await this.reverseGeocode(p.lat, p.lon);
        const maps = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
        if (place.city) S.setRaw('yarbis_weather_city', place.city);
        return {
          text: `📍 ${place.label ? `Estás en **${place.label}**` : `Tu ubicación: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`} (precisión ~${Math.round(p.acc)} m).`,
          actions: [{ label: 'Ver en el mapa', url: maps }, { label: 'Compartir por WhatsApp', url: `https://wa.me/?text=${encodeURIComponent(`📍 Estoy aquí: ${maps}`)}` }]
        };
      } catch (e) {
        return { text: `📍 ${e.message}` };
      }
    }

    async shareLocation(who) {
      try {
        const p = await this.getPosition();
        const maps = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
        const msg = `📍 Mi ubicación: ${maps}`;
        let url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        let name = '';
        if (who) {
          const found = this.findContacts(who);
          if (found.length) {
            url = `https://wa.me/${venezuelanPhone(found[0].phone)}?text=${encodeURIComponent(msg)}`;
            name = U.capitalize(found[0].name);
          }
        }
        return { text: `📍 Ubicación lista para enviar${name ? ` a **${name}**` : ''}.`, actions: [{ label: 'Enviar por WhatsApp', url }, { label: 'Ver en el mapa', url: maps }], effect: { type: 'OPEN_URL', url } };
      } catch (e) {
        return { text: `📍 ${e.message}` };
      }
    }

    async nearby(what) {
      const q = what.replace(/^(una?s?|el|la|los|las)\s+/, '').trim();
      let url = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
      try {
        const p = await Promise.race([this.getPosition(), new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 6000))]);
        url = `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${p.lat},${p.lon},15z`;
      } catch (e) { /* Maps usará la ubicación del teléfono */ }
      return { text: `🗺️ Buscando **${q}** cerca de ti.`, actions: [{ label: 'Abrir en Maps', url }, { label: 'Abrir en Waze', url: `https://waze.com/ul?q=${encodeURIComponent(q)}` }], effect: { type: 'OPEN_URL', url } };
    }

    /* ------------------------------------------
       GASTOS
       ------------------------------------------ */
    /* ------------------------------------------
       INGRESOS Y BALANCE (ligados a los gastos)
       ------------------------------------------ */
    // "Este mes: entró $X, salió $Y → te quedan $Z"
    balanceLine() {
      const X = root.YarbisExpenses;
      if (!X || !X.balance) return '';
      const b = X.balance();
      if (!b.incomeUsd && !b.expenseUsd) return '';
      const left = b.balanceUsd >= 0 ? `te quedan **${U.fmtUsd(b.balanceUsd)}**` : `gastaste **${U.fmtUsd(-b.balanceUsd)}** más de lo que entró`;
      return `Este mes: entró ${U.fmtUsd(b.incomeUsd)}, salió ${U.fmtUsd(b.expenseUsd)} → ${left}${b.bcv ? ` (≈ ${U.fmtBs(Math.abs(b.balanceUsd) * b.bcv)})` : ''}.`;
    }

    incomeIntent(text, a, n) {
      const X = root.YarbisExpenses;
      const I = X && X.incomes;
      if (!I) return null;

      // Balance: "¿cuánto me queda?", "¿cuál es mi balance?", "¿cómo voy con la plata?"
      if (has(n, /^(?:cual es |como va |como esta |dime |muestrame )?(?:mi |el )?balance(?: del mes| de este mes)?$/) ||
          has(n, /^cuanto (?:me queda|me sobra|tengo disponible|he ahorrado|llevo ahorrado)(?: este mes| del mes| de plata| de dinero| para gastar)?$/) ||
          has(n, /^como voy (?:con|de) (?:la plata|el dinero|mis finanzas|las finanzas|mis cuentas|las cuentas)(?: este mes)?$/)) {
        const b = X.balance();
        if (!b.incomeUsd && !b.expenseUsd) {
          return { text: 'Este mes no has registrado ingresos ni gastos. Dime por ejemplo "me pagaron 300 dólares de sueldo" o "gasté 10 dólares en comida".' };
        }
        return {
          text: `📊 ${this.balanceLine()}${!b.incomeUsd ? '\n\nAún no has registrado ingresos este mes: dime "me pagaron…" o "me regalaron…".' : ''}`,
          speak: b.balanceUsd >= 0
            ? `Este mes entraron ${U.fmtNumber(b.incomeUsd, 2)} dólares y salieron ${U.fmtNumber(b.expenseUsd, 2)}. Te quedan ${U.fmtNumber(b.balanceUsd, 2)} dólares.`
            : `Este mes gastaste ${U.fmtNumber(-b.balanceUsd, 2)} dólares más de lo que entró.`,
          actions: [{ label: 'Ver finanzas', view: 'finance' }]
        };
      }

      // Consultas: "¿cuánto me han dado este mes?", "¿cuánto he recibido?", "mis ingresos"
      if (has(n, /^cuanto (?:me (?:han dado|dieron|han regalado|regalaron|han pagado|pagaron|ha entrado|entro|ha llegado|llego|han mandado|mandaron|han depositado|depositaron)|he (?:recibido|ganado|cobrado|vendido)|gane|recibi|cobre|vendi)(?: este mes| en el mes| del mes)?$/) ||
          has(n, /\b(mis ingresos|ingresos del mes|resumen de ingresos)\b/)) {
        const s = I.summary();
        if (!s.count) return { text: 'Este mes no has registrado ingresos. Dime por ejemplo "me regalaron 20 dólares" o "me pagaron 300 dólares de sueldo".' };
        const top = s.byCategory.slice(0, 5).map(c => `- ${c.emoji} ${c.name}: ${U.fmtUsd(c.usd)}`).join('\n');
        return {
          text: `💰 Este mes te entraron **${U.fmtUsd(s.totalUsd)}** (≈ ${U.fmtBs(s.totalBs)}) en ${s.count} ingreso${s.count === 1 ? '' : 's'}:\n${top}\n\n${this.balanceLine()}`,
          speak: `Este mes te entraron ${U.fmtNumber(s.totalUsd, 2)} dólares.`,
          actions: [{ label: 'Ver ingresos', view: 'finance' }]
        };
      }

      // Registro: "me regalaron 20 dólares", "mi papá me dio 10$", "me llegó una remesa de 100",
      // "me pagaron el sueldo, 300 dólares", "vendí unas tortas por 15 dólares", "registra un ingreso de 50$"
      const m = /^(?:((?:mi|mis|la|el|los|las)\s+[a-zñ]+(?:\s+[a-zñ]+)?)\s+)?(me\s+(?:dieron|dio|regalaron|regalo|pagaron|pago|depositaron|deposito|transfirieron|transfirio|mandaron|mando|enviaron|envio|prestaron|presto|devolvieron|devolvio|llego|llegaron|cayo|cayeron|entro|entraron)|recibi|cobre|gane|vendi|(?:registra|anota|apunta|agrega)r?\s+(?:un\s+)?ingreso(?:\s+de)?)\b\s*(.*)$/d.exec(a);
      if (!m) return null;
      const verb = m[2];
      // "una remesa" no es "1 remesa": los artículos sólo cuentan como número antes de la moneda
      const rest = wordsToDigits(U.normalize(m[3] || '').replace(/\b(un|una|unos|unas)\s+(?!(dolar|dolares|bolivar|bolivares|mil)\b)/g, ''));
      const found = [...rest.matchAll(/(\$\s?)?(\d[\d.,]*)\s*(mil\b)?\s*(dolares?|usd|\$|verdes|bolivares?|bs|bolos?|ves)?/g)];
      const am = found.find(x => x[1] || x[4]) || found[0];
      if (!am) return null;
      let amount = parseAmount(am[2]);
      if (amount === null || !(amount > 0)) return null;
      if (am[3]) amount *= 1000;
      // "vendí 3 tortas a 5 dólares (cada una)": cantidad por precio
      const each = /^vendi/.test(verb) && rest.match(/^(\d{1,4})\s+[a-zñ]+(?:\s+[a-zñ]+)?\s+(?:a|en)\s+(\$\s?)?(\d[\d.,]*)/);
      if (each && am === found[1] && parseAmount(each[1]) > 1) amount *= parseAmount(each[1]);
      const hasCurrency = !!(am[1] || am[4]);
      // Sin moneda sólo si está claro que es dinero ("me dio 2 consejos" no es un ingreso)
      const moneyContext = /^(me\s+(pagaron|pago|depositaron|deposito|transfirieron|transfirio)|cobre|gane|registra|anota|apunta|agrega)/.test(verb) ||
        /\b(remesa|sueldo|quincena|salario|bono|plata|dinero|reales|real|pago movil|zelle|transferencia|propina|aguinaldo|utilidades|mesada|ingreso)\b/.test(rest);
      if (!hasCurrency && !moneyContext) return null;
      const currency = am[4] && /^(bolivares?|bs|bolos?|ves)$/.test(am[4]) ? 'VES' : 'USD';

      // Detalle: quién te lo dio y por qué
      const subject = m.indices[1] ? text.slice(m.indices[1][0], m.indices[1][1]).trim() : '';
      let detail = m.indices[3] ? text.slice(m.indices[3][0]) : '';
      detail = detail
        .replace(/(\$\s?)?\d[\d.,]*\s*(mil\b)?\s*(d[oó]lares?|usd|\$|verdes|bol[ií]vares?|bs\.?|bolos?|ves)?/i, ' ')
        .replace(/\b(d[oó]lares?|bol[ií]vares?|verdes)\b/gi, ' ')
        .replace(/[,.;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^((de|del|por|para|en|el|la|los|las|un|una|unos|unas|y)\s+)+/i, '')
        .replace(/(\s+(de|del|por|para|en|y))+$/i, '')
        .trim();
      const note = [subject ? `De ${subject}` : '', detail].filter(Boolean).join(' · ');
      const inc = I.add({ amount, currency, note: U.capitalize(note), category: I.guessCategory(`${verb} ${rest} ${U.normalize(note)}`) });
      if (!inc) return null;
      const cat = I.category(inc.category);
      const amountTxt = currency === 'USD' ? U.fmtUsd(amount) : `${U.fmtBs(amount)} (≈ ${U.fmtUsd(inc.usd)})`;
      return {
        text: `${cat.emoji} Ingreso registrado: **${amountTxt}** · ${cat.name}${inc.note && U.normalize(inc.note) !== U.normalize(cat.name) ? ` · ${inc.note}` : ''}.\n\n${this.balanceLine()}`,
        speak: `Listo, anoté ${currency === 'USD' ? `${U.fmtNumber(amount, 2)} dólares` : `${U.fmtNumber(amount, 2)} bolívares`} de ${cat.name.toLowerCase()}.`,
        actions: [{ label: 'Ver ingresos', view: 'finance' }],
        sound: 'success'
      };
    }

    expenseIntent(text, a, n) {
      const E = root.YarbisExpenses && root.YarbisExpenses.store;
      if (!E) return null;

      // Consultas: "¿cuánto he gastado este mes?", "¿cuánto llevo en comida?"
      const q = n.match(/\bcuanto\s+(?:he\s+gastado|llevo(?:\s+gastado)?|gaste|me\s+he\s+gastado|va\s+de\s+gastos|van\s+de\s+gastos)(?:\s+(?:en|de)\s+([a-z ]+?))?(?:\s+(?:este|esta|el)\s+(mes|semana))?$/);
      if (q || has(n, /\b(mis gastos|resumen de gastos|gastos del mes)\b/)) {
        const s = E.summary();
        const catName = q && q[1] && !/^(este|esta|el)\b/.test(q[1]) ? E.category(E.guessCategory(q[1]) !== 'Otros' ? E.guessCategory(q[1]) : q[1]).name : null;
        const b = E.budgetStatus();
        if (catName) {
          const c = s.byCategory.find(x => x.name === catName);
          const usd = c ? c.usd : 0;
          return { text: `${E.category(catName).emoji} Este mes llevas **${U.fmtUsd(usd)}** en ${catName} (≈ ${U.fmtBs(usd * E.bcv())}).`, actions: [{ label: 'Ver gastos', view: 'finance' }] };
        }
        if (!s.count) return { text: 'Este mes no has registrado gastos. Dime por ejemplo "gasté 10 dólares en comida".' };
        const top = s.byCategory.slice(0, 4).map(c => `- ${c.emoji} ${c.name}: ${U.fmtUsd(c.usd)}`).join('\n');
        return {
          text: `💸 Este mes llevas **${U.fmtUsd(s.totalUsd)}** (≈ ${U.fmtBs(s.totalBs)}) en ${s.count} gasto${s.count === 1 ? '' : 's'}:\n${top}` +
            (b.budget ? `\n\nPresupuesto: ${U.fmtNumber(b.pct, 0)} % usado de ${U.fmtUsd(b.budget)}.` : '') +
            (root.YarbisExpenses.balance().incomeUsd ? `\n\n${this.balanceLine()}` : ''),
          speak: `Este mes llevas ${U.fmtNumber(s.totalUsd, 2)} dólares en gastos.`,
          actions: [{ label: 'Ver gastos', view: 'finance' }]
        };
      }

      // Registro: "gasté 20 dólares en comida", "pagué 500 bs de luz", "registra un gasto de 5$ en taxi"
      const m = /^(?:gaste|pague|me\s+gaste|compre|me\s+compre|(?:registra|anota|apunta|agrega)(?:r)?\s+(?:un\s+)?gasto(?:\s+de)?)\s+(.+)$/d.exec(a.trim());
      const bought = /^(?:me\s+)?compre\b/.test(a.trim());
      if (!m) return null;
      const rest = wordsToDigits(U.normalize(m[1]));
      const am = rest.match(/(\$\s?)?(\d[\d.,]*)\s*(mil\b)?\s*(dolares?|usd|\$|verdes|bolivares?|bs|bolos?|ves)?/);
      if (!am) return null;
      let amount = U.parseNumber(am[2]);
      if (amount === null) return null;
      if (am[3]) amount *= 1000;
      const currency = am[4] && /^(bolivares?|bs|bolos?|ves)$/.test(am[4]) ? 'VES' : 'USD';
      const original = text.slice(m.indices[1][0]);
      // Detalle: lo que va después de "en", "de", "para", "por" (con acentos originales)
      const detailM = original.match(/\b(?:en|de|para|por)\s+(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?(.+)$/i);
      let note = detailM ? U.capitalize(detailM[1].replace(/^(d[oó]lares?|bol[ií]vares?|bs|usd)\s+(en|de|para|por)\s+/i, '').trim()) : '';
      // "me compré unos zapatos de 30 dólares": lo comprado va antes del monto
      if (bought) {
        const item = original.replace(/\s+(?:de|por|en|a)\s+\$?\s?\d.*$/i, '').replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '').trim();
        if (item && !/^\$?\s?\d/.test(item)) note = U.capitalize(item);
      }
      const e = E.add({ amount, currency, note, category: E.guessCategory(note || original) });
      if (!e) return null;
      const cat = E.category(e.category);
      const b = E.budgetStatus();
      let warn = '';
      if (e.budgetCrossed === 100) warn = '\n\n⚠️ Con esto te pasaste del presupuesto del mes.';
      else if (e.budgetCrossed === 80) warn = '\n\n⚠️ Ya usaste el 80 % del presupuesto del mes.';
      const amountTxt = currency === 'USD' ? U.fmtUsd(amount) : `${U.fmtBs(amount)} (≈ ${U.fmtUsd(e.usd)})`;
      return {
        text: `${cat.emoji} Gasto registrado: **${amountTxt}** en ${cat.name}${note && U.normalize(note) !== U.normalize(cat.name) ? ` · ${note}` : ''}.` +
          (b.budget ? ` Llevas ${U.fmtNumber(b.pct, 0)} % del presupuesto.` : '') + warn +
          (root.YarbisExpenses.balance().incomeUsd ? `\n\n${this.balanceLine()}` : ''),
        actions: [{ label: 'Ver gastos', view: 'finance' }],
        sound: 'success'
      };
    }

    /* ------------------------------------------
       BOLSA DE VALORES (señales técnicas, no asesoría)
       ------------------------------------------ */
    // ¿Preguntan por la tasa? "¿a cómo está el dólar?", "tasa bcv", "euro", "dólar paralelo hoy".
    // No: "¿quién fue Simón Bolívar?", "clima en Ciudad Bolívar", "quiero ahorrar 100 dólares".
    isRateQuestion(n) {
      if (/^(abre|abrir)\b/.test(n) || KNOWLEDGE_RE.test(n)) return false;
      if (/\b(simon|ciudad|estado|cerro|plaza|avenida|av|universidad|aeropuerto|teatro|parque|liceo|colegio|libertador) bolivar\b/.test(n)) return false;
      if (/\b(interes|intereses|prestamo|credito|cuota|cuotas|hipoteca)\b/.test(n)) return false;
      if (/\b(tasa|tasas|bcv|paralelo|monitor|brecha|cambio del dia|usdt)\b/.test(n)) return true;
      const money = /\b(dolar|dolares|euro|euros|bolivares)\b/.test(n) || /\bbolivar\b/.test(n);
      if (!money) return false;
      const cue = /\b(a como|a cuanto|cuanto (esta|vale|cuesta|amanecio|cerro)|como (esta|amanecio|va|cerro|abrio|anda)|precio|cotizacion|valor|hoy|ahorita|ahora)\b/.test(n);
      return cue || n.split(' ').length <= 3;
    }

    // "¿Me conviene comprar bitcoin?", "¿qué acciones me recomiendas?", "¿vale la pena ahorrar en dólares?"
    isAdviceQuestion(n) {
      const advice = /\b(recomiendas|recomiendes|recomendarias|recomienda|recomiendame|aconsejas|aconsejarias|conviene|convendria|deberia|debo|vale la pena|que opinas|que piensas|tu opinion|crees que|(es|seria) (una )?(buena|buen|mala|mal) (idea|momento|inversion|opcion)|es seguro|es riesgoso|por que (sube|baja|subio|bajo|cayo)|va a (subir|bajar)|seguira (subiendo|bajando)|quiero ahorrar|como ahorro|como puedo ahorrar|analiza|analisis|explicame|compro|vendo|invierto|invertir|inversion)\b/;
      if (!advice.test(n)) return false;
      const topic = /\b(bolsa|acciones?|mercado|cripto|criptos|criptomonedas?|bitcoin|btc|ethereum|eth|solana|xrp|bnb|usdt|dolar|dolares|euro|euros|bolivares|oro|petroleo|fondos?|etf|sp ?500|s p 500|ibc|invertir|inversion|invierto|ahorro|ahorrar|ahorros)\b/;
      const B = root.YarbisStocks;
      return topic.test(n) || !!(B && B.data && B.mentioned(n));
    }

    // Respuesta sobre un activo concreto: la señal y qué significa, sin listar otros
    adviceAnswer(item) {
      const B = root.YarbisStocks;
      const s = B.signal(item.signal);
      const crypto = item.group === 'crypto';
      const pct = (v) => `${v >= 0 ? '+' : ''}${U.fmtNumber(v, 1)} %`;
      const facts = [];
      if (item.sma50 && item.price) {
        facts.push(item.price >= item.sma50
          ? `Está por **encima** de su promedio de 50 días (${B.fmtPrice({ ...item, price: item.sma50 })}): la tendencia es de subida.`
          : `Está por **debajo** de su promedio de 50 días (${B.fmtPrice({ ...item, price: item.sma50 })}): la tendencia es de bajada.`);
      }
      if (typeof item.rsi === 'number') {
        const rsi = U.fmtNumber(item.rsi, 0);
        facts.push(item.rsi >= 70 ? `El RSI está en ${rsi}: subió muy rápido y puede corregir (bajar un poco).`
          : item.rsi <= 30 ? `El RSI está en ${rsi}: cayó mucho y puede rebotar.`
            : `El RSI está en ${rsi}: zona normal, ni caro ni barato por ahora.`);
      }
      const rets = [typeof item.ret1m === 'number' ? `${pct(item.ret1m)} en 1 mes` : '', typeof item.ret3m === 'number' ? `${pct(item.ret3m)} en 3 meses` : ''].filter(Boolean);
      if (rets.length) facts.push(`Rendimiento: ${rets.join(' y ')}.`);
      if (item.high52 && item.price >= item.high52 * 0.95) facts.push('Está cerca de su precio más alto del año.');
      else if (item.low52 && item.price <= item.low52 * 1.05) facts.push('Está cerca de su precio más bajo del año.');
      if (!facts.length) facts.push(...(item.reasons || []));
      const verdict = {
        comprar: 'Las señales técnicas están **a favor de comprar**.',
        vender: 'Las señales técnicas dicen que **podría seguir bajando**: no es buen momento para comprar; si ya tienes, piensa si te conviene vender una parte.',
        mantener: '**No hay una señal clara** ni de compra ni de venta: si te interesa, compra poco a poco en vez de todo de una vez.'
      }[item.signal] || '';
      const tips = [
        'Compra por partes (un poco cada semana o cada mes) en vez de todo de golpe.',
        'Usa sólo dinero que no vayas a necesitar pronto.',
        crypto ? 'En cripto, que sea una parte pequeña de tus ahorros: puede subir o bajar 20 % en pocos días.' : 'No pongas todo en una sola inversión; los fondos como el S&P 500 reparten el riesgo.'
      ];
      const bal = this.balanceLine ? this.balanceLine() : '';
      const icon = crypto ? '🪙' : item.group === 'commodities' ? '🥇' : '📈';
      return {
        text: `${icon} **¿${item.signal === 'vender' ? 'Comprar o vender' : 'Comprar'} ${item.name}?**\n\nHoy está en **${B.fmtPrice(item)}** ${B.fmtChange(item)} · ${s.emoji} Señal: **${s.label}**\n\n${verdict}\n\n**Por qué:**\n${facts.map(f => `- ${f}`).join('\n')}\n\n**Si decides invertir:**\n${tips.map(t => `- ${t}`).join('\n')}${bal ? `\n\n${bal}` : ''}\n\n_Señales técnicas automáticas; no son asesoría financiera._`,
        speak: `${item.name} está en ${B.fmtPrice(item)}. ${verdict.replace(/\*\*/g, '')} Recuerda comprar por partes y sólo con dinero que no necesites.`,
        actions: [{ label: 'Ver la bolsa', view: 'finance' }]
      };
    }

    async stocksIntent(n) {
      const B = root.YarbisStocks;
      if (!B) return null;
      const NOTE = '_Señales técnicas automáticas; no son asesoría financiera._';
      const marketOf = (t) => (/\b(caracas|venezuela|venezolana|venezolanas|bvc|ibc)\b/.test(t) ? 'bvc'
        : /\b(estados unidos|eeuu|ee uu|usa|wall street|gringa|gringas|americanas?)\b/.test(t) ? 'us'
          : /\b(fondos?|etf|etfs|indexados?)\b/.test(t) ? 'etf'
            : /\b(oro|plata|petroleo|divisas)\b/.test(t) ? 'commodities'
              : /\b(cripto|criptos|criptomonedas?)\b/.test(t) ? 'crypto' : null);
      const wantsRecs = has(n, /\b(que|cuales?)\b.*\b(acciones|activos|me recomiendas|recomiendas|debo|deberia|conviene)\b.*\b(comprar|vender|invertir)\b/) ||
        has(n, /\brecomienda(me|s)?\b.*\b(comprar|vender|invertir|acciones|bolsa)\b/) ||
        has(n, /\ben que (invierto|invertir|puedo invertir|deberia invertir)\b/) ||
        has(n, /\b(senales?|recomendaciones?) de (compra|venta|la bolsa|bolsa|inversion)\b/);
      const wantsMarket = has(n, /\b(la bolsa|bolsa de valores|bolsa de caracas|mercado de valores|wall street|el ibc|indice bursatil|como esta(n)? el mercado|las acciones)\b/);
      // "¿cómo está Apple?", "precio del oro", "¿compro Tesla?" (sólo nombres de la bolsa, no el dólar ni el euro)
      const itemM = n.match(/^(?:como (?:esta|va|van|anda|andan)|precio (?:de|del)|cuanto (?:vale|cuesta|esta)|a cuanto esta|cotizacion (?:de|del)|(?:debo |deberia |me conviene )?(?:compro|vendo|comprar|vender))\s+(?:la |las |el |los )?(?:acciones? (?:de |del )?)?(.{2,40}?)\??$/);
      let item = null;
      if (itemM && !/\b(dolar|dolares|euro|euros|bolivar|bolivares|tasa|bcv|paralelo|clima|tiempo|bitcoin|btc|ethereum|eth|solana|xrp|bnb)\b/.test(itemM[1])) {
        try { await B.load(); } catch (e) { return null; }
        item = B.find(itemM[1]);
      }
      const advice = this.isAdviceQuestion(n);
      if (!item && advice) {
        try { await B.load(); } catch (e) { return null; }
        item = B.mentioned(n);
      }
      if (!wantsRecs && !wantsMarket && !item) return null;

      try {
        await B.load();
      } catch (e) {
        return { text: `📈 ${e.message} Inténtalo en un momento.`, error: true };
      }
      const sig = (x) => B.signal(x.signal);
      const line = (x) => `- ${sig(x).emoji} **${x.name}** ${B.fmtPrice(x)} ${B.fmtChange(x)} · ${sig(x).label}`;

      if (item && advice) return this.adviceAnswer(item);
      if (item) {
        const s = sig(item);
        return {
          text: `📈 **${item.name}** (${item.symbol}): ${B.fmtPrice(item)} ${B.fmtChange(item)}\n\n${s.emoji} Señal: **${s.label}**\n${(item.reasons || []).map(r => `- ${r}`).join('\n')}\n\n${NOTE}`,
          speak: `${item.name} está en ${B.fmtPrice(item)}. La señal técnica es ${s.label.toLowerCase()}.`,
          actions: [{ label: 'Ver la bolsa', view: 'finance' }]
        };
      }

      const market = marketOf(n);
      if (wantsRecs) {
        const r = B.recommendations(4, B.data, market);
        const where = market ? ` (${B.data.groups[market].title})` : '';
        const buy = r.buy.length ? r.buy.map(line).join('\n') : '- Ninguna con señal clara de compra ahora.';
        const sell = r.sell.length ? r.sell.map(line).join('\n') : '- Ninguna con señal clara de venta ahora.';
        return {
          text: `📈 **Señales de la bolsa${where}**\n\n🟢 **Para comprar:**\n${buy}\n\n🔴 **Para vender:**\n${sell}\n\nToca una acción en Finanzas para ver por qué. ${NOTE}\n\n💡 Consejo: no pongas todo en una sola acción; los fondos como el S&P 500 reparten el riesgo.`,
          speak: `Con señal de compra: ${r.buy.map(x => x.name).join(', ') || 'ninguna'}. Con señal de venta: ${r.sell.map(x => x.name).join(', ') || 'ninguna'}. Recuerda que son señales técnicas, no asesoría.`,
          actions: [{ label: 'Ver la bolsa', view: 'finance' }]
        };
      }

      // Resumen del mercado
      const g = B.data.groups[market || (/\b(wall street)\b/.test(n) ? 'us' : 'bvc')];
      const head = (g.indices || []).map(line).join('\n');
      const movers = (g.items || []).filter(x => x.changePct !== null && x.changePct !== undefined)
        .slice().sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4).map(line).join('\n');
      return {
        text: `📈 **Bolsa · ${g.title}** (${B.updatedLabel()})\n${head ? `\n${head}\n` : ''}\n**Lo que más se movió:**\n${movers || '- Sin datos todavía.'}\n\n${NOTE}`,
        speak: g.indices && g.indices[0] ? `El ${g.indices[0].name} está en ${U.fmtNumber(g.indices[0].price, 2)} puntos, ${g.indices[0].changePct >= 0 ? 'sube' : 'baja'} ${U.fmtNumber(Math.abs(g.indices[0].changePct || 0), 2)} por ciento.` : `Así está la bolsa de ${g.title}.`,
        actions: [{ label: 'Ver la bolsa', view: 'finance' }]
      };
    }

    async ratesIntent(n) {
      const r = await this.finance.ensureFresh(10 * 60 * 1000);
      const meta = this.finance.statusLabel(r.fx);
      const warn = r.fx.status === 'default' ? '\n\n⚠️ No pude conectarme para obtener la tasa de hoy; este valor es aproximado.' : '';
      if (/\beuros?\b/.test(n) && !/\bdolar/.test(n)) {
        return {
          text: `💶 **Euro BCV:** ${U.fmtBs(r.eur)}\n\n_${meta}_${warn}`,
          speak: `El euro oficial está en ${U.fmtNumber(r.eur, 2)} bolívares.`,
          actions: [{ label: 'Ver Finanzas', view: 'finance' }]
        };
      }
      return {
        text: [
          `💵 **Dólar BCV:** ${U.fmtBs(r.bcv)}`,
          `📈 **Paralelo:** ${U.fmtBs(r.paralelo)} (brecha ${U.fmtNumber(r.spread, 1)} %)`,
          `💶 **Euro BCV:** ${U.fmtBs(r.eur)}`,
          '',
          `_${meta}_${warn}`
        ].join('\n'),
        speak: `El dólar BCV está en ${U.fmtNumber(r.bcv, 2)} bolívares y el paralelo en ${U.fmtNumber(r.paralelo, 2)}.`,
        actions: [{ label: 'Ver Finanzas', view: 'finance' }]
      };
    }

    async cryptoIntent(word) {
      const map = { bitcoin: 'BTC', btc: 'BTC', ethereum: 'ETH', eth: 'ETH', ether: 'ETH', solana: 'SOL', bnb: 'BNB', 'binance coin': 'BNB', xrp: 'XRP', ripple: 'XRP' };
      const r = await this.finance.ensureFresh(5 * 60 * 1000);
      const meta = this.finance.statusLabel(r.cryptoMeta);
      const line = (code) => {
        const c = r.crypto[code];
        const sign = c.change >= 0 ? '+' : '';
        return `- **${code}:** ${U.fmtUsd(c.price)} (${sign}${U.fmtNumber(c.change, 2)} % 24h) · ${U.fmtBs(c.price * r.bcv)}`;
      };
      const code = map[word];
      if (code) {
        const c = r.crypto[code];
        return {
          text: `${line(code)}\n\n_${meta}_`,
          speak: `${code} está en ${U.fmtNumber(c.price, c.price < 10 ? 4 : 2)} dólares.`,
          actions: [{ label: 'Ver Finanzas', view: 'finance' }]
        };
      }
      return {
        text: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].map(line).join('\n') + `\n\n_${meta}_`,
        speak: `Bitcoin está en ${U.fmtNumber(r.crypto.BTC.price, 0)} dólares y Ethereum en ${U.fmtNumber(r.crypto.ETH.price, 0)}.`,
        actions: [{ label: 'Ver Finanzas', view: 'finance' }]
      };
    }

    /* ------------------------------------------
       CLIMA (Open-Meteo, sin clave)
       ------------------------------------------ */
    weatherCode(code) {
      const map = {
        0: 'despejado ☀️', 1: 'mayormente despejado 🌤️', 2: 'parcialmente nublado ⛅', 3: 'nublado ☁️',
        45: 'con neblina 🌫️', 48: 'con neblina 🌫️', 51: 'con llovizna ligera 🌦️', 53: 'con llovizna 🌦️', 55: 'con llovizna intensa 🌧️',
        61: 'con lluvia ligera 🌧️', 63: 'con lluvia 🌧️', 65: 'con lluvia fuerte 🌧️', 80: 'con chubascos 🌦️', 81: 'con chubascos 🌧️',
        82: 'con chubascos fuertes ⛈️', 95: 'con tormenta eléctrica ⛈️', 96: 'con tormenta y granizo ⛈️', 99: 'con tormenta fuerte ⛈️'
      };
      if (typeof code === 'string') return code;
      return map[code] || 'estable';
    }

    // Descarga JSON reintentando una vez si el servicio no contesta a tiempo
    async fetchJson(url, ms = 6000, tries = 2) {
      try {
        const res = await U.fetchWithTimeout(url, {}, ms);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        if (tries <= 1) throw e;
        return this.fetchJson(url, ms + 2000, tries - 1);
      }
    }

    // Pronóstico con la forma de Open-Meteo. Si Open-Meteo no responde se usa
    // wttr.in, convertido a la misma forma (con descripciones en vez de códigos).
    async fetchForecast(place) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=2`;
      try {
        return await this.fetchJson(url, 5000, 2);
      } catch (e) {
        console.warn('Open-Meteo no disponible:', e.message);
      }
      const w = await this.fetchJson(`https://wttr.in/${place.latitude},${place.longitude}?format=j1&lang=es`, 8000, 1);
      const desc = (x) => {
        const t = x && x.lang_es && x.lang_es[0] && x.lang_es[0].value;
        return t ? t.trim().toLowerCase() : 'estable';
      };
      const c = w.current_condition[0];
      const days = (w.weather || []).slice(0, 2);
      const rain = (d) => Math.max(...(d.hourly || []).map(h => Number(h.chanceofrain) || 0));
      return {
        current: {
          temperature_2m: Number(c.temp_C),
          apparent_temperature: Number(c.FeelsLikeC),
          relative_humidity_2m: Number(c.humidity),
          weather_code: desc(c),
          wind_speed_10m: Number(c.windspeedKmph)
        },
        daily: {
          weather_code: days.map(d => desc(d.hourly && d.hourly[4])),
          temperature_2m_max: days.map(d => Number(d.maxtempC)),
          temperature_2m_min: days.map(d => Number(d.mintempC)),
          precipitation_probability_max: days.map(rain)
        }
      };
    }

    // Ciudad → coordenadas. Open-Meteo; si no responde, wttr.in (que también ubica por nombre)
    async geocode(city, n = U.normalize(city)) {
      try {
        const geo = await this.fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=es&format=json`);
        return this.pickPlace(geo && geo.results, n);
      } catch (e) {
        console.warn('Geocodificación de Open-Meteo no disponible:', e.message);
      }
      const w = await this.fetchJson(`https://wttr.in/${encodeURIComponent(`${city}, Venezuela`)}?format=j1`, 8000, 1);
      const a = w && w.nearest_area && w.nearest_area[0];
      if (!a) return null;
      const name = (a.areaName && a.areaName[0] && a.areaName[0].value) || U.capitalize(city);
      return { name, admin1: a.region && a.region[0] && a.region[0].value, latitude: Number(a.latitude), longitude: Number(a.longitude) };
    }

    // Entre varias ciudades con el mismo nombre (Mérida, Valencia, Barcelona...)
    // prefiere la de Venezuela, salvo que se nombre otro país.
    pickPlace(results, n) {
      if (!Array.isArray(results) || !results.length) return null;
      const otherCountry = results.find(r => r.country_code !== 'VE' && r.country &&
        n.includes(U.normalize(r.country)));
      if (otherCountry) return otherCountry;
      return results.find(r => r.country_code === 'VE') || results[0];
    }

    async weatherIntent(n) {
      const tomorrow = /\bmanana\b/.test(n);
      if (/\b(aqui|donde estoy|mi ubicacion|por aca)\b/.test(n)) {
        try {
          const p = await this.getPosition();
          const place = await this.reverseGeocode(p.lat, p.lon);
          if (place.city) S.setRaw('yarbis_weather_city', place.city);
          n = `clima en ${U.normalize(place.city || 'caracas')}${tomorrow ? ' manana' : ''}`;
        } catch (e) { /* sin ubicación: ciudad guardada */ }
      }
      let city = '';
      const m = n.match(/^.*\b(?:en|de|para|por)\s+([a-z ]{3,40}?)(?:\s+(?:hoy|manana|ahora|esta semana|este momento))?$/);
      if (m) city = m[1].replace(/^(el|la)\s+/, '').trim();
      if (!city || /^(hoy|manana|ahora|momento)$/.test(city)) city = S.getRaw('yarbis_weather_city', '') || 'Caracas';

      try {
        const place = await this.geocode(city, n);
        if (!place) return { text: `No encontré la ciudad "${city}". Prueba con otro nombre.` };
        const w = await this.fetchForecast(place);
        S.setRaw('yarbis_weather_city', place.name);
        const where = `${place.name}${place.admin1 && place.admin1 !== place.name ? `, ${place.admin1}` : ''}`;
        if (tomorrow && w.daily) {
          const i = 1;
          const rain = w.daily.precipitation_probability_max ? w.daily.precipitation_probability_max[i] : null;
          return {
            text: `🌦️ **Mañana en ${where}:** ${this.weatherCode(w.daily.weather_code[i])}, entre ${Math.round(w.daily.temperature_2m_min[i])}° y ${Math.round(w.daily.temperature_2m_max[i])}°C${rain !== null ? ` · probabilidad de lluvia ${rain} %` : ''}.`,
            speak: `Mañana en ${place.name}: ${U.toSpeech(this.weatherCode(w.daily.weather_code[i]))}, entre ${Math.round(w.daily.temperature_2m_min[i])} y ${Math.round(w.daily.temperature_2m_max[i])} grados${rain !== null ? `, con ${rain} por ciento de probabilidad de lluvia` : ''}.`
          };
        }
        const c = w.current;
        const rainToday = w.daily && w.daily.precipitation_probability_max ? w.daily.precipitation_probability_max[0] : null;
        return {
          text: `🌡️ **${where}:** ${Math.round(c.temperature_2m)}°C (sensación ${Math.round(c.apparent_temperature)}°), ${this.weatherCode(c.weather_code)}.\nHumedad ${c.relative_humidity_2m} % · viento ${Math.round(c.wind_speed_10m)} km/h${rainToday !== null ? ` · lluvia hoy ${rainToday} %` : ''}.`,
          speak: `En ${place.name} hay ${Math.round(c.temperature_2m)} grados, ${U.toSpeech(this.weatherCode(c.weather_code))}${rainToday !== null ? `, con ${rainToday} por ciento de probabilidad de lluvia hoy` : ''}.`
        };
      } catch (e) {
        return { text: 'No pude consultar el clima ahora mismo. Revisa tu conexión a internet.' };
      }
    }

    /* ------------------------------------------
       CONTACTOS, LLAMADAS Y WHATSAPP
       ------------------------------------------ */
    getAllContacts() {
      const c = S.get('yarbis_contacts', {});
      return c && typeof c === 'object' ? c : {};
    }

    saveContact(name, phone) {
      const cleanName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const cleanPhone = String(phone || '').replace(/[^\d+]/g, '');
      if (!cleanName || !cleanPhone) return false;
      const contacts = this.getAllContacts();
      // Evita duplicados que sólo difieren en acentos (mama / mamá)
      Object.keys(contacts).forEach(k => { if (U.normalize(k) === U.normalize(cleanName)) delete contacts[k]; });
      contacts[cleanName] = cleanPhone;
      S.set('yarbis_contacts', contacts);
      return true;
    }

    deleteContact(name) {
      const contacts = this.getAllContacts();
      Object.keys(contacts).forEach(k => { if (U.normalize(k) === U.normalize(name)) delete contacts[k]; });
      S.set('yarbis_contacts', contacts);
    }

    findContacts(query) {
      const q = U.normalize(query).replace(/^(a|al|mi|la|el)\s+/, '').trim();
      if (!q) return [];
      const entries = Object.entries(this.getAllContacts()).map(([name, phone]) => ({ name, phone, key: U.normalize(name) }));
      const exact = entries.filter(e => e.key === q);
      if (exact.length) return exact;
      return entries.filter(e => e.key.includes(q) || q.includes(e.key) || e.key.split(' ')[0] === q.split(' ')[0]);
    }

    callContact(who) {
      const matches = this.findContacts(who);
      if (matches.length === 1) {
        const c = matches[0];
        return {
          text: `📞 Llamando a **${U.capitalize(c.name)}** (${c.phone})…`,
          actions: [{ label: `Llamar a ${U.capitalize(c.name)}`, url: `tel:${c.phone}` }],
          effect: { type: 'OPEN_URL', url: `tel:${c.phone}` }
        };
      }
      if (matches.length > 1) {
        return {
          text: `Encontré varios contactos para "${who}". ¿A cuál llamo?`,
          actions: matches.slice(0, 5).map(c => ({ label: `📞 ${U.capitalize(c.name)}`, url: `tel:${c.phone}` }))
        };
      }
      return {
        text: `No tengo a "${who}" en tu agenda. Agrégalo en Ajustes o di: "guarda el contacto ${who} 0414 1234567".`,
        actions: [{ label: 'Abrir agenda', view: 'settings' }]
      };
    }

    whatsappIntent(text, a) {
      // Mensaje: lo que va después de "que diga", "diciendo", ":" ...
      let message = '';
      const msgM = /\b(?:que\s+diga|que\s+dice|diciendo(?:le)?|con\s+el\s+(?:mensaje|texto)|el\s+mensaje)\s*:?\s+([\s\S]+)$/d.exec(a) || /:\s*([\s\S]+)$/d.exec(a);
      let head = a;
      if (msgM) {
        message = text.slice(msgM.indices[1][0], msgM.indices[1][1]).trim();
        head = a.slice(0, msgM.index);
      }
      const headWords = head.replace(/\s+/g, ' ').trim();

      let phone = '';
      let contactName = '';
      const num = wordsToDigits(headWords).match(/(\+?\d[\d\s-]{6,}\d)/);
      if (num) {
        phone = venezuelanPhone(num[1]);
      } else {
        const toM = headWords.match(/^.*\b(?:a|al|para)\s+(?:mi\s+)?([a-z ]{2,40}?)\s*(?:por\s+(?:whatsapp|wasap|guasap|whats|wsp))?$/) ||
          headWords.match(/\b(?:whatsapp|wasap|guasap|whats|wsp)\s+(?:a|al|para)\s+(?:mi\s+)?([a-z ]{2,40})$/);
        const candidate = toM ? toM[1].replace(/\b(whatsapp|wasap|guasap|whats|wsp|por)\b/g, '').trim() : '';
        if (candidate && !/^(un|una|el|mensaje|abre|abrir)$/.test(candidate)) {
          const found = this.findContacts(candidate);
          contactName = U.capitalize(candidate);
          if (found.length) {
            phone = venezuelanPhone(found[0].phone);
            contactName = U.capitalize(found[0].name);
          }
        }
      }

      if (contactName && !phone) {
        return {
          text: `No tengo el número de ${contactName}. Guárdalo en Ajustes o dime: "guarda el contacto ${contactName} 0414 1234567".`,
          actions: [
            { label: 'Abrir agenda', view: 'settings' },
            message ? { label: 'Elegir chat en WhatsApp', url: `https://wa.me/?text=${encodeURIComponent(message)}` } : { label: 'Abrir WhatsApp', url: 'https://wa.me/' }
          ]
        };
      }

      let url = 'https://wa.me/';
      if (phone) url += phone;
      if (message) url += `?text=${encodeURIComponent(message)}`;
      const target = contactName || (phone ? `+${phone}` : '');
      const reply = message
        ? `💬 Mensaje listo${target ? ` para **${target}**` : ''}: "${message}". Toca para enviarlo.`
        : target ? `💬 Abriendo el chat de **${target}** en WhatsApp.` : '💬 Abriendo WhatsApp.';
      return { text: reply, actions: [{ label: 'Abrir WhatsApp', url }], effect: { type: 'OPEN_URL', url } };
    }

    /* ------------------------------------------
       OTROS
       ------------------------------------------ */
    async batteryIntent() {
      if (root.navigator && 'getBattery' in root.navigator) {
        try {
          const b = await root.navigator.getBattery();
          const pct = Math.round(b.level * 100);
          return { text: `🔋 Batería al **${pct} %**${b.charging ? ', cargando ⚡' : ''}.` };
        } catch (e) { /* sin acceso */ }
      }
      return { text: 'Este navegador no permite leer el nivel de batería (Safari/iPhone no lo comparte).' };
    }

    answerTrivia(n) {
      const t = this.trivia;
      const q = TRIVIA[t.order[t.index]];
      const ok = q.a.some(ans => n.includes(ans));
      if (ok) t.score++;
      const feedback = ok ? `✅ ¡Correcto! ${q.explain}` : `❌ No era. ${q.explain}`;
      t.index++;
      if (t.index < t.order.length) {
        return { text: `${feedback}\n\n**Pregunta ${t.index + 1}:** ${TRIVIA[t.order[t.index]].q}`, sound: ok ? 'success' : null };
      }
      const score = t.score;
      this.trivia = null;
      return { text: `${feedback}\n\n🏁 Terminamos: **${score} de ${t.order.length}**. ${score >= 4 ? '¡Eres un crack! 🏆' : '¡Buen intento! La próxima la rompes.'}`, sound: 'success' };
    }

    rps(choice) {
      const options = ['piedra', 'papel', 'tijera'];
      const bot = pick(options);
      const emoji = { piedra: '✊', papel: '✋', tijera: '✌️' };
      let result;
      if (bot === choice) result = '¡Empate! 🤝';
      else if ((choice === 'piedra' && bot === 'tijera') || (choice === 'papel' && bot === 'piedra') || (choice === 'tijera' && bot === 'papel')) result = '¡Ganaste! 🏆';
      else result = '¡Gané yo! 😎';
      return { text: `Tú: ${emoji[choice]} · Yo: ${emoji[bot]} — ${result}` };
    }

    async wikipedia(topic) {
      try {
        const res = await U.fetchWithTimeout(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.trim())}`, {}, 6000);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.extract || data.type === 'disambiguation') return null;
        const url = data.content_urls && data.content_urls.mobile && data.content_urls.mobile.page;
        return { text: `📚 **${data.title}:** ${data.extract}`, actions: url ? [{ label: 'Leer en Wikipedia', url }] : [] };
      } catch (e) {
        return null;
      }
    }

    /* ==========================================
       INTELIGENCIA ARTIFICIAL
       ========================================== */
    // Lo que la IA debe saber del usuario: pendientes, alarmas, gastos, ciudad...
    personalContext() {
      const lines = [];
      try {
        const R = this.reminders;
        const pending = R.notes.pending().slice(0, 10);
        if (pending.length) lines.push(`Pendientes del usuario: ${pending.map(n => `${n.text}${n.list && n.list !== 'Personal' ? ` (${n.list})` : ''}`).join('; ')}.`);
        const up = R.schedule.upcoming(4);
        if (up.length) lines.push(`Próximos avisos: ${up.map(x => `${x.kind === 'timer' ? 'temporizador' : 'alarma'} ${U.fmtTime(x.at)} "${x.label}"`).join('; ')}.`);
      } catch (e) { /* sin recordatorios */ }
      try {
        const E = root.YarbisExpenses && root.YarbisExpenses.store;
        if (E) {
          const s = E.summary();
          if (s.count) lines.push(`Gastos de este mes: ${U.fmtUsd(s.totalUsd)} (${s.byCategory.slice(0, 3).map(c => `${c.name} ${U.fmtUsd(c.usd)}`).join(', ')})${E.budget ? `, presupuesto ${U.fmtUsd(E.budget)}` : ''}.`);
          const X = root.YarbisExpenses;
          const bal = X.balance ? X.balance() : null;
          if (bal && bal.incomeUsd) {
            const is = X.incomes.summary();
            lines.push(`Ingresos de este mes: ${U.fmtUsd(bal.incomeUsd)} (${is.byCategory.slice(0, 3).map(c => `${c.name} ${U.fmtUsd(c.usd)}`).join(', ')}); le quedan ${U.fmtUsd(bal.balanceUsd)}.`);
          }
        }
      } catch (e) { /* sin gastos */ }
      const city = S.getRaw('yarbis_weather_city', '');
      if (city) lines.push(`Ciudad del usuario: ${city}.`);
      if (!lines.length) return '';
      return `\nContexto personal (úsalo sólo si es relevante, no lo repitas sin motivo):\n- ${lines.join('\n- ')}`;
    }

    popLastExchange() {
      const last = this.history[this.history.length - 1];
      if (last && last.role === 'assistant') this.history.pop();
      const prev = this.history[this.history.length - 1];
      if (prev && prev.role === 'user') this.history.pop();
      S.set(HISTORY_KEY, this.history);
    }

    systemPrompt() {
      let fxLine = '';
      try {
        const r = this.finance.getRates();
        fxLine = `\nDatos actuales (úsalos si te preguntan): dólar BCV Bs. ${U.fmtNumber(r.bcv, 2)}, paralelo Bs. ${U.fmtNumber(r.paralelo, 2)}, euro BCV Bs. ${U.fmtNumber(r.eur, 2)} (${this.finance.statusLabel(r.fx)}); BTC $${U.fmtNumber(r.crypto.BTC.price, 0)}.`;
      } catch (e) { /* sin datos */ }
      const today = new Date().toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `Eres ${this.assistantName}, un asistente personal venezolano: amable, claro, útil y con un toque criollo natural (sin exagerar ni ser vulgar).
${this.userName ? `El usuario se llama ${this.userName}.` : ''} Hoy es ${today} (hora de Venezuela).${fxLine}${this.personalContext()}${root.YarbisGemini ? root.YarbisGemini.Memory.prompt() : ''}
Reglas:
- Responde en español, de forma breve y directa (2 a 6 frases) salvo que te pidan detalle. Tus respuestas también se leen en voz alta.
- Usa Markdown simple (negritas, listas, tablas pequeñas) cuando ayude.
- En matemáticas y finanzas muestra el cálculo paso a paso y el resultado final claro.
- Si no sabes algo o necesitas datos en tiempo real que no tienes, dilo con honestidad; nunca inventes precios ni cifras.`;
    }

    async askAI(userText, opts = {}) {
      const prior = this.history.slice(-12);
      const messages = [...prior, { role: 'user', text: userText }];
      let answer = null;
      let lastError = '';

      // Cerebro: Gemini u otra API con tu clave. Conversa y además actúa con las
      // herramientas de la app. Si uno falla se prueba el otro.
      const brainMessages = [...this.history.slice(-20), { role: 'user', text: userText }];
      let geminiBlocked = false; // clave inválida o sin cupo: no insistir con Gemini
      for (const engine of this.brainOrder()) {
        try {
          const r = engine === 'gemini'
            ? await root.YarbisGemini.run(this, brainMessages, opts.onChunk)
            : await root.YarbisGemini.runProvider(this, brainMessages, opts.onChunk);
          this.lastAiEngine = engine;
          this.remember('user', userText);
          this.remember('assistant', r.text);
          return { text: r.text, ai: true, actions: r.actions, effects: r.effects, sound: r.sound || undefined, tools: r.tools };
        } catch (e) {
          const who = engine === 'gemini' ? 'Gemini' : root.YarbisAIProviders.label();
          if (engine === 'gemini' && (e.fatal || e.status === 429)) geminiBlocked = true;
          lastError = lastError ? `${lastError} · ${who}: ${e.message}` : `${who}: ${e.message}`;
          console.warn(`${who} (cerebro) falló:`, e.message);
        }
      }

      // El cerebro falló en una pregunta que la app sabe responder con sus datos
      if (opts.localFallback && this.brainOrder().length) {
        try {
          const local = await opts.localFallback();
          if (local) {
            this.remember('user', userText);
            this.remember('assistant', local.text);
            return local;
          }
        } catch (e) { console.warn('Respuesta local falló:', e.message); }
      }

      // Gemini sin herramientas: por si el fallo fue de las herramientas, no de Gemini
      if (this.geminiApiKey && !geminiBlocked && this.brainOrder().includes('gemini')) {
        try {
          answer = typeof opts.onChunk === 'function'
            ? await this.streamGemini(messages, opts.onChunk)
            : await this.queryGemini(messages);
          this.lastAiEngine = 'gemini';
        } catch (e) {
          console.warn('Gemini (sin herramientas) falló:', e.message);
        }
      }

      // Respuesta en tiempo real: se va pintando mientras llega
      if (!answer && typeof opts.onChunk === 'function' && !this.brainOrder().length) {
        try {
          answer = await this.streamFreeAI(messages, opts.onChunk);
          this.lastAiEngine = 'free';
        } catch (e) {
          console.warn('Streaming falló, se usa respuesta normal:', e.message);
          answer = null;
        }
      }

      if (!answer) {
        try {
          answer = await this.queryFreeAI(messages);
          this.lastAiEngine = 'free';
        } catch (e) {
          console.warn('IA gratuita falló:', e);
        }
      }

      if (!answer) {
        // Último recurso: Wikipedia para preguntas de "qué es / quién es"
        const n = U.normalize(userText);
        const topicM = n.match(/^(?:quien es|quien fue|que es|que son|que significa|hablame de|cuentame de)\s+(?:el |la |los |las |un |una )?(.{3,60})$/);
        if (topicM) {
          const wiki = await this.wikipedia(topicM[1]);
          if (wiki) return wiki;
        }
        const offline = root.navigator && root.navigator.onLine === false;
        return {
          text: offline
            ? '📴 Estás sin conexión. Puedo hacer cálculos, notas, alarmas y temporizadores, pero para conversar con la IA necesito internet.'
            : `⚠️ No pude conectar con la IA en este momento${lastError ? ` (${lastError})` : ''}. Inténtalo de nuevo en unos segundos${this.brainOrder().length ? '' : ', o agrega tu clave gratuita de Google Gemini en Ajustes para respuestas más estables'}.`,
          actions: this.brainOrder().length ? [] : [{ label: 'Abrir Ajustes', view: 'settings' }],
          error: true
        };
      }

      this.remember('user', userText);
      this.remember('assistant', answer);
      return { text: answer, ai: true };
    }

    // Una consulta suelta a la IA (sin historial) con instrucciones propias
    async completeOnce(system, userText) {
      const messages = [{ role: 'user', text: userText }];
      for (const engine of this.brainOrder()) {
        try {
          return engine === 'gemini'
            ? await this.geminiRequest(this.geminiChatBody(messages, system))
            : await root.YarbisAIProviders.complete(system, userText);
        } catch (e) { console.warn(`${engine}:`, e.message); }
      }
      return this.queryFreeAI(messages, system);
    }

    async translate(text, langCode) {
      const name = LANGS[langCode] || langCode;
      const out = await this.completeOnce(
        `Eres un traductor profesional. Traduce el texto del usuario al ${name}. Responde SOLO con la traducción, sin comillas ni explicaciones. Mantén el tono y el formato.`,
        text);
      return out ? out.trim().replace(/^["“]|["”]$/g, '') : null;
    }

    /* ---------- Streaming (SSE) ---------- */
    // Lee un cuerpo "text/event-stream" y llama onData con cada línea "data:"
    async readSSE(res, onData) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            if (payload && payload !== '[DONE]') onData(payload);
          }
        }
      }
      const rest = buffer.trim();
      if (rest.startsWith('data:') && rest.slice(5).trim() !== '[DONE]') onData(rest.slice(5).trim());
    }

    // Petición con señal externa + tiempo límite hasta recibir la primera respuesta
    async streamFetch(url, options, signal, firstByteMs = 25000) {
      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      if (signal) signal.addEventListener('abort', onAbort);
      const timer = setTimeout(() => ctrl.abort(), firstByteMs);
      try {
        const res = await root.fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        return res;
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    }

    // Proveedor compatible con OpenAI. Acepta respuesta en streaming o JSON normal.
    async streamOpenAI(url, body, chat, onText, signal) {
      const res = await this.streamFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, messages: chat, stream: true })
      }, signal);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') || '';
      let full = '';
      if (!/event-stream/.test(type)) {
        const data = await res.json();
        full = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        if (full.trim()) onText(full.trim());
        return full.trim();
      }
      await this.readSSE(res, (payload) => {
        try {
          const data = JSON.parse(payload);
          const delta = data.choices && data.choices[0] && ((data.choices[0].delta && data.choices[0].delta.content) || (data.choices[0].message && data.choices[0].message.content));
          if (delta) {
            full += delta;
            onText(full);
          }
        } catch (e) { /* línea no JSON */ }
      });
      return full.trim();
    }

    // Lanza varios proveedores a la vez; gana el primero que empiece a escribir
    raceStreams(starters, onChunk) {
      return new Promise((resolve, reject) => {
        let winner = -1;
        let failed = 0;
        const ctrls = starters.map(() => new AbortController());
        const fail = (err) => {
          failed++;
          if (failed >= starters.length && winner === -1) reject(err);
        };
        starters.forEach((start, i) => {
          start(ctrls[i].signal, (full) => {
            if (winner === -1) {
              winner = i;
              ctrls.forEach((c, j) => { if (j !== i) c.abort(); });
            }
            if (winner === i) onChunk(full);
          }).then((full) => {
            if (winner === i || (winner === -1 && full)) {
              winner = i;
              if (full) resolve(full);
              else reject(new Error('respuesta vacía'));
            } else if (winner === -1) fail(new Error('respuesta vacía'));
          }).catch((err) => {
            if (winner === i) reject(err);
            else if (winner === -1) fail(err);
          });
        });
      });
    }

    streamFreeAI(messages, onChunk) {
      const chat = [
        { role: 'system', content: this.systemPrompt() },
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
      ];
      return this.raceStreams([
        (signal, onText) => this.streamOpenAI('https://text.pollinations.ai/openai', { model: 'openai', referrer: 'yarbis-veneco' }, chat, onText, signal),
        (signal, onText) => this.streamOpenAI('https://api.llm7.io/v1/chat/completions', { model: 'gpt-oss:20b' }, chat, onText, signal)
      ], onChunk);
    }

    async streamGemini(messages, onChunk) {
      const { res } = await this.geminiFetch(this.geminiChatBody(messages), { stream: true });
      let full = '';
      await this.readSSE(res, (payload) => {
        try {
          const data = JSON.parse(payload);
          const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
          const t = parts ? parts.map(p => p.text || '').join('') : '';
          if (t) {
            full += t;
            onChunk(full);
          }
        } catch (e) { /* línea no JSON */ }
      });
      if (!full.trim()) throw new Error('respuesta vacía');
      return full.trim();
    }

    /* ---------- Google Gemini ---------- */
    async listGeminiModels(key) {
      const res = await U.fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } }, 10000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(this.geminiErrorMessage(res.status, data));
        err.status = res.status;
        err.fatal = this.isGeminiKeyInvalid(res.status, data);
        throw err;
      }
      return (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));
    }

    // Modelos "normales" de Gemini, en orden de preferencia. Se descartan
    // vistas previas, voz, imagen y nombres en clave (argon, omni…), que en
    // cuentas gratis suelen estar saturados, sin cupo o sin permiso.
    geminiCandidates(models, pref = S.getRaw('yarbis_gemini_pref', 'auto')) {
      const NORMAL = /^gemini-(\d+(?:\.\d+)?)-(flash-lite|flash|pro)$/;
      const ALIAS = /^gemini-(flash-lite|flash|pro)-latest$/;
      const tiers = pref === 'pro' ? ['pro', 'flash', 'flash-lite'] : pref === 'lite' ? ['flash-lite', 'flash', 'pro'] : ['flash', 'flash-lite', 'pro'];
      const items = models.map(m => {
        let x = m.match(NORMAL);
        if (x) return { m, v: parseFloat(x[1]), tier: x[2] };
        x = m.match(ALIAS);
        return x ? { m, v: -1, tier: x[1] } : null;
      }).filter(Boolean);
      items.sort((a, b) => (tiers.indexOf(a.tier) - tiers.indexOf(b.tier)) || (b.v - a.v));
      return items.map(x => x.m);
    }

    chooseModel(models, pref = S.getRaw('yarbis_gemini_pref', 'auto')) {
      return this.geminiCandidates(models, pref)[0] || 'gemini-flash-latest';
    }

    setModelPreference(pref) {
      S.setRaw('yarbis_gemini_pref', ['pro', 'lite'].includes(pref) ? pref : 'auto');
      this.geminiModel = '';
      S.remove('yarbis_gemini_model');
    }

    geminiUrl(model, stream = false) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    }

    isGeminiKeyInvalid(status, data) {
      return status === 401 || /API key not valid|API_KEY_INVALID|API key expired|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(JSON.stringify(data || {}));
    }

    // Prueba en paralelo los mejores candidatos (incluidos los Lite, que casi
    // nunca se saturan) y se queda con el más preferido que responde de verdad.
    async pickWorkingGeminiModel(models, pref = S.getRaw('yarbis_gemini_pref', 'auto')) {
      const key = this.geminiApiKey;
      const bad = this.badGeminiModels();
      const candidates = this.geminiCandidates(models, pref);
      let all = candidates.filter(m => !bad.has(m));
      // Si casi todos quedaron apartados por fallos viejos, se prueban todos de nuevo
      if (all.length < 3) all = candidates;
      const batch = all.slice(0, 10);
      if (!batch.length) throw new Error('No encontré un modelo de Gemini que responda: tu clave no tiene modelos de Gemini disponibles.');
      const probe = async (model, retry = true) => {
        const sentThinking = !!this.thinkingConfig(model);
        try {
          const res = await U.fetchWithTimeout(this.geminiUrl(model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify(this.geminiBodyFor({ contents: [{ role: 'user', parts: [{ text: 'Responde solo: OK' }] }], generationConfig: { maxOutputTokens: 32 } }, model))
          }, this.geminiTimeouts.probe);
          if (res.ok) return { ok: true };
          const data = await res.json().catch(() => ({}));
          // Se prueban varios a la vez: cualquiera que reciba este error reintenta sin pensamiento
          if (retry && res.status === 400 && /thinking/i.test(JSON.stringify(data)) && sentThinking) {
            this.noThinkingConfig = true;
            return probe(model, false);
          }
          return { ok: false, status: res.status, data };
        } catch (e) {
          return { ok: false, status: 0, timeout: true };
        }
      };
      // Al primer modelo que responde se le dan 2 s a los preferidos que aún
      // no contestan; los que se cuelgan no hacen esperar más.
      const results = await new Promise(resolve => {
        const res = new Array(batch.length);
        let done = 0;
        let grace = null;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(grace);
          resolve(res);
        };
        const check = () => {
          for (let i = 0; i < batch.length; i++) {
            if (!res[i]) break;
            if (res[i].ok) return finish();
          }
          if (done === batch.length) finish();
        };
        batch.forEach((m, i) => probe(m).then(r => {
          res[i] = r;
          done++;
          if (r.ok && !grace) grace = setTimeout(finish, this.geminiTimeouts.grace);
          check();
        }));
      });
      const win = results.findIndex(r => r && r.ok);
      // Se apartan por un rato los que fallaron. Sin ningún ganador, un cuelgue
      // puede ser la conexión del teléfono y no el modelo: ésos no se apartan.
      batch.forEach((m, i) => {
        const r = results[i];
        if (i === win || (r && r.ok)) return;
        if (!r || r.timeout || r.status >= 500) {
          if (win >= 0) this.markBadGeminiModel(m, 30 * 60000);
        } else {
          this.markBadGeminiModel(m, r.status === 429 ? 10 * 60000 : undefined);
        }
      });
      if (win >= 0) return batch[win];
      const got = results.filter(Boolean);
      const invalid = got.find(r => this.isGeminiKeyInvalid(r.status, r.data));
      if (invalid) {
        const err = new Error(this.geminiErrorMessage(invalid.status || 401, invalid.data));
        err.fatal = true;
        throw err;
      }
      const count = (fn) => got.filter(fn).length;
      const text = (r) => String((r.data && r.data.error && r.data.error.message) || '');
      let why = 'ningún modelo respondió; inténtalo en unos minutos';
      if (got.length && count(r => r.timeout) === got.length) why = 'Google no contestó a tiempo. Revisa tu conexión a internet (datos o wifi) e inténtalo de nuevo';
      else if (count(r => /location is not supported|not available in your (country|region)/i.test(text(r)))) why = 'Google dice que Gemini no está disponible desde tu ubicación. Si usas una VPN, apágala (o elige otro país) e inténtalo de nuevo';
      else if (count(r => r.status === 429) >= got.length / 2) why = 'se agotó el cupo gratis por ahora; espera un minuto';
      else if (count(r => r.status === 403) >= got.length / 2) why = 'tu clave no tiene permiso para usar los modelos de Gemini';
      else if (count(r => r.status >= 500) >= got.length / 2) why = 'los modelos están saturados; inténtalo en unos minutos';
      const err = new Error(`No encontré un modelo de Gemini que responda: ${why}.`);
      err.detail = this.geminiProbeDetail(batch, results);
      throw err;
    }

    // Resumen de lo que contestó cada modelo, para saber por qué falló
    // ("6 no contestaron a tiempo · 4 × HTTP 400: User location is not supported")
    geminiProbeDetail(batch, results) {
      const groups = new Map();
      batch.forEach((m, i) => {
        const r = results[i];
        if (r && r.ok) return;
        const msg = r && !r.timeout ? `HTTP ${r.status}${r.data && r.data.error && r.data.error.message ? `: ${String(r.data.error.message).slice(0, 90)}` : ''}` : 'no contestaron a tiempo';
        groups.set(msg, [...(groups.get(msg) || []), m.replace(/^gemini-/, '')]);
      });
      return [...groups].map(([msg, ms]) => `${ms.length} ${msg === 'no contestaron a tiempo' ? msg : `× ${msg}`} (${ms.join(', ')})`).join(' · ');
    }

    async resolveGeminiModel(key, force = false) {
      if (this.geminiModel && !force) return this.geminiModel;
      const models = await this.listGeminiModels(key);
      this.geminiModelList = models;
      if (force) S.remove('yarbis_gemini_bad');
      try {
        this.geminiModel = await this.pickWorkingGeminiModel(models);
      } catch (e) {
        // Los modelos apartados por fallos anteriores pueden estar bien ahora: otra vez con todos
        if (e.fatal || force || !this.badGeminiModels().size) throw e;
        S.remove('yarbis_gemini_bad');
        this.geminiModel = await this.pickWorkingGeminiModel(models);
      }
      S.setRaw('yarbis_gemini_model', this.geminiModel);
      return this.geminiModel;
    }

    // Pensamiento corto: respuestas rápidas para voz. Sin esto, Gemini 2.5 puede
    // gastar todos los tokens "pensando" y devolver una respuesta vacía.
    thinkingConfig(model) {
      if (this.noThinkingConfig) return null;
      if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
      if (/^gemini-2\.5-pro/.test(model)) return { thinkingBudget: 128 };
      if (/^gemini-([3-9]|\d{2})/.test(model)) return { thinkingLevel: 'low' };
      return null;
    }

    geminiBodyFor(body, model) {
      const generationConfig = { maxOutputTokens: 8192, ...(body.generationConfig || {}) };
      const tc = this.thinkingConfig(model);
      if (tc && !generationConfig.thinkingConfig) generationConfig.thinkingConfig = tc;
      if (!tc) delete generationConfig.thinkingConfig;
      return { ...body, generationConfig };
    }

    geminiErrorMessage(status, data) {
      const raw = (data && data.error && data.error.message) || `HTTP ${status}`;
      if (this.isGeminiKeyInvalid(status, data)) return 'La clave de Gemini no es válida o expiró. Cópiala de nuevo desde Google AI Studio.';
      if (status === 403) return 'Tu clave no tiene permiso para ese modelo de Gemini.';
      if (status === 429) return 'Se agotó por ahora el cupo gratis de Gemini. Espera un minuto o elige el modelo "Ahorro" en Ajustes.';
      if (status >= 500) return 'Gemini está saturado en este momento. Inténtalo de nuevo en unos segundos.';
      return raw;
    }

    // Otro modelo para reintentar. Sin cupo: primero los Lite, que tienen más.
    async alternateGeminiModel(tried, quota = false) {
      let models = this.geminiModelList;
      if (!models) {
        try { models = this.geminiModelList = await this.listGeminiModels(this.geminiApiKey); } catch (e) { return null; }
      }
      const bad = this.badGeminiModels();
      const pref = quota ? 'lite' : S.getRaw('yarbis_gemini_pref', 'auto');
      return this.geminiCandidates(models, pref).find(m => !tried.has(m) && !bad.has(m)) || null;
    }

    // Modelos que fallaron o se colgaron: se evitan por un tiempo (6 h por defecto)
    badGeminiModels() {
      const saved = S.get('yarbis_gemini_bad', {}) || {};
      const now = Date.now();
      return new Set(Object.keys(saved).filter(m => saved[m] > now));
    }

    markBadGeminiModel(model, ms = 6 * 3600 * 1000) {
      const saved = S.get('yarbis_gemini_bad', {}) || {};
      saved[model] = Date.now() + ms;
      S.set('yarbis_gemini_bad', saved);
    }

    // Todas las llamadas a Gemini pasan por aquí: elige modelo, ajusta el
    // pensamiento y, si un modelo falla (sin permiso, colgado, saturado, sin
    // cupo o retirado), prueba con otro.
    async geminiFetch(body, { stream = false, noAlternate = false } = {}) {
      const key = this.geminiApiKey;
      if (!key) throw new Error('Sin clave de Gemini.');
      let model = await this.resolveGeminiModel(key);
      const tried = new Set();
      let persist = false;
      let lastErr = null;
      const switchTo = async (keep, quota = false, badFor = undefined) => {
        if (noAlternate) return false;
        const alt = await this.alternateGeminiModel(tried, quota);
        if (!alt) return false;
        if (keep) {
          this.markBadGeminiModel(model, badFor);
          persist = true;
        }
        model = alt;
        return true;
      };
      for (let attempt = 0; attempt < 5; attempt++) {
        tried.add(model);
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(this.geminiBodyFor(body, model)) };
        let res;
        try {
          res = stream
            ? await this.streamFetch(this.geminiUrl(model, true), opts, null, this.geminiTimeouts.stream)
            : await U.fetchWithTimeout(this.geminiUrl(model), opts, this.geminiTimeouts.request);
        } catch (e) {
          lastErr = new Error(e && e.name === 'AbortError' ? 'Gemini tardó demasiado en responder.' : `No se pudo conectar con Gemini (${e.message}).`);
          lastErr.status = 0;
          lastErr.timeout = true;
          if (await switchTo(true, false, 30 * 60000)) continue;
          throw lastErr;
        }
        if (res.ok) {
          if (persist && model !== this.geminiModel) {
            this.geminiModel = model;
            S.setRaw('yarbis_gemini_model', model);
          }
          return { res, model };
        }
        const data = await res.json().catch(() => ({}));
        const raw = JSON.stringify(data);
        lastErr = new Error(this.geminiErrorMessage(res.status, data));
        lastErr.status = res.status;
        lastErr.fatal = this.isGeminiKeyInvalid(res.status, data);
        if (lastErr.fatal) throw lastErr;
        if (res.status === 400 && /thinking/i.test(raw) && !this.noThinkingConfig) {
          this.noThinkingConfig = true;
          tried.delete(model);
          continue;
        }
        const retired = res.status === 404 || (res.status === 400 && /model/i.test(raw) && /not found|not supported|unsupported|deprecated/i.test(raw));
        if (retired || res.status === 403 || res.status >= 500) {
          // Saturado (5xx) suele pasar en minutos; sin permiso o retirado, no
          if (await switchTo(true, false, res.status >= 500 ? 30 * 60000 : undefined)) continue;
        } else if (res.status === 429) {
          if (await switchTo(false, true)) continue;
        }
        throw lastErr;
      }
      throw lastErr || new Error('Gemini no respondió.');
    }

    async geminiRequest(body) {
      const { res } = await this.geminiFetch(body);
      const data = await res.json().catch(() => ({}));
      const cand = data.candidates && data.candidates[0];
      const parts = cand && cand.content && cand.content.parts;
      const text = parts ? parts.filter(p => !p.thought).map(p => p.text || '').join('').trim() : '';
      if (!text) {
        const reason = (data.promptFeedback && data.promptFeedback.blockReason) || (cand && cand.finishReason);
        throw new Error(reason ? `respuesta vacía (${reason})` : 'respuesta vacía');
      }
      return text;
    }

    queryGemini(messages) {
      return this.geminiRequest(this.geminiChatBody(messages));
    }

    geminiChatBody(messages, system) {
      const contents = [];
      messages.forEach(m => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const last = contents[contents.length - 1];
        if (last && last.role === role) last.parts[0].text += `\n${m.text}`;
        else contents.push({ role, parts: [{ text: m.text }] });
      });
      if (contents.length && contents[0].role === 'model') contents.shift();
      return {
        system_instruction: { parts: [{ text: system || this.systemPrompt() }] },
        contents,
        generationConfig: { temperature: 0.6 }
      };
    }

    async testGeminiApiKey(rawKey) {
      const key = this.cleanKey(rawKey);
      if (!key) return { success: false, message: 'Pega tu clave primero.' };
      // Google usa dos formatos: las claves clásicas "AIza…" y las nuevas "AQ.…"
      if (!/^(AIza[\w-]{20,}|AQ\.[\w.-]{20,})$/.test(key)) {
        return { success: false, message: 'Esa no parece una clave de Google AI Studio (empieza por "AIza…" o "AQ.…"). Cópiala completa.' };
      }
      const prevKey = this.geminiApiKey;
      const prevModel = this.geminiModel;
      try {
        this.geminiApiKey = key;
        this.geminiModelList = null;
        // Elige, probándolos, el mejor modelo que responde con esta clave
        const model = await this.resolveGeminiModel(key, true);
        return { success: true, message: `✅ Clave válida. Gemini es tu cerebro (modelo ${model}).`, model };
      } catch (e) {
        this.geminiApiKey = prevKey;
        this.geminiModel = prevModel;
        if (prevModel) S.setRaw('yarbis_gemini_model', prevModel);
        else S.remove('yarbis_gemini_model');
        return { success: false, message: `❌ ${e.name === 'AbortError' ? 'Gemini tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.' : e.message}${e.detail ? ` Detalle: ${e.detail}` : ''}` };
      }
    }

    /* ---------- IA gratuita (sin clave) ---------- */
    // Pregunta a dos servicios gratuitos a la vez y usa la primera respuesta válida.
    // Pollinations sólo acepta peticiones desde páginas publicadas (en localhost pide
    // un captcha), LLM7 funciona en ambos casos.
    async queryFreeAI(messages, system) {
      const chat = [
        { role: 'system', content: system || this.systemPrompt() },
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
      ];
      const valid = (t) => t && typeof t === 'string' && t.trim().length > 0 && !/<!doctype|<html/i.test(t) && !/^\s*\{\s*"error"/.test(t);
      const openAiChat = async (url, body, ms) => {
        const res = await U.fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, messages: chat })
        }, ms);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const t = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!valid(t)) throw new Error('respuesta vacía');
        return t.trim();
      };

      const providers = [
        openAiChat('https://text.pollinations.ai/openai', { model: 'openai', referrer: 'yarbis-veneco' }, 25000),
        openAiChat('https://api.llm7.io/v1/chat/completions', { model: 'gpt-oss:20b' }, 25000)
      ];
      try {
        return await Promise.any(providers);
      } catch (e) {
        (e.errors || [e]).forEach(err => console.warn('IA gratuita:', err.message));
      }
      // Último intento: el modelo que LLM7 tenga disponible
      try {
        return await openAiChat('https://api.llm7.io/v1/chat/completions', { model: 'default' }, 20000);
      } catch (e) {
        console.warn('IA gratuita (respaldo):', e.message);
      }
      return null;
    }

    /* ---------- Diagnóstico: prueba cada motor de IA y dice qué falla ---------- */
    async diagnoseAI() {
      const out = [];
      const add = (ok, name, detail, info = false) => out.push({ ok, name, detail, info });
      if (this.geminiApiKey) {
        try {
          // Vuelve a elegir, probando en paralelo, un modelo que responda ahora
          await this.resolveGeminiModel(this.geminiApiKey, true);
          const { model } = await this.geminiFetch({ contents: [{ role: 'user', parts: [{ text: 'Responde solo: OK' }] }], generationConfig: { maxOutputTokens: 256 } });
          add(true, 'Gemini', `responde (modelo ${model})`);
          try {
            const r = await root.YarbisGemini.run(this, [{ role: 'user', text: 'Usa la herramienta tasas_del_dia y dime sólo la tasa del dólar BCV.' }]);
            add(r.tools.length > 0, 'Gemini como cerebro', r.tools.length ? `usó ${r.tools.join(', ')}: ${r.text.slice(0, 80)}` : 'respondió sin usar las herramientas');
          } catch (e) {
            add(false, 'Gemini como cerebro', e.message);
          }
          try {
            const { res } = await this.geminiFetch({ contents: [{ role: 'user', parts: [{ text: '¿Qué día es hoy?' }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 256 } }, { noAlternate: true });
            await res.json().catch(() => ({}));
            S.remove('yarbis_gemini_search_off');
            add(true, 'Búsqueda en Google', 'disponible');
          } catch (e) {
            if (e.status === 429 || e.status === 403 || e.status === 400) {
              S.setRaw('yarbis_gemini_search_off', String(Date.now()));
              add(false, 'Búsqueda en Google', 'no está incluida en tu plan gratis; YARBIS busca en Wikipedia', true);
            } else {
              add(false, 'Búsqueda en Google', e.message);
            }
          }
        } catch (e) {
          add(false, 'Gemini', e.detail ? `${e.message} Detalle: ${e.detail}` : e.message);
        }
      } else {
        add(false, 'Gemini', 'sin clave: pégala arriba y toca "Guardar y probar"');
      }
      const P = root.YarbisAIProviders;
      if (P && P.isReady()) {
        try {
          await P.complete('Responde exactamente: OK', 'Di OK');
          add(true, P.label(), `responde (modelo ${await P.resolveModel()})`);
        } catch (e) {
          add(false, P.label(), e.message);
        }
      }
      try {
        const t = await this.queryFreeAI([{ role: 'user', text: 'Responde solo: OK' }], 'Responde en una palabra.');
        add(!!t, 'IA gratuita (respaldo)', t ? 'responde' : 'no respondió');
      } catch (e) {
        add(false, 'IA gratuita (respaldo)', e.message);
      }
      return out;
    }

    /* ---------- Voz a texto (cuando el navegador no reconoce voz) ---------- */
    canTranscribe() {
      const P = root.YarbisAIProviders;
      return !!this.geminiApiKey || !!(P && P.canTranscribe && P.canTranscribe());
    }

    async transcribeAudio(blob, lang = 'es-ES') {
      const errors = [];
      const langName = /^en/i.test(lang) ? 'inglés' : /^pt/i.test(lang) ? 'portugués' : /^fr/i.test(lang) ? 'francés' : /^it/i.test(lang) ? 'italiano' : /^de/i.test(lang) ? 'alemán' : 'español';
      if (this.geminiApiKey) {
        try {
          const data = await root.YarbisRecorder.blobToBase64(blob);
          const mime = String(blob.type || 'audio/webm').split(';')[0];
          const text = await this.geminiRequest({
            contents: [{
              role: 'user',
              parts: [
                { text: `Transcribe exactamente lo que dice esta grabación (está en ${langName}). Escribe sólo las palabras dichas, sin comillas, sin traducir y sin comentarios. Si no se entiende ninguna palabra, responde exactamente: [vacío]` },
                { inline_data: { mime_type: mime, data } }
              ]
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 1000 }
          });
          const clean = String(text).replace(/^["“'\s]+|["”'\s]+$/g, '').trim();
          return /^\[?vac[ií]o\]?\.?$/i.test(clean) ? '' : clean;
        } catch (e) {
          errors.push(`Gemini: ${e.message}`);
        }
      }
      const P = root.YarbisAIProviders;
      if (P && P.canTranscribe && P.canTranscribe()) {
        try {
          return await P.transcribe(blob, lang);
        } catch (e) {
          errors.push(`${P.label()}: ${e.message}`);
        }
      }
      throw new Error(errors.join(' · ') || 'agrega tu clave de Gemini en Ajustes');
    }

    /* ---------- Visión ---------- */
    visionPrompt(mode) {
      if (mode === 'document') return 'Transcribe con exactitud todo el texto visible en la imagen, respetando títulos y listas. Si es una factura, recibo o documento, al final resume los datos clave (montos, fechas, nombres) en una lista.';
      if (mode === 'translate') return 'Detecta el texto de la imagen y tradúcelo fielmente al español. Muestra primero la traducción y, si es útil, el texto original debajo.';
      return 'Describe en español lo que ves en la imagen de forma útil y breve: identifica objetos, lugares, personas (sin identificar a nadie por su nombre), textos visibles y cualquier dato relevante.';
    }

    async analyzeImage(dataUrl, mode = 'general') {
      const prompt = this.visionPrompt(mode);
      const base64 = String(dataUrl).replace(/^data:image\/[\w+.-]+;base64,/, '');
      const errors = [];

      if (this.geminiApiKey) {
        try {
          const text = await this.geminiRequest({
            contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64 } }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1500 }
          });
          return { text, ok: true };
        } catch (e) {
          errors.push(`Gemini: ${e.message}`);
        }
      }

      const P = root.YarbisAIProviders;
      if (P && P.isReady()) {
        try {
          const text = await P.vision(prompt, dataUrl);
          if (text) return { text, ok: true };
        } catch (e) {
          errors.push(`${P.label()}: ${e.message}`);
        }
      }

      try {
        const res = await U.fetchWithTimeout('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai',
            referrer: 'yarbis-veneco',
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }]
          })
        }, 40000);
        if (res.ok) {
          const data = await res.json();
          const t = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (t && t.trim()) return { text: t.trim(), ok: true };
        }
        errors.push(`IA gratuita: HTTP ${res.status}`);
      } catch (e) {
        errors.push(`IA gratuita: ${e.message}`);
      }

      return {
        ok: false,
        text: `⚠️ No pude analizar la imagen. ${this.geminiApiKey ? 'Revisa tu clave de Gemini o tu conexión.' : 'Agrega tu clave gratuita de Google Gemini en Ajustes para usar la visión de forma estable.'}`,
        detail: errors.join(' · ')
      };
    }
  }

  // Utilidades expuestas para pruebas
  YARBISBrain.parseDuration = parseDuration;
  YARBISBrain.parseClock = parseClock;
  YARBISBrain.parseAmount = parseAmount;
  YARBISBrain.parseRepeat = parseRepeat;
  YARBISBrain.parseDay = parseDay;
  YARBISBrain.venezuelanPhone = venezuelanPhone;
  YARBISBrain.align = align;

  root.YARBISBrain = YARBISBrain;
})(typeof window !== 'undefined' ? window : globalThis);
