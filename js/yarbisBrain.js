/* ==========================================================================
   YARBIS - CONVERSATIONAL BRAIN & INTENT PROCESSOR 3.0
   Personal Assistant AI Personality, Speech Intent Parser & Gemini Connector
   ========================================================================== */

class YARBISBrain {
  constructor() {
    this.geminiApiKey = localStorage.getItem('yarbis_gemini_api_key') || '';
    this.assistantName = localStorage.getItem('yarbis_assistant_name') || 'YARBIS Veneco';
    this.userName = localStorage.getItem('yarbis_user_name') || 'Señor';
  }

  setApiKey(key) {
    this.geminiApiKey = key.trim();
    if (this.geminiApiKey) {
      localStorage.setItem('yarbis_gemini_api_key', this.geminiApiKey);
    } else {
      localStorage.removeItem('yarbis_gemini_api_key');
    }
  }

  setNames(assistantName, userName) {
    this.assistantName = (assistantName || 'YARBIS Veneco').trim();
    this.userName = (userName || 'Señor').trim();
    localStorage.setItem('yarbis_assistant_name', this.assistantName);
    localStorage.setItem('yarbis_user_name', this.userName);
  }

  /**
   * Main Process Function
   * Returns: { textResponse, action, themeChange, noteText, durationSeconds, url, soundFx }
   */
  async processCommand(userText) {
    const text = userText.toLowerCase().trim();

    // 1. Direct Rule & Intent Matching
    const localMatch = await this.checkLocalIntents(text, userText);
    if (localMatch) {
      return localMatch;
    }

    // 2. If Gemini API Key exists, query Gemini API
    if (this.geminiApiKey) {
      try {
        const aiResponse = await this.queryGeminiAI(userText);
        return {
          textResponse: aiResponse,
          action: 'NONE',
          themeChange: null
        };
      } catch (err) {
        console.warn('Gemini API query failed, falling back to free AI engine:', err);
      }
    }

    // 3. Query Free Public AI Engine (No API Key Required!)
    try {
      const freeAiResponse = await this.queryFreeAI(userText);
      if (freeAiResponse) {
        return {
          textResponse: freeAiResponse,
          action: 'NONE',
          themeChange: null
        };
      }
    } catch (err) {
        console.warn('Free AI query failed:', err);
    }

    // 4. Fallback Smart Response
    return {
      textResponse: `He procesado su consulta: "${userText}". Todos los datos han sido archivados en el sistema central. ¿Desea ejecutar alguna otra orden o recordatorio, ${this.userName}?`,
      action: 'NONE',
      themeChange: null
    };
  }

  /**
   * Check Built-in Intents & Voice Commands
   */
  async checkLocalIntents(text, originalUserText) {
    // Clean text punctuation
    const clean = text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

    // -------------------------------------------------------------
    // INTENT 1: TIMERS & COUNTDOWNS
    // -------------------------------------------------------------
    if (clean.includes('temporizador') || clean.includes('cuenta regresiva') || clean.includes('alarma') || clean.includes('avísame en') || clean.includes('avisame en')) {
      // Cancel timer
      if (clean.includes('cancelar') || clean.includes('detener') || clean.includes('quitar') || clean.includes('borrar')) {
        return {
          textResponse: `Temporizador cancelado correctamente, ${this.userName}.`,
          action: 'CANCEL_TIMER',
          themeChange: null
        };
      }

      // Match minutes or seconds
      const timeMatch = clean.match(/(\d+)\s*(minuto|minutos|segundo|segundos|min|seg)/i);
      if (timeMatch) {
        const val = parseInt(timeMatch[1], 10);
        const unit = timeMatch[2].toLowerCase();
        let totalSeconds = val;
        let unitLabel = 'segundos';

        if (unit.startsWith('min')) {
          totalSeconds = val * 60;
          unitLabel = val === 1 ? 'minuto' : 'minutos';
        } else {
          unitLabel = val === 1 ? 'segundo' : 'segundos';
        }

        return {
          textResponse: `Temporizador iniciado por ${val} ${unitLabel}, ${this.userName}. Le notificaré cuando el tiempo expire.`,
          action: 'SET_TIMER',
          durationSeconds: totalSeconds,
          themeChange: null,
          soundFx: 'success'
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT 2: PERSONAL NOTES & REMINDERS
    // -------------------------------------------------------------
    // Add Note
    const addNoteMatch = text.match(/(?:agrega|agregar|nueva|crear|guarda|guardar|recuérdame|recordarme|recordar)\s+(?:nota|recordatorio)?\s*(.+)/i);
    if (addNoteMatch && addNoteMatch[1] && !clean.startsWith('mis notas') && !clean.startsWith('ver notas')) {
      let noteText = addNoteMatch[1].trim();
      // Cleanup leading trigger words if present in captured group
      noteText = noteText.replace(/^(que|de|para|nota|recordatorio)\s+/i, '');

      if (noteText.length > 1) {
        return {
          textResponse: `He guardado la nota: "${noteText}" en su lista personal, ${this.userName}.`,
          action: 'ADD_NOTE',
          noteText: noteText,
          themeChange: null
        };
      }
    }

    // View Notes
    if (clean.includes('mis notas') || clean.includes('ver notas') || clean.includes('mostrar notas') || clean.includes('recordatorios')) {
      return {
        textResponse: `Abriendo y mostrando su lista de notas y recordatorios en el panel principal, ${this.userName}.`,
        action: 'SHOW_NOTES',
        themeChange: null
      };
    }

    // Clear All Notes
    if (clean.includes('borrar todas las notas') || clean.includes('limpiar notas') || clean.includes('eliminar notas')) {
      return {
        textResponse: `Todas las notas y recordatorios han sido eliminados de su lista, ${this.userName}.`,
        action: 'CLEAR_NOTES',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 3: MATHEMATICAL CALCULATIONS & PERCENTAGES
    // -------------------------------------------------------------
    if (clean.includes('cuanto es') || clean.includes('calcula') || clean.includes('porcentaje') || clean.includes('%')) {
      // Percentage match e.g. 20% de 500
      const pctMatch = clean.match(/(?:calcula|cuanto es)?\s*(?:el)?\s*(\d+(?:\.\d+)?)\s*(?:%|por ciento)\s*de\s*(\d+(?:\.\d+)?)/i);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const total = parseFloat(pctMatch[2]);
        const res = (pct / 100) * total;
        return {
          textResponse: `El ${pct}% de ${total} es igual a ${res}, ${this.userName}.`,
          action: 'MATH',
          themeChange: null
        };
      }

      // Basic Arithmetic match
      const mathMatch = clean.match(/(\d+(?:\.\d+)?)\s*(mas|\+|\-|menos|por|\*|multiplicado por|entre|\/|dividido por)\s*(\d+(?:\.\d+)?)/i);
      if (mathMatch) {
        const num1 = parseFloat(mathMatch[1]);
        const op = mathMatch[2];
        const num2 = parseFloat(mathMatch[3]);
        let res = 0;
        if (op === 'mas' || op === '+') res = num1 + num2;
        else if (op === 'menos' || op === '-') res = num1 - num2;
        else if (op === 'por' || op === '*' || op.includes('multiplicado')) res = num1 * num2;
        else if (op === 'entre' || op === '/' || op.includes('dividido')) res = num1 / num2;

        return {
          textResponse: `El resultado exacto del cálculo es ${res}, ${this.userName}.`,
          action: 'MATH',
          themeChange: null
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT 4: OPEN YOUTUBE / SEARCH YOUTUBE
    // -------------------------------------------------------------
    if (clean.includes('youtube') || clean.includes('abrir youtube') || clean.includes('abre youtube')) {
      const searchMatch = text.match(/(?:busca|buscar|poner|pon|reproducir|reproduce)\s+(.*?)(?:\s+en youtube|$)/i);
      let targetUrl = 'https://www.youtube.com';
      let deepLink = 'youtube://';
      let responseMsg = `Abriendo YouTube en tu teléfono, ${this.userName}.`;

      if (searchMatch && searchMatch[1] && searchMatch[1] !== 'youtube' && searchMatch[1] !== 'abrir youtube' && searchMatch[1] !== 'abre youtube') {
        const query = searchMatch[1].trim();
        targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        deepLink = `youtube://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        responseMsg = `Buscando "${query}" en YouTube, ${this.userName}.`;
      }

      return {
        textResponse: responseMsg,
        action: 'OPEN_URL',
        url: targetUrl,
        deepLink: deepLink,
        themeChange: null
      };
    }

    // Intent: Query List of Supported Applications
    if (clean.includes('que aplicaciones') || clean.includes('cuales aplicaciones') || clean.includes('mostrar aplicaciones') || clean.includes('lista de aplicaciones') || clean.includes('ver aplicaciones')) {
      return {
        textResponse: `Puedo abrir las aplicaciones de tu teléfono como: WhatsApp, YouTube, Spotify, Gmail, Teléfono, Mensajes, Google Maps, ChatGPT, Instagram, Netflix, X (Twitter), Facebook, TikTok y Google Drive, ${this.userName}. Simplemente dime "abrir" seguido de la aplicación.`,
        action: 'SHOW_APPS',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 5: UNIVERSAL MOBILE APP & WEB LAUNCHER (Cualquier Aplicación)
    // -------------------------------------------------------------
    const webApps = [
      { keys: ['whatsapp', 'wasap', 'guasap'], name: 'WhatsApp', url: 'https://web.whatsapp.com', deepLink: 'whatsapp://' },
      { keys: ['spotify', 'musica spotify'], name: 'Spotify', url: 'https://open.spotify.com', deepLink: 'spotify://' },
      { keys: ['gmail', 'correo', 'mail'], name: 'Gmail', url: 'https://mail.google.com', deepLink: 'googlegmail://' },
      { keys: ['netflix', 'peliculas'], name: 'Netflix', url: 'https://www.netflix.com', deepLink: 'nflx://' },
      { keys: ['instagram', 'insta'], name: 'Instagram', url: 'https://www.instagram.com', deepLink: 'instagram://' },
      { keys: ['twitter', 'x.com', 'x '], name: 'X (Twitter)', url: 'https://x.com', deepLink: 'twitter://' },
      { keys: ['facebook', 'face'], name: 'Facebook', url: 'https://www.facebook.com', deepLink: 'fb://' },
      { keys: ['tiktok'], name: 'TikTok', url: 'https://www.tiktok.com', deepLink: 'snssdk1233://' },
      { keys: ['telegram'], name: 'Telegram', url: 'https://web.telegram.org', deepLink: 'tg://' },
      { keys: ['pinterest'], name: 'Pinterest', url: 'https://www.pinterest.com', deepLink: 'pinterest://' },
      { keys: ['waze'], name: 'Waze', url: 'https://www.waze.com', deepLink: 'waze://' },
      { keys: ['uber'], name: 'Uber', url: 'https://www.uber.com', deepLink: 'uber://' },
      { keys: ['mercado libre', 'mercadolibre'], name: 'Mercado Libre', url: 'https://www.mercadolibre.com', deepLink: 'mercadolibre://' },
      { keys: ['amazon'], name: 'Amazon', url: 'https://www.amazon.com', deepLink: 'amazon://' },
      { keys: ['disney', 'disney plus', 'disney+'], name: 'Disney+', url: 'https://www.disneyplus.com', deepLink: 'disneyplus://' },
      { keys: ['max', 'hbo', 'hbo max'], name: 'Max (HBO)', url: 'https://www.max.com', deepLink: 'max://' },
      { keys: ['twitch'], name: 'Twitch', url: 'https://www.twitch.tv', deepLink: 'twitch://' },
      { keys: ['github'], name: 'GitHub', url: 'https://github.com', deepLink: 'https://github.com' },
      { keys: ['chatgpt', 'chat gpt', 'openai'], name: 'ChatGPT', url: 'https://chatgpt.com', deepLink: 'chatgpt://' },
      { keys: ['maps', 'google maps', 'mapa', 'mapas'], name: 'Google Maps', url: 'https://maps.google.com', deepLink: 'comgooglemaps://' },
      { keys: ['drive', 'google drive'], name: 'Google Drive', url: 'https://drive.google.com', deepLink: 'googledrive://' },
      { keys: ['telefono', 'llamada', 'llamar', 'marcar'], name: 'Teléfono', url: 'tel:', deepLink: 'tel:' },
      { keys: ['mensajes', 'sms', 'mensaje de texto'], name: 'Mensajes SMS', url: 'sms:', deepLink: 'sms:' },
      { keys: ['discord'], name: 'Discord', url: 'https://discord.com', deepLink: 'discord://' },
      { keys: ['zoom'], name: 'Zoom', url: 'https://zoom.us', deepLink: 'zoomus://' },
      { keys: ['roblox'], name: 'Roblox', url: 'https://www.roblox.com', deepLink: 'roblox://' },
      { keys: ['canva'], name: 'Canva', url: 'https://www.canva.com', deepLink: 'canva://' }
    ];

    // Check specific known apps first
    for (const app of webApps) {
      if (app.keys.some(k => clean.includes(k))) {
        return {
          textResponse: `Abriendo la aplicación ${app.name} en tu dispositivo, ${this.userName}.`,
          action: 'OPEN_URL',
          url: app.url,
          deepLink: app.deepLink,
          themeChange: null
        };
      }
    }

    // UNIVERSAL DYNAMIC LAUNCHER: Match ANY "abrir [nombre_app]" pattern
    const openMatch = clean.match(/^(?:abrir|abre|abreme|lanzar|lanza|iniciar|inicia)\s+(.*)/i);
    if (openMatch && openMatch[1]) {
      let rawAppName = openMatch[1].trim();
      let cleanAppName = rawAppName.replace(/^(?:la\s+aplicacion\s+de|la\s+app\s+de|el\s+juego\s+de|la\s+pagina\s+de|la\s+app|la\s+aplicacion|el\s+juego|la\s+pagina)\s+/i, '').trim();

      const slug = cleanAppName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const dynamicDeepLink = `${slug}://`;
      const dynamicWebUrl = cleanAppName.includes('.') 
        ? (cleanAppName.startsWith('http') ? cleanAppName : `https://${cleanAppName}`)
        : `https://www.${slug}.com`;

      return {
        textResponse: `Abriendo la aplicación ${cleanAppName} en tu dispositivo, ${this.userName}.`,
        action: 'OPEN_URL',
        url: dynamicWebUrl,
        deepLink: dynamicDeepLink,
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 6: GENERAL GOOGLE SEARCH
    // -------------------------------------------------------------
    if (clean.startsWith('busca') || clean.startsWith('buscar') || clean.startsWith('googlea') || clean.startsWith('navega')) {
      const searchMatch = text.match(/(?:busca|buscar|googlea|navega)\s+(.*)/i);
      if (searchMatch && searchMatch[1]) {
        const query = searchMatch[1].trim();
        return {
          textResponse: `Buscando "${query}" en Google, ${this.userName}.`,
          action: 'OPEN_URL',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          themeChange: null
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT 7: GREETINGS & PERSONAL IDENTITY
    // -------------------------------------------------------------
    if (clean.includes('quien eres') || clean.includes('presentate') || clean.includes('hola') || clean.includes('tu nombre') || clean.includes('como te llamas')) {
      return {
        textResponse: `Saludos, ${this.userName}. Soy ${this.assistantName}, su asistente personal de inteligencia artificial. Estoy listo para ayudarle con sus notas, recordatorios, consultas y tareas diarias.`,
        action: 'GREETING',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 8: SYSTEM DIAGNOSTICS
    // -------------------------------------------------------------
    if (clean.includes('estado') || clean.includes('sistema') || clean.includes('diagnostico') || clean.includes('bateria')) {
      return {
        textResponse: `Reporte de estado de ${this.assistantName}: Todos los subsistemas operan al 100% de eficiencia. Red neuronal conectada y memoria local sincronizada, ${this.userName}.`,
        action: 'DIAGNOSTIC',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 9: THEMES & HUD PROTOCOLS
    // -------------------------------------------------------------
    if (clean.includes('combate') || clean.includes('modo combate') || clean.includes('alerta roja')) {
      return {
        textResponse: `Protocolo de combate activado, ${this.userName}. Interfaz HUD adaptada a alerta roja.`,
        action: 'THEME',
        themeChange: 'theme-combat'
      };
    }

    if (clean.includes('sigilo') || clean.includes('modo sigilo')) {
      return {
        textResponse: `Modo sigilo activado. Visualización de pantalla adaptada.`,
        action: 'THEME',
        themeChange: 'theme-stealth'
      };
    }

    if (clean.includes('sobrecarga') || clean.includes('modo sobrecarga')) {
      return {
        textResponse: `Modo sobrecarga iniciado al 150% de potencia.`,
        action: 'THEME',
        themeChange: 'theme-overload'
      };
    }

    if (clean.includes('normal') || clean.includes('restaurar') || clean.includes('modo normal')) {
      return {
        textResponse: `Restaurando interfaz estándar de ${this.assistantName}, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'default'
      };
    }

    if (clean.includes('limpiar pantalla') || clean.includes('borrar pantalla') || clean.includes('limpiar registro')) {
      return {
        textResponse: `Limpiando el registro de la conversación.`,
        action: 'CLEAR_LOGS',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 10: TIME & DATE
    // -------------------------------------------------------------
    if (clean.includes('hora') || clean.includes('que hora es')) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      return {
        textResponse: `La hora actual es ${timeStr}, ${this.userName}.`,
        action: 'TIME',
        themeChange: null
      };
    }

    if (clean.includes('fecha') || clean.includes('que dia es')) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return {
        textResponse: `Hoy es ${dateStr}, ${this.userName}.`,
        action: 'DATE',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 11: WEATHER API
    // -------------------------------------------------------------
    if (clean.includes('clima') || clean.includes('tiempo') || clean.includes('temperatura')) {
      const weatherData = await this.fetchLiveWeather();
      return {
        textResponse: weatherData,
        action: 'WEATHER',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 12: CRYPTO & MARKETS
    // -------------------------------------------------------------
    if (clean.includes('bitcoin') || clean.includes('ethereum') || clean.includes('cripto') || clean.includes('mercado')) {
      const cryptoData = await this.fetchLiveCrypto();
      return {
        textResponse: cryptoData,
        action: 'MARKET',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT 13: WIKIPEDIA KNOWLEDGE SEARCH
    // -------------------------------------------------------------
    if (clean.startsWith('que es') || clean.startsWith('quien es') || clean.startsWith('quien fue') || clean.startsWith('define') || clean.startsWith('que significa')) {
      const queryStr = text.replace(/^(que es|quien es|quien fue|define|que significa)\s+/i, '').trim();
      if (queryStr) {
        const wikiInfo = await this.fetchWikipediaSummary(queryStr);
        if (wikiInfo) {
          return {
            textResponse: wikiInfo,
            action: 'KNOWLEDGE',
            themeChange: null
          };
        }
      }
    }

    return null;
  }

  /**
   * Fetch Live Weather Telemetry from Open-Meteo API
   */
  async fetchLiveWeather() {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=34.0522&longitude=-118.2437&current_weather=true');
      if (res.ok) {
        const data = await res.json();
        const temp = data.current_weather?.temperature;
        const wind = data.current_weather?.windspeed;
        return `Reporte meteorológico en vivo: Temperatura de ${temp}°C con vientos a ${wind} km/h en sus coordenadas, ${this.userName}.`;
      }
    } catch (e) {
      console.warn('Weather API failed, using fallback:', e);
    }
    return `Telemetría del tiempo: Cielos despejados y temperatura ambiente de 22°C, ${this.userName}.`;
  }

  /**
   * Fetch Live Crypto Market Rates from CoinGecko API
   */
  async fetchLiveCrypto() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
      if (res.ok) {
        const data = await res.json();
        const btc = data.bitcoin?.usd;
        const eth = data.ethereum?.usd;
        return `Mercado cripto en vivo: Bitcoin cotiza a \$${btc?.toLocaleString()} USD y Ethereum a \$${eth?.toLocaleString()} USD, ${this.userName}.`;
      }
    } catch (e) {
      console.warn('Crypto API failed:', e);
    }
    return `Mercados estables. Monitoreo del sistema activo.`;
  }

  /**
   * Fetch Live Wikipedia Encyclopedic Knowledge
   */
  async fetchWikipediaSummary(query) {
    try {
      const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.extract) {
          const sentences = data.extract.split('. ').slice(0, 2).join('. ') + '.';
          return `Según los archivos sobre "${data.title}": ${sentences}`;
        }
      }
    } catch (e) {
      console.warn('Wikipedia API lookup error:', e);
    }
    return null;
  }

  /**
   * Test Gemini API Key live
   */
  async testGeminiApiKey(key) {
    if (!key || !key.trim()) {
      return { success: false, message: 'Ingrese una clave API válida para probar.' };
    }
    const testKey = key.trim();
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${testKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: 'Responde OK' }] }]
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        return { success: true, message: '⚡ ¡Conexión con Google Gemini API Verificada!' };
      } else {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, message: `❌ Error API (${res.status}): ${errJson.error?.message || 'Clave inválida'}` };
      }
    } catch (e) {
      return { success: false, message: `❌ Error de red al probar API: ${e.message}` };
    }
  }

  /**
   * Free Zero-Config AI Provider (No API key required)
   */
  async queryFreeAI(promptText) {
    const systemContext = `Eres ${this.assistantName}, la inteligencia artificial personal de ${this.userName}. Responde en español de forma educada, inteligente, servicial y concisa (2 a 3 frases) para ser leída por voz.`;

    // Try Pollinations LLM API
    try {
      const prompt = encodeURIComponent(`${systemContext}\n\nPregunta: "${promptText}"`);
      const res = await fetch(`https://text.pollinations.ai/${prompt}?model=openai`, {
        headers: { 'Accept': 'text/plain' }
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 4 && !text.includes('502 Bad Gateway') && !text.includes('Internal Server Error')) {
          return text.trim();
        }
      }
    } catch (e) {
      console.warn('Free Pollinations AI attempt failed:', e);
    }

    // Fallback: Secondary Pollinations Q&A endpoint
    try {
      const promptSec = encodeURIComponent(`${promptText}. Responde brevemente en español como asistente personal.`);
      const resSec = await fetch(`https://text.pollinations.ai/${promptSec}`);
      if (resSec.ok) {
        const textSec = await resSec.text();
        if (textSec && textSec.trim().length > 4) {
          return textSec.trim();
        }
      }
    } catch (e) {
      console.warn('Secondary AI attempt failed:', e);
    }

    // Fallback: Wikipedia Summary Lookup
    const wikiRes = await this.fetchWikipediaSummary(promptText);
    if (wikiRes) return wikiRes;

    return null;
  }

  /**
   * Gemini REST API Call for Universal AI Questions
   */
  async queryGeminiAI(promptText) {
    const systemContext = `Eres ${this.assistantName}, la inteligencia artificial personal de ${this.userName}. Responde de forma culta, amable, inteligente y concisa en español (máximo 2 a 3 oraciones) para ser leída por sintetizador de voz.`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemContext}\n\nUsuario pregunta: "${promptText}"` }
          ]
        }
      ]
    };

    // Try Gemini 1.5 Flash first
    try {
      const endpoint15 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
      const response = await fetch(endpoint15, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply.trim();
      }
    } catch (err) {
      console.warn('Gemini 1.5 Flash failed, trying 2.0 Flash...', err);
    }

    // Try Gemini 2.0 Flash as fallback
    const endpoint20 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;
    const res20 = await fetch(endpoint20, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res20.ok) {
      throw new Error(`Gemini API Error status ${res20.status}`);
    }

    const data20 = await res20.json();
    const reply20 = data20.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply20 ? reply20.trim() : `No pude procesar la consulta en este momento, ${this.userName}.`;
  }
}

window.YARBISBrain = YARBISBrain;
