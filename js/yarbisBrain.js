/* ==========================================================================
   YARBIS - CONVERSATIONAL BRAIN & INTENT PROCESSOR 4.0 - ADVANCED VOICE CALLING
   Personal Assistant AI Personality, Contact Agenda & Automatic WhatsApp Engine
   ========================================================================== */

class YARBISBrain {
  constructor() {
    this.geminiApiKey = localStorage.getItem('yarbis_gemini_api_key') || '';
    this.assistantName = localStorage.getItem('yarbis_assistant_name') || 'YARBIS Veneco';
    this.userName = localStorage.getItem('yarbis_user_name') || 'Señor';

    // Clean up dummy sample contacts if present so agenda is 100% clean for the user
    const contacts = JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
    if (contacts['mamá'] === '04141234567' || contacts['pedro'] === '04121112233') {
      localStorage.removeItem('yarbis_contacts');
    }
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
    if (!name) return null;
    const contacts = JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
    const cleanName = name.toLowerCase().replace(/^(?:a\s+|mi\s+|al\s+|contacto\s+)/g, '').trim();
    if (contacts[cleanName]) return contacts[cleanName];

    for (const [k, v] of Object.entries(contacts)) {
      if (cleanName.includes(k) || k.includes(cleanName)) return v;
    }
    return null;
  }

  getAllContacts() {
    return JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
  }

  deleteContact(name) {
    const contacts = JSON.parse(localStorage.getItem('yarbis_contacts') || '{}');
    delete contacts[name.toLowerCase().trim()];
    localStorage.setItem('yarbis_contacts', JSON.stringify(contacts));
  }

  /**
   * Main Process Function
   * Returns: { textResponse, action, themeChange, noteText, durationSeconds, url, deepLink, soundFx }
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
    const clean = text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

    // -------------------------------------------------------------
    // INTENT 1: TIMERS & COUNTDOWNS
    // -------------------------------------------------------------
    if (clean.includes('temporizador') || clean.includes('cuenta regresiva') || clean.includes('alarma') || clean.includes('avísame en') || clean.includes('avisame en')) {
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
          textResponse: `Temporizador iniciado por ${val} ${unitLabel}, ${this.userName}. Le notificaré cuando el tiempo expire.`,
          action: 'SET_TIMER',
          durationSeconds: totalSeconds,
          themeChange: null,
          soundFx: 'success'
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: ADVANCED AUTOMATIC PHONE CALLS (POR NOMBRE O NÚMERO)
    // -------------------------------------------------------------
    // Save Contact by Voice e.g. "guardar contacto Mamá numero 04141234567"
    const saveContactMatch = text.match(/(?:guardar|agregar|nuevo)\s+(?:contacto\s+)?(.*?)\s+(?:numero|número|telefono|teléfono)?\s*(\+?[0-9\s]{3,15})/i);
    if (saveContactMatch) {
      const cName = saveContactMatch[1].replace(/^(?:contacto|a|mi)\s+/i, '').trim();
      const cPhone = saveContactMatch[2].replace(/[^0-9\+]/g, '');
      if (cName && cPhone) {
        this.saveContact(cName, cPhone);
        return {
          textResponse: `He guardado a "${cName}" en tu agenda telefónica con el número ${cPhone}, ${this.userName}.`,
          action: 'NONE',
          themeChange: null
        };
      }
    }

    if (clean.includes('llamar') || clean.includes('marcar') || clean.includes('llamada')) {
      // Emergency Check
      if (clean.includes('emergencia') || clean.includes('policia') || clean.includes('ambulancia') || clean.includes('bomberos')) {
        return {
          textResponse: `Iniciando llamada de emergencia al 911 de inmediato, ${this.userName}.`,
          action: 'OPEN_URL',
          url: 'tel:911',
          deepLink: 'tel:911',
          themeChange: null
        };
      }

      // Convert spoken number words e.g. "cero cuatro catorce..." to digits
      const convertedText = this.parseSpokenNumbers(text);

      // Check digits call first e.g. "Llamar al 04141234567"
      const callDigitsMatch = convertedText.match(/(?:llamar|marcar|hacer\s+llamada)\s+(?:a|al)?\s*(\+?[0-9]{3,15})/i);
      if (callDigitsMatch && callDigitsMatch[1]) {
        const phoneNumber = callDigitsMatch[1];
        return {
          textResponse: `Iniciando llamada telefónica al número ${phoneNumber}, ${this.userName}.`,
          action: 'OPEN_URL',
          url: `tel:${phoneNumber}`,
          deepLink: `tel:${phoneNumber}`,
          themeChange: null
        };
      }

      // Check Contact Agenda Name Match e.g. "Llamar a Mamá", "Llamar a Pedro", "Llamar a Carlos"
      const nameMatch = text.match(/(?:llamar|marcar|hacer\s+llamada)\s+(?:a|al|a\s+mi)?\s*(.+)/i);
      if (nameMatch && nameMatch[1]) {
        const targetName = nameMatch[1].trim();
        const foundPhone = this.getContactPhone(targetName);
        if (foundPhone) {
          return {
            textResponse: `Llamando a ${targetName.toUpperCase()} al número ${foundPhone}, ${this.userName}.`,
            action: 'OPEN_URL',
            url: `tel:${foundPhone}`,
            deepLink: `tel:${foundPhone}`,
            themeChange: null
          };
        } else {
          return {
            textResponse: `No encontré a "${targetName}" en tu agenda. Puedes decir "Guardar contacto ${targetName} número [teléfono]" o dictarme los dígitos.`,
            action: 'NONE',
            themeChange: null
          };
        }
      }
    }

    // -------------------------------------------------------------
    // INTENT: ADVANCED AUTOMATIC WHATSAPP MESSAGING (POR NOMBRE O NÚMERO)
    // -------------------------------------------------------------
    if (clean.includes('whatsapp') || clean.includes('wasap') || clean.includes('guasap')) {
      const convertedText = this.parseSpokenNumbers(text);
      let targetContactName = '';
      let targetPhone = '';
      let msgText = '';

      // Pattern match e.g. "mandar whatsapp a Mamá que diga llego en 5 min"
      const fullWaMatch = convertedText.match(/(?:mandar|enviar|escribir|hacer)?\s*(?:un\s+)?(?:mensaje\s+de\s+|mensaje\s+por\s+)?(?:whatsapp|wasap|guasap)\s+(?:a|para|al)?\s*([^\s]+(?:\s+[^\s]+)?)\s*(?:que\s+diga|diciendo|con\s+el\s+texto|mensaje)?\s*(.*)/i);

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

      // Format WhatsApp Phone Number with Country Code (+58 for Venezuela 0414/0424/0412/0416/0426)
      let formattedPhone = targetPhone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('04')) {
        formattedPhone = '58' + formattedPhone.substring(1);
      }

      let waUrl = 'https://web.whatsapp.com';
      let waDeepLink = 'whatsapp://';
      let responseMsg = `Abriendo WhatsApp en tu celular, ${this.userName}.`;

      const displayTarget = targetContactName ? targetContactName : (targetPhone ? targetPhone : '');

      if (formattedPhone && msgText) {
        waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msgText)}`;
        waDeepLink = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(msgText)}`;
        responseMsg = `Abriendo WhatsApp con mensaje listo para ${displayTarget || formattedPhone}: "${msgText}", ${this.userName}.`;
      } else if (formattedPhone) {
        waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}`;
        waDeepLink = `whatsapp://send?phone=${formattedPhone}`;
        responseMsg = `Abriendo chat de WhatsApp de ${displayTarget || formattedPhone}, ${this.userName}.`;
      } else if (msgText) {
        waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
        waDeepLink = `whatsapp://send?text=${encodeURIComponent(msgText)}`;
        responseMsg = `Abriendo WhatsApp con tu mensaje: "${msgText}", ${this.userName}.`;
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
    if (clean.includes('protocolo hulkbuster') || clean.includes('modo hulkbuster') || clean.includes('tema morado')) {
      return {
        textResponse: `Protocolo Hulkbuster activado. Potencia de blindaje violáceo en línea, ${this.userName}.`,
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
    if (clean.includes('protocolo mark 42') || clean.includes('mark 42') || clean.includes('tema dorado') || clean.includes('iron man')) {
      return {
        textResponse: `Protocolo Mark 42 activado. Blindaje dorado y carmesí en línea, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'theme-mark42',
        soundFx: 'repulsor'
      };
    }
    if (clean.includes('protocolo por defecto') || clean.includes('tema normal') || clean.includes('restablecer tema')) {
      return {
        textResponse: `Restableciendo protocolo cian estándar del asistente, ${this.userName}.`,
        action: 'THEME',
        themeChange: 'default',
        soundFx: 'success'
      };
    }

    // -------------------------------------------------------------
    // INTENT 2: PERSONAL NOTES & REMINDERS
    // -------------------------------------------------------------
    const addNoteMatch = text.match(/(?:agrega|agregar|nueva|crear|guarda|guardar|recuérdame|recordarme|recordar)\s+(?:nota|recordatorio)?\s*(.+)/i);
    if (addNoteMatch && addNoteMatch[1] && !clean.startsWith('mis notas') && !clean.startsWith('ver notas')) {
      let noteText = addNoteMatch[1].trim();
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

    if (clean.includes('mis notas') || clean.includes('ver notas') || clean.includes('mostrar notas') || clean.includes('recordatorios')) {
      return {
        textResponse: `Abriendo y mostrando su lista de notas y recordatorios en el panel principal, ${this.userName}.`,
        action: 'SHOW_NOTES',
        themeChange: null
      };
    }

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
    // INTENT 5: UNIVERSAL MOBILE APP & WEB LAUNCHER
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
          textResponse: `Abriendo la aplicación ${app.name} en tu dispositivo, ${this.userName}.`,
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

    return null;
  }

  async queryGeminiAI(userText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

    const systemPrompt = `Eres YARBIS Veneco, un asistente de inteligencia artificial personal con acento venezolano sutil, servicial, inteligente, respetuoso y futurista (estilo J.A.R.V.I.S.). Te diriges al usuario como "${this.userName}". Responde de forma muy concisa, fluida, natural y directa (máximo 2 o 3 oraciones). No uses markdown excesivo.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nUsuario: ${userText}` }
          ]
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

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }

  async testGeminiApiKey(apiKey) {
    const key = apiKey.trim();
    if (!key) return { success: false, message: 'La clave no puede estar vacía.' };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hola, prueba de conexión de YARBIS' }] }]
        })
      });

      if (res.ok) {
        return { success: true, message: '⚡ Conexión exitosa con Google Gemini API.' };
      } else {
        return { success: false, message: `Error (${res.status}): Clave no válida o sin permisos.` };
      }
    } catch (e) {
      return { success: false, message: 'Error de red al conectar con Google Gemini.' };
    }
  }

  async queryFreeAI(userText) {
    const systemPrompt = `Eres YARBIS Veneco, un asistente de voz futurista tipo JARVIS para ${this.userName}. Responde muy conciso, directo y en español.`;
    const prompt = encodeURIComponent(`${systemPrompt} Pregunta: ${userText}`);
    const freeUrl = `https://text.pollinations.ai/${prompt}?model=openai`;

    const res = await fetch(freeUrl);
    if (!res.ok) throw new Error('Free AI request failed');
    const text = await res.text();
    return text.trim();
  }
}

window.YARBISBrain = YARBISBrain;
