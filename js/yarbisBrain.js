/* ==========================================================================
   YARBIS - ADVANCED CONVERSATIONAL BRAIN 8.0 ULTIMATE
   Vision IA, Trivia por Voz, Alarmas Exactas, Bancos, Delivery & Cerebro Criollo
   ========================================================================== */

class YARBISBrain {
  constructor() {
    this.geminiApiKey = localStorage.getItem('yarbis_gemini_api_key') || '';
    this.assistantName = localStorage.getItem('yarbis_assistant_name') || 'YARBIS Veneco';
    this.userName = localStorage.getItem('yarbis_user_name') || 'Señor';
    this.approxUsdRate = 48.50; // Reference USD to Bolívares VES

    // Trivia Game State
    this.triviaActive = false;
    this.triviaScore = 0;
    this.triviaIndex = 0;
    this.triviaQuestions = [
      {
        q: '¿Cuál es la caída de agua más alta del mundo ubicada en Venezuela?',
        a: ['salto angel', 'el salto angel', 'kerekupai vena'],
        explain: '¡Correcto! El Salto Ángel tiene una altura de 979 metros.'
      },
      {
        q: '¿Cómo se le llama en Venezuela a una persona de mucha confianza o mejor amigo?',
        a: ['pana', 'mi pana', 'el mio', 'hermano', 'compadre'],
        explain: '¡Exacto! "Pana" o "el mío" es la palabra clave del venezolano.'
      },
      {
        q: '¿Cuál es el plato típico nacional de Venezuela compuesto por arroz, caraotas, carne mechada y tajadas?',
        a: ['pabellon criollo', 'pabellon', 'el pabellon'],
        explain: '¡De una! El Pabellón Criollo es nuestro plato insigne.'
      },
      {
        q: '¿En qué año nació el Libertador Simón Bolívar?',
        a: ['1783', 'mil setecientos ochenta y tres'],
        explain: '¡Brillante! Nació el 24 de julio de 1783 en Caracas.'
      },
      {
        q: '¿Cómo se llama la inteligencia artificial creada por Tony Stark en Marvel antes de Friday?',
        a: ['jarvis', 'j.a.r.v.i.s', 'yarbis'],
        explain: '¡Claro que sí! J.A.R.V.I.S. (Just A Rather Very Intelligent System).'
      },
      {
        q: '¿Qué fruta se usa tradicionalmente para hacer la chicha andina o el dulce de lechosa en Navidad?',
        a: ['lechosa', 'papaya', 'la lechosa'],
        explain: '¡Así mismo es! El dulce de lechosa verde con papelón y clavitos.'
      },
      {
        q: '¿Cuál es el pico más alto de Venezuela ubicado en el estado Mérida?',
        a: ['pico bolivar', 'el pico bolivar', 'bolivar'],
        explain: '¡Correcto! El Pico Bolívar mide 4.978 metros sobre el nivel del mar.'
      }
    ];
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

  /* ==========================================
     VENEZUELAN PERSONALITY & SPEECH RESPONSES
     ========================================== */
  getVenezuelanGreeting() {
    const greetings = [
      `¡Épale, ${this.userName}! ¿Qué más pues? Sistemas de ${this.assistantName} 100% operativos.`,
      `¡Háblame el mío! Aquí activo para lo que mandes, ${this.userName}.`,
      `¡Buenas, ${this.userName}! Todo listo y sin novedad por acá. ¿Qué ejecutamos?`,
      `¡Saludos mi pana! Listo para trabajar como un tiro, ${this.userName}.`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  getVenezuelanAcknowledge() {
    const acks = [
      `¡Fino de pana!`,
      `¡Tranquilo que eso va volando como tequeño en fiesta!`,
      `¡De una, mi pana!`,
      `¡A la orden, el mío!`,
      `¡Listo el pollo!`
    ];
    return acks[Math.floor(Math.random() * acks.length)];
  }

  /* ==========================================
     TRIVIA & VOICE GAMES ENGINE
     ========================================== */
  startTrivia() {
    this.triviaActive = true;
    this.triviaScore = 0;
    this.triviaIndex = 0;
    const currentQ = this.triviaQuestions[0];
    return {
      textResponse: `¡Activando modo Trivia Venezolana & Cultura Pop! Pregunta 1: ${currentQ.q}`,
      action: 'NONE',
      themeChange: null,
      soundFx: 'scan'
    };
  }

  answerTrivia(spokenAnswer) {
    const cleanSpoken = spokenAnswer.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').trim();
    const currentQ = this.triviaQuestions[this.triviaIndex];

    const isCorrect = currentQ.a.some(ans => cleanSpoken.includes(ans) || ans.includes(cleanSpoken));

    if (isCorrect) {
      this.triviaScore++;
    }

    const resultMsg = isCorrect ? `🎉 ${currentQ.explain}` : `❌ No es correcto. La respuesta correcta era: "${currentQ.a[0]}".`;

    this.triviaIndex++;

    if (this.triviaIndex < this.triviaQuestions.length && this.triviaIndex < 5) {
      const nextQ = this.triviaQuestions[this.triviaIndex];
      return {
        textResponse: `${resultMsg} Siguiente pregunta (${this.triviaIndex + 1}): ${nextQ.q}`,
        action: 'NONE',
        themeChange: null,
        soundFx: isCorrect ? 'success' : 'repulsor'
      };
    } else {
      const finalScore = this.triviaScore;
      this.triviaActive = false;
      this.triviaIndex = 0;
      return {
        textResponse: `${resultMsg} ¡Juego terminado! Obtuviste ${finalScore} puntos de 5. ${finalScore >= 4 ? '¡Eres un crack total mi pana!' : '¡Buen intento, la próxima arrasas!'}`,
        action: 'NONE',
        themeChange: null,
        soundFx: 'success'
      };
    }
  }

  playRPS(userChoice) {
    const options = ['piedra', 'papel', 'tijera'];
    const botChoice = options[Math.floor(Math.random() * options.length)];
    let outcome = '';

    if (userChoice === botChoice) {
      outcome = `Empate mi pana, ambos sacamos ${botChoice}. ¡Otra ronda! 🤝`;
    } else if (
      (userChoice === 'piedra' && botChoice === 'tijera') ||
      (userChoice === 'papel' && botChoice === 'piedra') ||
      (userChoice === 'tijera' && botChoice === 'papel')
    ) {
      outcome = `¡Me ganaste! Tú sacaste ${userChoice} y yo saqué ${botChoice}. ¡Buena jugada! 🏆`;
    } else {
      outcome = `¡Punto para YARBIS! Yo saqué ${botChoice} y le gana a tu ${userChoice}. 🤖`;
    }

    return {
      textResponse: outcome,
      action: 'NONE',
      themeChange: null
    };
  }

  /* ==========================================
     IMAGE / VISION MULTIMODAL SCANNER
     ========================================== */
  async analyzeImage(base64Data, promptText = 'Describe lo que ves en esta imagen y si hay texto, léelo.') {
    if (!this.geminiApiKey) {
      return `He capturado la imagen con la cámara. Para análisis de visión artificial de alta precisión, añade tu Clave API de Google Gemini en Configuración (⚙️). Los sensores detectan encuadre nítido y buena iluminación, ${this.userName}.`;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
      const cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Eres YARBIS Veneco con visión artificial Stark. Analiza esta imagen de la cámara y responde de forma concisa (máximo 3 oraciones en español): ${promptText}` },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 200
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) throw new Error(`Vision API error: ${res.status}`);
      const data = await res.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      console.warn('Vision analysis failed:', e);
      return `No pude procesar la imagen con los sensores de visión en este momento, ${this.userName}.`;
    }
  }

  /* ==========================================
     CONTACTS AGENDA & HELPER UTILITIES
     ========================================== */
  parseSpokenNumbers(text) {
    if (!text) return '';
    let str = text.toLowerCase();
    const wordMap = {
      'cero': '0', 'uno': '1', 'un': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
      'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
      'catorce': '14', 'quince': '15', 'veinte': '20', 'treinta': '30', 'cuarenta': '40', 'cincuenta': '50'
    };

    for (const [word, digit] of Object.entries(wordMap)) {
      const reg = new RegExp(`\\b${word}\\b`, 'gi');
      str = str.replace(reg, digit);
    }
    return str.replace(/(\d)\s+(?=\d)/g, '$1');
  }

  saveContact(name, phone) {
    if (!name || !phone) return;
    const contacts = JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
    contacts[name.toLowerCase().trim()] = phone.replace(/[^0-9\+]/g, '');
    localStorage.setItem('yarbis_contacts', JSON.stringify(contacts));
  }

  getContactPhone(name) {
    const matches = this.getContactMatches(name);
    return matches.length > 0 ? matches[0].phone : null;
  }

  getContactMatches(name) {
    if (!name) return [];
    const contacts = JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
    const cleanName = name.toLowerCase().replace(/^(?:a\s+|mi\s+|al\s+|contacto\s+)/g, '').trim();

    if (contacts[cleanName]) {
      return [{ name: cleanName, phone: contacts[cleanName] }];
    }

    const matches = [];
    for (const [k, v] of Object.entries(contacts)) {
      if (k.includes(cleanName) || cleanName.includes(k)) {
        matches.push({ name: k, phone: v });
      }
    }
    return matches;
  }

  getAllContacts() {
    return JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
  }

  deleteContact(name) {
    const contacts = JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
    delete contacts[name.toLowerCase().trim()];
    localStorage.setItem('yarbis_contacts', JSON.stringify(contacts));
  }

  /* ==========================================
     LIVE ENGINES: WEATHER, CRYPTO, DOLAR, WIKI
     ========================================== */
  getWeatherCodeDesc(code) {
    const map = {
      0: 'Cielo totalmente despejado y soleado ☀️',
      1: 'Mayormente despejado con pocas nubes 🌤️',
      2: 'Parcialmente nublado ⛅',
      3: 'Cielo nublado ☁️',
      45: 'Neblina 🌫️',
      48: 'Niebla densa 🌫️',
      51: 'Llovizna ligera 🌦️',
      53: 'Llovizna moderada 🌦️',
      55: 'Llovizna densa 🌧️',
      61: 'Lluvia ligera 🌧️',
      63: 'Lluvia moderada 🌧️',
      65: 'Lluvia fuerte 🌧️',
      80: 'Chubascos leves 🌦️',
      81: 'Chubascos moderados 🌧️',
      82: 'Chubascos torrenciales ⛈️',
      95: 'Tormenta eléctrica ⚡⛈️',
      96: 'Tormenta con granizo ⛈️',
      99: 'Tormenta severa con granizo ⛈️'
    };
    return map[code] || 'Condiciones estables';
  }

  async fetchWeather(cityName = 'Caracas') {
    try {
      const cityCoords = {
        'caracas': { lat: 10.4880, lon: -66.8792, name: 'Caracas' },
        'valencia': { lat: 10.1620, lon: -68.0077, name: 'Valencia' },
        'maracaibo': { lat: 10.6427, lon: -71.6125, name: 'Maracaibo' },
        'barquisimeto': { lat: 10.0678, lon: -69.3474, name: 'Barquisimeto' },
        'maracay': { lat: 10.2469, lon: -67.5958, name: 'Maracay' },
        'san cristobal': { lat: 7.7669, lon: -72.2250, name: 'San Cristóbal' },
        'puerto la cruz': { lat: 10.2138, lon: -64.6328, name: 'Puerto La Cruz' },
        'merida': { lat: 8.5983, lon: -71.1450, name: 'Mérida' },
        'miami': { lat: 25.7617, lon: -80.1918, name: 'Miami' },
        'madrid': { lat: 40.4168, lon: -3.7038, name: 'Madrid' },
        'bogota': { lat: 4.7110, lon: -74.0721, name: 'Bogotá' },
        'medellin': { lat: 6.2442, lon: -75.5812, name: 'Medellín' },
        'buenos aires': { lat: -34.6037, lon: -58.3816, name: 'Buenos Aires' },
        'santiago': { lat: -33.4489, lon: -70.6693, name: 'Santiago' },
        'lima': { lat: -12.0464, lon: -77.0428, name: 'Lima' },
        'mexico': { lat: 19.4326, lon: -99.1332, name: 'Ciudad de México' },
        'cdmx': { lat: 19.4326, lon: -99.1332, name: 'Ciudad de México' }
      };

      const key = cityName.toLowerCase().trim();
      let coords = cityCoords[key];
      let displayName = coords ? coords.name : cityName;

      if (!coords) {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=es`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            coords = {
              lat: geoData.results[0].latitude,
              lon: geoData.results[0].longitude
            };
            displayName = geoData.results[0].name;
          }
        }
      }

      if (!coords) {
        coords = cityCoords['caracas'];
        displayName = 'Caracas';
      }

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`);
      if (!weatherRes.ok) throw new Error('Weather API error');
      const wData = await weatherRes.json();
      const current = wData.current;

      const temp = Math.round(current.temperature_2m);
      const humidity = current.relative_humidity_2m;
      const wind = Math.round(current.wind_speed_10m);
      const desc = this.getWeatherCodeDesc(current.weather_code);

      return `En ${displayName} hay actualmente ${temp}°C con ${desc}. Humedad del ${humidity}% y viento de ${wind} km/h, ${this.userName}.`;
    } catch (e) {
      console.warn('Weather fetch error:', e);
      return `No pude obtener el reporte meteorológico en vivo, ${this.userName}.`;
    }
  }

  async fetchWikipediaSummary(query) {
    try {
      const cleanQ = query.trim();
      const res = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQ)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.extract) {
        return `${data.title}: ${data.extract}`;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async fetchCryptoPrice(coinName = 'bitcoin') {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,solana&vs_currencies=usd');
      if (!res.ok) throw new Error('Crypto API error');
      const data = await res.json();
      
      const btc = data.bitcoin ? data.bitcoin.usd.toLocaleString() : 'N/A';
      const eth = data.ethereum ? data.ethereum.usd.toLocaleString() : 'N/A';
      const sol = data.solana ? data.solana.usd.toLocaleString() : 'N/A';

      if (coinName.includes('eth')) {
        return `El precio actual de Ethereum es de $${eth} USD, ${this.userName}.`;
      } else if (coinName.includes('sol')) {
        return `El precio actual de Solana es de $${sol} USD, ${this.userName}.`;
      } else {
        return `El precio de Bitcoin es de $${btc} USD, y Ethereum cotiza en $${eth} USD, ${this.userName}.`;
      }
    } catch (e) {
      return `No pude conectar con el servidor de cotizaciones en tiempo real, ${this.userName}.`;
    }
  }

  /* ==========================================
     MAIN PROCESS COMMAND
     ========================================== */
  async processCommand(userText) {
    let text = userText.toLowerCase().trim();

    // Strip optional "Oye Yarbis" / "Hey Yarbis" prefix
    text = text.replace(/^(?:oye|hey|ey|ok)\s+(?:yarbis|jarvis|asistente)\s*/i, '').trim();

    // Check if Trivia is active
    if (this.triviaActive) {
      if (text.includes('cancelar') || text.includes('salir') || text.includes('terminar juego') || text.includes('parar')) {
        this.triviaActive = false;
        return {
          textResponse: `Juego de Trivia cancelado. De vuelta a los comandos principales, ${this.userName}.`,
          action: 'NONE',
          themeChange: null
        };
      }
      return this.answerTrivia(userText);
    }

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

    // 4. Fallback Smart Response with Venezuelan Flavor
    return {
      textResponse: `Copiado mi pana. He procesado tu orden: "${userText}". Todo registrado en el sistema. ¿Qué más se te ofrece, ${this.userName}?`,
      action: 'NONE',
      themeChange: null
    };
  }

  /**
   * Check Built-in Intents & Voice Commands
  /* ==========================================
     WATERMARKS & AI PROVENANCE SANITIZER
     ========================================== */
  cleanAIWatermarks(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        cleanedText: '',
        zeroWidthCount: 0,
        stats: { originalLength: 0, cleanedLength: 0, zeroWidthCount: 0, aiPatternsFound: 0 }
      };
    }

    // 1. Zero-width and steganographic invisible characters
    const zeroWidthRegex = /[\u200B-\u200D\u200E\u200F\uFEFF\u2060\u202A-\u202E\u2066-\u2069\u180E\u00AD]/g;
    const matches = text.match(zeroWidthRegex) || [];
    const zeroWidthCount = matches.length;

    let cleaned = text.replace(zeroWidthRegex, '');

    // 2. Normalize non-standard unicode whitespace
    cleaned = cleaned.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

    // 3. Normalize quotes and dashes
    cleaned = cleaned
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-');

    // 4. Clean multiple spaces and normalize newlines
    cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s+\n/g, '\n\n').trim();

    // 5. Optional humanization of typical AI transitions
    let aiPatternsFound = 0;
    if (options.humanize) {
      const aiPhrases = [
        { regex: /\b(en conclusión|a modo de conclusión|en resumen),?\s*/gi, rep: '' },
        { regex: /\b(es crucial (destacar|entender|mencionar) que|cabe destacar que)\s*/gi, rep: '' },
        { regex: /\b(en el panorama actual|en el mundo actual),?\s*/gi, rep: 'Actualmente, ' },
        { regex: /\b(desempeña un papel crucial|juega un papel fundamental)\b/gi, rep: 'es muy importante' },
        { regex: /\b(es importante tener en cuenta que)\s*/gi, rep: '' },
        { regex: /\b(sin lugar a dudas|indudablemente),?\s*/gi, rep: 'claramente, ' }
      ];

      aiPhrases.forEach(p => {
        if (p.regex.test(cleaned)) {
          aiPatternsFound++;
          cleaned = cleaned.replace(p.regex, p.rep);
        }
      });
      cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    }

    return {
      cleanedText: cleaned,
      zeroWidthCount: zeroWidthCount,
      stats: {
        originalLength: text.length,
        cleanedLength: cleaned.length,
        zeroWidthCount: zeroWidthCount,
        aiPatternsFound: aiPatternsFound
      }
    };
  }

  /**
   * Main Intent Classifier & Parser
   */
  async checkLocalIntents(text, originalUserText) {
    const clean = text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

    // -------------------------------------------------------------
    // INTENT: CLEAN AI WATERMARKS & PROVENANCE TOKENS
    // -------------------------------------------------------------
    if (clean.includes('limpiar marcas') || clean.includes('quitar marcas') || clean.includes('marcas de agua') || clean.includes('desinfectar texto') || clean.includes('anti marcas') || clean.includes('quitar rastros de ia') || clean.includes('purificar texto') || clean.includes('sanitizar')) {
      const extractedText = (originalUserText || text).replace(/.*?(?:marcas de agua|marcas de ia|limpiar marcas|quitar marcas|desinfectar texto|limpia este texto|purificar texto|sanitizar texto):?\s*/i, '').trim();
      
      if (extractedText.length > 5) {
        const res = this.cleanAIWatermarks(extractedText, { humanize: true });
        return {
          textResponse: `🛡️ Protocolo Anti-Marcas completado, ${this.userName}. Se eliminaron ${res.zeroWidthCount} caracteres invisibles/tokens de rastreo. Aquí tienes tu texto 100% limpio y natural:\n\n${res.cleanedText}`,
          action: 'NONE',
          soundFx: 'success'
        };
      }

      return {
        textResponse: `¡Abriendo el Escáner y Purificador Anti-Marcas de Agua IA, ${this.userName}! Pega el texto que deseas desinfectar.`,
        action: 'OPEN_WATERMARK_CLEANER',
        soundFx: 'scan'
      };
    }

    // -------------------------------------------------------------
    // INTENT: CAMERA VISION / SCANNER
    // -------------------------------------------------------------
    if (clean.includes('escanear objeto') || clean.includes('escanear') || clean.includes('activar vision') || clean.includes('abrir camara') || clean.includes('abre camara') || clean.includes('que es esto') || clean.includes('leer texto')) {
      return {
        textResponse: `Activando escáner de visión artificial Stark, ${this.userName}.`,
        action: 'OPEN_CAMERA',
        themeChange: null,
        soundFx: 'scan'
      };
    }

    // -------------------------------------------------------------
    // INTENT: TRIVIA GAME & ROCK PAPER SCISSORS
    // -------------------------------------------------------------
    if (clean.includes('juguemos trivia') || clean.includes('trivia') || clean.includes('jugar trivia') || clean.includes('juego de preguntas')) {
      return this.startTrivia();
    }

    if (clean.includes('piedra papel') || clean.includes('juguemos piedra') || clean.includes('piedra papel o tijera')) {
      return {
        textResponse: `¡Listo el juego! Dime: "¿Piedra, papel o tijera?", ${this.userName}.`,
        action: 'NONE',
        themeChange: null
      };
    }

    if (clean === 'piedra' || clean === 'papel' || clean === 'tijera' || clean === 'tijeras') {
      const choice = clean.startsWith('tijera') ? 'tijera' : clean;
      return this.playRPS(choice);
    }

    // -------------------------------------------------------------
    // INTENT: GREETINGS & VENEZUELAN JOKES / CHITCHAT
    // -------------------------------------------------------------
    if (clean === 'hola' || clean === 'epale' || clean === 'hablame' || clean === 'buenas' || clean.includes('como estas') || clean.includes('que tal') || clean.includes('que hubo')) {
      return {
        textResponse: this.getVenezuelanGreeting(),
        action: 'NONE',
        themeChange: null,
        soundFx: 'scan'
      };
    }

    if (clean.includes('cuentame un chiste') || clean.includes('un chiste') || clean.includes('echa un chiste') || clean.includes('dime un chiste')) {
      const chistes = [
        `¿Por qué los tequeños nunca van a la guerra? ¡Porque se les sale el queso en el primer tiro!`,
        `Papá, ¿qué se siente tener un hijo tan inteligente y guapo? —No sé mijo, pregúntale a tu abuelo.`,
        `¿Qué le dice una arepa a otra arepa? —¡Nos vemos en el budare, corazón!`,
        `¿Cuál es el colmo de un electricista en Maracaibo? —Que su mujer se llame Luz y los hijos le salgan con corriente.`
      ];
      const chiste = chistes[Math.floor(Math.random() * chistes.length)];
      return {
        textResponse: `${chiste} 😂`,
        action: 'NONE',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: SCHEDULED EXACT TIME ALARMS
    // -------------------------------------------------------------
    const alarmMatch = text.match(/(?:alarma|despiertame|avísame|avisame|recuérdame|recordar)\s+(?:a\s+las|para\s+las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|de la tarde|de la noche)?\s*(?:para|de|que)?\s*(.*)/i);
    if (alarmMatch && (alarmMatch[1] || text.includes('alarma a las') || text.includes('avísame a las'))) {
      let hours = parseInt(alarmMatch[1], 10);
      let minutes = alarmMatch[2] ? parseInt(alarmMatch[2], 10) : 0;
      const period = alarmMatch[3] ? alarmMatch[3].toLowerCase() : '';
      const noteMsg = alarmMatch[4] ? alarmMatch[4].trim() : 'Alarma programada';

      if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
        if (hours < 12) hours += 12;
      } else if (period.includes('am') || period.includes('mañana')) {
        if (hours === 12) hours = 0;
      }

      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);

      // If time already passed today, schedule for tomorrow
      if (targetTime.getTime() <= now.getTime()) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const formattedHour = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');

      return {
        textResponse: `Alarma programada para las ${formattedHour} (${noteMsg || 'Aviso de YARBIS'}), ${this.userName}. Te avisaré con señal acústica.`,
        action: 'SET_ALARM',
        alarmData: {
          timeStr: formattedHour,
          timestamp: targetTime.getTime(),
          note: noteMsg || 'Alarma YARBIS'
        },
        themeChange: null,
        soundFx: 'success'
      };
    }

    // -------------------------------------------------------------
    // INTENT: DÓLAR BCV / PARALELO & CONVERSIÓN DE DIVISAS
    // -------------------------------------------------------------
    if (clean.includes('dolar') || clean.includes('dólar') || clean.includes('tasa') || clean.includes('bolivares') || clean.includes('bolívares') || clean.includes('cambio')) {
      const rate = this.approxUsdRate;
      
      const convMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:dolares|dólares|usd|\$)\s*(?:a|en)?\s*(?:bolivares|bolívares|bs)?/i);
      if (convMatch) {
        const amount = parseFloat(convMatch[1]);
        const totalBs = (amount * rate).toFixed(2);
        return {
          textResponse: `${amount} dólares equivalen a aproximadamente ${totalBs} Bolívares a tasa de referencia (${rate} Bs/USD), ${this.userName}.`,
          action: 'MATH',
          themeChange: null
        };
      }

      const convBsMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:bolivares|bolívares|bs)\s*(?:a|en)?\s*(?:dolares|dólares|usd|\$)?/i);
      if (convBsMatch) {
        const amountBs = parseFloat(convBsMatch[1]);
        const totalUsd = (amountBs / rate).toFixed(2);
        return {
          textResponse: `${amountBs} Bolívares equivalen a aproximadamente $${totalUsd} USD a tasa de referencia (${rate} Bs/USD), ${this.userName}.`,
          action: 'MATH',
          themeChange: null
        };
      }

      return {
        textResponse: `La tasa de referencia del dólar se ubica en aproximadamente ${rate} Bolívares por USD, ${this.userName}. Puedes pedirme: "Calcula [monto] dólares a bolívares".`,
        action: 'NONE',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: GPS NAVIGATION & ROUTES (GOOGLE MAPS & WAZE)
    // -------------------------------------------------------------
    if (clean.includes('como llegar') || clean.includes('ruta a') || clean.includes('ruta hacia') || clean.includes('llevame a') || clean.includes('llévame a') || clean.includes('navegar a') || clean.includes('direccion a')) {
      const destMatch = text.match(/(?:como llegar a|ruta a|ruta hacia|llevame a|llévame a|navegar a|direccion a)\s+(.*)/i);
      if (destMatch && destMatch[1]) {
        const destination = destMatch[1].trim();
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
        const wazeDeepLink = `waze://?q=${encodeURIComponent(destination)}&navigate=yes`;

        return {
          textResponse: `Calculando la mejor ruta hacia ${destination.toUpperCase()} en tu GPS, ${this.userName}.`,
          action: 'OPEN_URL',
          url: gmapsUrl,
          deepLink: wazeDeepLink,
          themeChange: null
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: FLASHLIGHT / TORCH CONTROL
    // -------------------------------------------------------------
    if (clean.includes('linterna') || clean.includes('luz del telefono') || clean.includes('luz de la camara')) {
      if (clean.includes('apagar') || clean.includes('desactivar') || clean.includes('apaga') || clean.includes('quita')) {
        return {
          textResponse: `Apagando la linterna del teléfono de inmediato, ${this.userName}.`,
          action: 'TORCH_OFF',
          themeChange: null
        };
      } else {
        return {
          textResponse: `Encendiendo la linterna de tu dispositivo, ${this.userName}.`,
          action: 'TORCH_ON',
          themeChange: null
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: BATTERY STATUS
    // -------------------------------------------------------------
    if (clean.includes('bateria') || clean.includes('batería') || clean.includes('cuanta carga') || clean.includes('nivel de carga')) {
      return {
        textResponse: `Consultando los sensores de energía de tu dispositivo...`,
        action: 'CHECK_BATTERY',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: VENEZUELAN BANKS & DELIVERY SERVICES
    // -------------------------------------------------------------
    if (clean.includes('banco de venezuela') || clean.includes('bdv') || clean.includes('bdvenlinea')) {
      return {
        textResponse: `Abriendo BDV en línea del Banco de Venezuela, ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://bdvenlinea.banvenez.com/',
        themeChange: null
      };
    }
    if (clean.includes('banesco') || clean.includes('banesconline')) {
      return {
        textResponse: `Abriendo Banesco Online, ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://www.banesconline.com/',
        themeChange: null
      };
    }
    if (clean.includes('mercantil') || clean.includes('banco mercantil')) {
      return {
        textResponse: `Abriendo Mercantil en Línea, ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://www.mercantilbanco.com/',
        themeChange: null
      };
    }
    if (clean.includes('bnc') || clean.includes('banco nacional de credito')) {
      return {
        textResponse: `Abriendo Banco Nacional de Crédito (BNC), ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://www.bncenlinea.com/',
        themeChange: null
      };
    }
    if (clean.includes('pago movil') || clean.includes('pagomovil')) {
      return {
        textResponse: `Abriendo servicios de Pago Móvil, ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://bdvenlinea.banvenez.com/',
        themeChange: null
      };
    }
    if (clean.includes('pedidosya') || clean.includes('pedidos ya')) {
      return {
        textResponse: `Abriendo PedidosYa para ordenar delivery, ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://www.pedidosya.com.ve/',
        deepLink: 'pedidosya://',
        themeChange: null
      };
    }
    if (clean.includes('yummy')) {
      return {
        textResponse: `Abriendo Yummy delivery, ${this.userName}.`,
        action: 'OPEN_URL',
        url: 'https://www.yummy.com.ve/',
        deepLink: 'yummy://',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: LIVE WEATHER (OPEN-METEO)
    // -------------------------------------------------------------
    if (clean.includes('clima') || clean.includes('temperatura') || clean.includes('va a llover') || clean.includes('pronostico') || clean.includes('el tiempo en')) {
      const cityMatch = text.match(/(?:clima|temperatura|tiempo|llover|pronostico)\s+(?:en|de|para)?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);
      let targetCity = 'Caracas';
      if (cityMatch && cityMatch[1]) {
        const extracted = cityMatch[1].replace(/^(?:en|de|para|hoy|el|la)\s+/i, '').trim();
        if (extracted.length > 2 && !['hoy', 'mañana', 'ahora'].includes(extracted.toLowerCase())) {
          targetCity = extracted;
        }
      }

      const weatherMsg = await this.fetchWeather(targetCity);
      return {
        textResponse: weatherMsg,
        action: 'NONE',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: CRYPTO & BITCOIN
    // -------------------------------------------------------------
    if (clean.includes('bitcoin') || clean.includes('cripto') || clean.includes('ethereum') || clean.includes('solana') || clean.includes('btc') || clean.includes('eth')) {
      const cryptoMsg = await this.fetchCryptoPrice(clean);
      return {
        textResponse: cryptoMsg,
        action: 'NONE',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: WIKIPEDIA / INSTANT KNOWLEDGE SEARCH
    // -------------------------------------------------------------
    const wikiMatch = text.match(/^(?:quién es|quien es|quién fue|quien fue|qué es|que es|qué significa|que significa|cuéntame de|cuentame de|explícame qué es|explicame que es|explícame|explicame)\s+(.*)/i);
    if (wikiMatch && wikiMatch[1]) {
      const topic = wikiMatch[1].replace(/^(?:el|la|los|las|un|una|sobre)\s+/i, '').trim();
      if (topic.length > 2) {
        const wikiExtract = await this.fetchWikipediaSummary(topic);
        if (wikiExtract) {
          return {
            textResponse: `${wikiExtract}`,
            action: 'NONE',
            themeChange: null
          };
        }
      }
    }

    // -------------------------------------------------------------
    // INTENT: MUSIC PLAYER & GENRES (SPOTIFY / YOUTUBE MUSIC)
    // -------------------------------------------------------------
    if (clean.startsWith('pon ') || clean.startsWith('poner ') || clean.startsWith('reproduce ') || clean.startsWith('reproducir ') || clean.includes('musica de ') || clean.includes('musica para ')) {
      let query = text.replace(/^(?:pon|poner|reproduce|reproducir|busca|buscar|musica de|musica para)\s+/i, '').trim();
      if (query.length > 1) {
        const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
        const spotifyDeepLink = `spotify:search:${encodeURIComponent(query)}`;

        return {
          textResponse: `Reproduciendo "${query}" en Spotify, ${this.userName}. ¡A gozar! 🎶`,
          action: 'OPEN_URL',
          url: spotifySearchUrl,
          deepLink: spotifyDeepLink,
          themeChange: null
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: TIMERS & COUNTDOWNS
    // -------------------------------------------------------------
    if (clean.includes('temporizador') || clean.includes('cuenta regresiva') || clean.includes('avísame en') || clean.includes('avisame en')) {
      if (clean.includes('cancelar') || clean.includes('detener') || clean.includes('quitar') || clean.includes('borrar')) {
        return {
          textResponse: `Temporizador cancelado correctamente, ${this.userName}.`,
          action: 'CANCEL_TIMER',
          themeChange: null
        };
      }

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
          textResponse: `Temporizador activo por ${val} ${unitLabel}, ${this.userName}. Te aviso en cuanto suene.`,
          action: 'SET_TIMER',
          durationSeconds: totalSeconds,
          themeChange: null,
          soundFx: 'success'
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: ADVANCED AUTOMATIC PHONE CALLS
    // -------------------------------------------------------------
    const saveContactMatch = text.match(/(?:guardar|agregar|nuevo)\s+(?:contacto\s+)?(.*?)\s+(?:numero|número|telefono|teléfono)?\s*(\+?[0-9\s]{3,15})/i);
    if (saveContactMatch) {
      const cName = saveContactMatch[1].replace(/^(?:contacto|a|mi)\s+/i, '').trim();
      const cPhone = saveContactMatch[2].replace(/[^0-9\+]/g, '');
      if (cName && cPhone) {
        this.saveContact(cName, cPhone);
        return {
          textResponse: `Listo mi pana, guardé a "${cName}" en tu agenda con el número ${cPhone}, ${this.userName}.`,
          action: 'NONE',
          themeChange: null
        };
      }
    }

    if (clean.includes('llamar') || clean.includes('marcar') || clean.includes('llamada')) {
      if (clean.includes('emergencia') || clean.includes('policia') || clean.includes('ambulancia') || clean.includes('bomberos')) {
        return {
          textResponse: `Marcando al 911 de emergencia inmediatamente, ${this.userName}.`,
          action: 'OPEN_URL',
          url: 'tel:911',
          deepLink: 'tel:911',
          themeChange: null
        };
      }

      const convertedText = this.parseSpokenNumbers(text);
      const callDigitsMatch = convertedText.match(/(?:llamar|marcar|hacer\s+llamada)\s+(?:a|al)?\s*(\+?[0-9]{3,15})/i);
      if (callDigitsMatch && callDigitsMatch[1]) {
        const phoneNumber = callDigitsMatch[1];
        return {
          textResponse: `Iniciando llamada al ${phoneNumber}, ${this.userName}.`,
          action: 'OPEN_URL',
          url: `tel:${phoneNumber}`,
          deepLink: `tel:${phoneNumber}`,
          themeChange: null
        };
      }

      const nameMatch = text.match(/(?:llamar|marcar|hacer\s+llamada)\s+(?:a|al|a\s+mi)?\s*(.+)/i);
      if (nameMatch && nameMatch[1]) {
        const targetName = nameMatch[1].trim();
        const matches = this.getContactMatches(targetName);

        if (matches.length === 1) {
          const found = matches[0];
          return {
            textResponse: `Llamando a ${found.name.toUpperCase()} (${found.phone}), ${this.userName}.`,
            action: 'OPEN_URL',
            url: `tel:${found.phone}`,
            deepLink: `tel:${found.phone}`,
            themeChange: null
          };
        } else if (matches.length > 1) {
          const listStr = matches.map(m => `"${m.name.toUpperCase()}" (${m.phone})`).join(', ');
          return {
            textResponse: `Encontré varios números para "${targetName}": ${listStr}. ¿A cuál llamo, ${this.userName}?`,
            action: 'NONE',
            themeChange: null
          };
        } else {
          return {
            textResponse: `No encontré a "${targetName}" en tu agenda. Puedes decir "Guardar contacto ${targetName} número [teléfono]".`,
            action: 'NONE',
            themeChange: null
          };
        }
      }
    }

    // -------------------------------------------------------------
    // INTENT: ADVANCED AUTOMATIC WHATSAPP MESSAGING
    // -------------------------------------------------------------
    if (clean.includes('whatsapp') || clean.includes('wasap') || clean.includes('guasap')) {
      const convertedText = this.parseSpokenNumbers(text);
      const isBusiness = clean.includes('business') || clean.includes('whatsapp 2') || clean.includes('wasap 2') || clean.includes('guasap 2');
      const waAppName = isBusiness ? 'WhatsApp Business' : 'WhatsApp';
      const waDeepScheme = isBusiness ? 'whatsapp-business://' : 'whatsapp://';

      let targetContactName = '';
      let targetPhone = '';
      let msgText = '';

      const fullWaMatch = convertedText.match(/(?:mandar|enviar|escribir|hacer)?\s*(?:un\s+)?(?:mensaje\s+de\s+|mensaje\s+por\s+)?(?:whatsapp\s*2|whatsapp\s*business|whatsapp|wasap\s*2|wasap|guasap)\s+(?:a|para|al)?\s*([^\s]+(?:\s+[^\s]+)?)\s*(?:que\s+diga|diciendo|con\s+el\s+texto|mensaje)?\s*(.*)/i);

      if (fullWaMatch) {
        const potentialTarget = fullWaMatch[1] ? fullWaMatch[1].trim() : '';
        const potentialMsg = fullWaMatch[2] ? fullWaMatch[2].trim() : '';

        const digitsOnly = potentialTarget.replace(/[^0-9\+]/g, '');
        if (digitsOnly.length >= 7) {
          targetPhone = digitsOnly;
          msgText = potentialMsg;
        } else if (potentialTarget && !['que', 'un', 'el', 'la', 'mi', 'mensaje'].includes(potentialTarget.toLowerCase())) {
          targetContactName = potentialTarget;
          const found = this.getContactPhone(targetContactName);
          if (found) targetPhone = found;
          msgText = potentialMsg;
        } else {
          msgText = (potentialTarget + ' ' + potentialMsg).trim();
        }
      }

      if (!targetPhone) {
        const phoneMatch = convertedText.match(/(\+?[0-9]{7,15})/);
        if (phoneMatch) targetPhone = phoneMatch[1];
      }

      let formattedPhone = targetPhone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('04')) {
        formattedPhone = '58' + formattedPhone.substring(1);
      }

      let waUrl = 'https://web.whatsapp.com';
      let waDeepLink = `${waDeepScheme}`;
      let responseMsg = `Abriendo ${waAppName} en tu celular, ${this.userName}.`;

      const displayTarget = targetContactName ? targetContactName : (targetPhone ? targetPhone : '');

      if (formattedPhone && msgText) {
        waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msgText)}`;
        waDeepLink = `${waDeepScheme}send?phone=${formattedPhone}&text=${encodeURIComponent(msgText)}`;
        responseMsg = `Abriendo ${waAppName} con mensaje listo para ${displayTarget || formattedPhone}: "${msgText}", ${this.userName}.`;
      } else if (formattedPhone) {
        waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}`;
        waDeepLink = `${waDeepScheme}send?phone=${formattedPhone}`;
        responseMsg = `Abriendo chat de ${waAppName} de ${displayTarget || formattedPhone}, ${this.userName}.`;
      } else if (msgText) {
        waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
        waDeepLink = `${waDeepScheme}send?text=${encodeURIComponent(msgText)}`;
        responseMsg = `Abriendo ${waAppName} con tu mensaje: "${msgText}", ${this.userName}.`;
      }

      return {
        textResponse: responseMsg,
        action: 'OPEN_URL',
        url: waUrl,
        deepLink: waDeepLink,
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: ARMOR PROTOCOL THEMES
    // -------------------------------------------------------------
    if (clean.includes('protocolo mark 85') || clean.includes('mark 85') || clean.includes('nanotecnologia') || clean.includes('nano')) {
      return {
        textResponse: `Protocolo Mark 85 Nano-Tech activado. Armadura de titanio y oro carmesí en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-mark85',
        soundFx: 'nano'
      };
    }
    if (clean.includes('protocolo war machine') || clean.includes('war machine') || clean.includes('tema gris') || clean.includes('tema plateado')) {
      return {
        textResponse: `Protocolo War Machine activado. Blindaje táctico de acero y titanio en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-warmachine',
        soundFx: 'hulkbuster'
      };
    }
    if (clean.includes('protocolo spider') || clean.includes('spider iron') || clean.includes('tema spider')) {
      return {
        textResponse: `Protocolo Spider-Iron activado. Fibras nanotecnológicas cian y escarlata en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-spideriron',
        soundFx: 'repulsor'
      };
    }
    if (clean.includes('protocolo wakanda') || clean.includes('pantera negra') || clean.includes('black panther')) {
      return {
        textResponse: `Protocolo Wakanda activado. Blindaje de vibranium violeta cargado, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-wakanda',
        soundFx: 'scan'
      };
    }
    if (clean.includes('protocolo hulkbuster') || clean.includes('modo hulkbuster') || clean.includes('tema morado')) {
      return {
        textResponse: `Protocolo Hulkbuster activado. Potencia de blindaje pesado en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-hulkbuster',
        soundFx: 'hulkbuster'
      };
    }
    if (clean.includes('protocolo sigilo') || clean.includes('modo sigilo') || clean.includes('tema verde') || clean.includes('modo matrix')) {
      return {
        textResponse: `Protocolo Sigilo activado. Modo de baja visibilidad verde neón en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-stealth',
        soundFx: 'scan'
      };
    }
    if (clean.includes('protocolo mark 42') || clean.includes('mark 42') || clean.includes('tema dorado')) {
      return {
        textResponse: `Protocolo Mark 42 activado. Blindaje dorado y carmesí en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-mark42',
        soundFx: 'repulsor'
      };
    }
    if (clean.includes('protocolo por defecto') || clean.includes('tema normal') || clean.includes('restablecer tema')) {
      return {
        textResponse: `Restableciendo protocolo cian estándar de YARBIS, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'default',
        soundFx: 'success'
      };
    }

    // -------------------------------------------------------------
    // INTENT: PERSONAL NOTES & REMINDERS
    // -------------------------------------------------------------
    const addNoteMatch = text.match(/(?:agrega|agregar|nueva|crear|guarda|guardar|recuérdame|recordarme|recordar)\s+(?:nota|recordatorio)?\s*(.+)/i);
    if (addNoteMatch && addNoteMatch[1] && !clean.startsWith('mis notas') && !clean.startsWith('ver notas')) {
      let noteText = addNoteMatch[1].trim();
      noteText = noteText.replace(/^(que|de|para|nota|recordatorio)\s+/i, '');

      if (noteText.length > 1) {
        return {
          textResponse: `Guardé la nota: "${noteText}" en tu lista, ${this.userName}.`,
          action: 'ADD_NOTE',
          noteText: noteText,
          themeChange: null
        };
      }
    }

    if (clean.includes('mis notas') || clean.includes('ver notas') || clean.includes('mostrar notas') || clean.includes('recordatorios')) {
      return {
        textResponse: `Abriendo tus notas y recordatorios en el panel, ${this.userName}.`,
        action: 'SHOW_NOTES',
        themeChange: null
      };
    }

    if (clean.includes('borrar todas las notas') || clean.includes('limpiar notas') || clean.includes('eliminar notas')) {
      return {
        textResponse: `Listo, borré todas tus notas de la lista, ${this.userName}.`,
        action: 'CLEAR_NOTES',
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: MATHEMATICAL CALCULATIONS & PERCENTAGES
    // -------------------------------------------------------------
    if (clean.includes('cuanto es') || clean.includes('calcula') || clean.includes('porcentaje') || clean.includes('%')) {
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
          textResponse: `El resultado exacto es ${res}, ${this.userName}.`,
          action: 'MATH',
          themeChange: null
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: OPEN YOUTUBE / SEARCH YOUTUBE
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

    // -------------------------------------------------------------
    // INTENT: UNIVERSAL MOBILE APP & WEB LAUNCHER
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

    for (const app of webApps) {
      if (app.keys.some(k => clean.includes(k))) {
        return {
          textResponse: `Abriendo ${app.name} en tu celular, ${this.userName}.`,
          action: 'OPEN_URL',
          url: app.url,
          deepLink: app.deepLink,
          themeChange: null
        };
      }
    }

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
        textResponse: `Abriendo ${cleanAppName}, ${this.userName}.`,
        action: 'OPEN_URL',
        url: dynamicWebUrl,
        deepLink: dynamicDeepLink,
        themeChange: null
      };
    }

    // -------------------------------------------------------------
    // INTENT: GENERAL GOOGLE SEARCH
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

    return null;
  }

  cleanGeminiKey(rawKey) {
    if (!rawKey) return '';
    return rawKey.trim()
      .replace(/^['"`]+|['"`]+$/g, '')
      .replace(/^Bearer\s+/i, '')
      .replace(/^key=/i, '')
      .trim();
  }

  setApiKey(key) {
    this.geminiApiKey = this.cleanGeminiKey(key);
    localStorage.setItem('yarbis_gemini_api_key', this.geminiApiKey);
  }

  async queryGeminiAI(userText) {
    const key = this.cleanGeminiKey(this.geminiApiKey);
    if (!key) throw new Error('API Key no configurada');

    const modelsToTry = [
      this.activeGeminiModel || 'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    const systemPrompt = `Eres YARBIS Veneco, un asistente de inteligencia artificial personal con acento venezolano sutil, carismático, inteligente, respetuoso y futurista (estilo J.A.R.V.I.S.). Te diriges al usuario como "${this.userName}". Responde de forma concisa, fluida, natural y directa (máximo 2 o 3 oraciones). No uses markdown excesivo.`;

    let lastError = null;
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nUsuario: ${userText}` }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          this.activeGeminiModel = model;
          return data.candidates[0].content.parts[0].text.trim();
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = new Error(errData.error?.message || `HTTP ${response.status}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('No se pudo conectar con los modelos de Google Gemini.');
  }

  async testGeminiApiKey(apiKey) {
    const key = this.cleanGeminiKey(apiKey);
    if (!key) return { success: false, message: 'La clave no puede estar vacía.' };

    const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b', 'gemini-pro'];
    let lastStatus = 404;
    let lastErrorMsg = '';

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hola, prueba de conexión de YARBIS' }] }]
          })
        });

        if (res.ok) {
          this.activeGeminiModel = model;
          return { success: true, message: `⚡ Conexión exitosa con Google Gemini (${model}).` };
        } else {
          lastStatus = res.status;
          const errData = await res.json().catch(() => ({}));
          lastErrorMsg = errData.error?.message || '';
        }
      } catch (e) {
        return { success: false, message: 'Error de red al conectar con Google Gemini.' };
      }
    }

    let detail = lastErrorMsg ? `: ${lastErrorMsg}` : '.';
    if (lastStatus === 400 || lastStatus === 403 || lastStatus === 404) {
      return { 
        success: false, 
        message: `Error (${lastStatus})${detail} Asegúrate de haber copiado la clave desde Google AI Studio (comienza con "AIzaSy...").` 
      };
    }

    return { success: false, message: `Error (${lastStatus})${detail}` };
  }

  async queryFreeAI(userText) {
    const systemPrompt = `Eres YARBIS Veneco, un asistente de voz futurista tipo JARVIS para ${this.userName}. Responde con acento y carisma venezolano sutil, conciso y en español.`;
    const prompt = encodeURIComponent(`${systemPrompt} Pregunta: ${userText}`);
    const freeUrl = `https://text.pollinations.ai/${prompt}?model=openai`;

    const res = await fetch(freeUrl);
    if (!res.ok) throw new Error('Free AI request failed');
    const text = await res.text();
    return text.trim();
  }
}

window.YARBISBrain = YARBISBrain;
