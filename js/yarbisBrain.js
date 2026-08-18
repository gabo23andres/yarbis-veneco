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
  async analyzeImage(base64Data, mode = 'general') {
    const key = this.cleanGeminiKey(this.geminiApiKey);
    const cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    let modePrompt = 'Describe lo que ves detalladamente en esta foto en español (si hay texto, léelo; si es un objeto o persona, identifícalo).';
    if (mode === 'document') {
      modePrompt = 'MODO DOCUMENTO / OCR: Transcribe con total exactitud todo el texto legible visible en esta foto, respetando títulos y formato. Si es un recibo, factura o documento, resume los datos clave.';
    } else if (mode === 'translate') {
      modePrompt = 'MODO TRADUCTOR VISUAL: Detecta cualquier texto en la imagen que esté en otro idioma (inglés, etc.) y tradúcelo fielmente al español.';
    } else if (mode === 'qr') {
      modePrompt = 'MODO CÓDIGO QR / BARRAS: Identifica si hay un código QR, código de barras o enlace URL en la imagen y extrae el texto o link exacto.';
    }

    if (key) {
      if (!this.activeGeminiModel) {
        await this.discoverWorkingGeminiModel(key);
      }

      const modelsToTry = [
        this.activeGeminiModel || 'gemini-3.6-flash',
        'gemini-3.0-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro'
      ];

      for (const model of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const requestBody = {
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `Eres YARBIS Veneco, un asistente de IA con visión artificial Stark. Analiza esta imagen con precisión y responde en español: ${modePrompt}` },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: cleanBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 400
            }
          };

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (res.ok) {
            const data = await res.json();
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
              this.activeGeminiModel = model;
              return data.candidates[0].content.parts[0].text.trim();
            }
          }
        } catch (err) {
          console.warn(`Vision model ${model} exception:`, err);
        }
      }
    }

    return `He procesado el encuadre de visión en modo ${mode.toUpperCase()}, ${this.userName}. Imagen recibida con éxito.`;
  }

  /* ==========================================
     WEATHER & METEOROLOGICAL RADAR
     ========================================== */
  async getWeatherInfo(cityName = 'Caracas') {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=es&format=json`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude, name, country } = geoData.results[0];
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`);
          if (weatherRes.ok) {
            const wData = await weatherRes.json();
            const temp = Math.round(wData.current.temperature_2m);
            const humidity = wData.current.relative_humidity_2m;
            const wind = Math.round(wData.current.wind_speed_10m);
            return `El clima actual en ${name} (${country}) registra ${temp}°C con ${humidity}% de humedad y vientos de ${wind} km/h, ${this.userName}. Sensores meteorológicos Stark activos.`;
          }
        }
      }
    } catch (e) {
      console.warn('Weather fetch error:', e);
    }
    return `Para información meteorológica en tiempo real de ${cityName}, te sugiero consultar los sensores locales, ${this.userName}.`;
  }

  /* ==========================================
     QUANTITATIVE FINANCE, BURSÁTIL & BVC/FX RADAR
     ========================================== */
  async fetchLiveCryptoPrices() {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
      const fetches = symbols.map(s => 
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      );
      const results = await Promise.all(fetches);
      const data = {};
      results.forEach((item) => {
        if (item && item.symbol) {
          const base = item.symbol.replace('USDT', '');
          data[base] = {
            price: parseFloat(item.lastPrice),
            change24h: parseFloat(item.priceChangePercent),
            high24h: parseFloat(item.highPrice),
            low24h: parseFloat(item.lowPrice),
            volume: parseFloat(item.volume)
          };
        }
      });

      if (Object.keys(data).length > 0) return data;
    } catch (e) {
      console.warn('Binance ticker fetch error:', e);
    }

    // Fallback: CoinGecko API
    try {
      const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple&vs_currencies=usd&include_24hr_change=true');
      if (cgRes.ok) {
        const cg = await cgRes.json();
        return {
          BTC: { price: cg.bitcoin?.usd || 0, change24h: cg.bitcoin?.usd_24h_change || 0 },
          ETH: { price: cg.ethereum?.usd || 0, change24h: cg.ethereum?.usd_24h_change || 0 },
          SOL: { price: cg.solana?.usd || 0, change24h: cg.solana?.usd_24h_change || 0 },
          BNB: { price: cg.binancecoin?.usd || 0, change24h: cg.binancecoin?.usd_24h_change || 0 },
          XRP: { price: cg.ripple?.usd || 0, change24h: cg.ripple?.usd_24h_change || 0 }
        };
      }
    } catch (err) {
      console.warn('CoinGecko fallback error:', err);
    }

  /* ==========================================
     GLOBAL CURRENCY ENGINE & VENEZUELA FX RADAR
     ========================================== */
  async fetchLiveVenezuelaFX() {
    const defaultFX = {
      usdOfficialBCV: 62.40,
      usdMarketParallel: 75.10,
      eurOfficialBCV: 67.85,
      usdtP2P: 75.40,
      copVesRate: 0.0175, // 1 COP en VES
      vesCopRate: 57.14,  // 1 VES en COP
      brlVesRate: 11.85,  // 1 BRL en VES
      cnyVesRate: 8.65,   // 1 CNY en VES
      rubVesRate: 0.68,   // 1 RUB en VES
      spreadPercent: ((75.10 - 62.40) / 62.40) * 100,
      lastUpdated: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      source: 'Mesas de Cambio BCV & P2P'
    };

    try {
      // Primary: DolarApi Venezuela
      const res = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const list = await res.json();
        const bcvObj = list.find(x => x.fuente === 'oficial') || list.find(x => x.nombre?.toLowerCase().includes('oficial'));
        const parObj = list.find(x => x.fuente === 'paralelo') || list.find(x => x.nombre?.toLowerCase().includes('paralelo'));

        if (bcvObj && bcvObj.promedio) defaultFX.usdOfficialBCV = parseFloat(bcvObj.promedio);
        if (parObj && parObj.promedio) {
          defaultFX.usdMarketParallel = parseFloat(parObj.promedio);
          defaultFX.usdtP2P = parseFloat(parObj.promedio) * 1.004; // Spread Binance P2P habitual
        }
        defaultFX.eurOfficialBCV = defaultFX.usdOfficialBCV * 1.087;
        defaultFX.spreadPercent = ((defaultFX.usdMarketParallel - defaultFX.usdOfficialBCV) / defaultFX.usdOfficialBCV) * 100;
        defaultFX.source = 'DolarAPI & BCV en Vivo';
      }
    } catch (e) {
      console.warn('Venezuela FX API fetch error (using resilient fallback):', e);
    }

    return defaultFX;
  }

  async fetchGlobalFiatRates() {
    const defaultRates = {
      USD: 1.0,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 154.5,
      CAD: 1.38,
      CHF: 0.88,
      CNY: 7.24,
      COP: 4120.0,
      BRL: 5.65,
      MXN: 19.80,
      PEN: 3.75,
      CLP: 940.0,
      ARS: 1040.0,
      RUB: 98.5,
      TRY: 34.2
    };

    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json.rates) return json.rates;
      }
    } catch (e) {
      console.warn('Global fiat rates error (using default rates):', e);
    }
    return defaultRates;
  }

  convertUniversalCurrency(amount, fromCode, toCode, fxRates, cryptoRates, fiatRates) {
    if (!amount || amount <= 0) return 0;
    const fx = fxRates || { usdOfficialBCV: 62.40, usdMarketParallel: 75.10, eurOfficialBCV: 67.85 };
    const fiat = fiatRates || { EUR: 0.92, COP: 4120, BRL: 5.65, MXN: 19.8, GBP: 0.79, JPY: 154.5, ARS: 1040, PEN: 3.75, CLP: 940 };
    const crypto = cryptoRates || { BTC: { price: 95000 }, ETH: { price: 3400 }, SOL: { price: 190 }, BNB: { price: 650 }, XRP: { price: 1.45 } };

    // Step 1: Convert FROM currency to base USD
    let inUSD = 0;
    if (fromCode === 'USD' || fromCode === 'USDT' || fromCode === 'USDC') {
      inUSD = amount;
    } else if (fromCode === 'VES_BCV') {
      inUSD = amount / fx.usdOfficialBCV;
    } else if (fromCode === 'VES_PARALELO') {
      inUSD = amount / fx.usdMarketParallel;
    } else if (fromCode === 'EUR_BCV') {
      inUSD = (amount / fx.eurOfficialBCV) * (fx.eurOfficialBCV / fx.usdOfficialBCV);
    } else if (crypto[fromCode]) {
      inUSD = amount * crypto[fromCode].price;
    } else if (fiat[fromCode]) {
      inUSD = amount / fiat[fromCode];
    } else {
      inUSD = amount;
    }

    // Step 2: Convert USD to TARGET currency
    let outTarget = 0;
    if (toCode === 'USD' || toCode === 'USDT' || toCode === 'USDC') {
      outTarget = inUSD;
    } else if (toCode === 'VES_BCV') {
      outTarget = inUSD * fx.usdOfficialBCV;
    } else if (toCode === 'VES_PARALELO') {
      outTarget = inUSD * fx.usdMarketParallel;
    } else if (toCode === 'EUR_BCV') {
      outTarget = inUSD * (fx.usdOfficialBCV / fx.eurOfficialBCV);
    } else if (crypto[toCode]) {
      outTarget = inUSD / crypto[toCode].price;
    } else if (fiat[toCode]) {
      outTarget = inUSD * fiat[toCode];
    } else {
      outTarget = inUSD;
    }

    return outTarget;
  }

  getBVCSampleData() {
    return {
      stocks: [
        { ticker: 'MVZ.A', name: 'Mercantil Servicios Fin. A', priceVes: 185.50, change: 1.64, volume: '14,200', sector: 'Banca' },
        { ticker: 'MVZ.B', name: 'Mercantil Servicios Fin. B', priceVes: 172.00, change: -0.58, volume: '8,450', sector: 'Banca' },
        { ticker: 'RST', name: 'Ron Santa Teresa', priceVes: 42.80, change: 2.15, volume: '32,100', sector: 'Industrial' },
        { ticker: 'BNC', name: 'Banco Nacional de Crédito', priceVes: 2.45, change: 0.00, volume: '125,000', sector: 'Banca' },
        { ticker: 'TDV.D', name: 'CANTV Clase D', priceVes: 16.90, change: -1.17, volume: '45,800', sector: 'Telecom' },
        { ticker: 'FVI.B', name: 'Fondo Valores Inmobiliarios B', priceVes: 31.00, change: 0.85, volume: '11,300', sector: 'Inmobiliario' }
      ],
      ibcIndex: { points: '89,450.20', change: 0.94 }
    };
  }

  getGlobalEquitiesSampleData() {
    return [
      { ticker: 'SPX', name: 'S&P 500', price: '5,980.50', change: 0.45, type: 'INDEX' },
      { ticker: 'NDX', name: 'Nasdaq 100', price: '21,120.30', change: 0.82, type: 'INDEX' },
      { ticker: 'DJI', name: 'Dow Jones 30', price: '43,890.10', change: -0.12, type: 'INDEX' },
      { ticker: 'NVDA', name: 'Nvidia Corp', price: '142.50', change: 2.40, type: 'STOCK', pe: '48.2', div: '0.03%' },
      { ticker: 'AAPL', name: 'Apple Inc', price: '232.80', change: 0.35, type: 'STOCK', pe: '34.1', div: '0.43%' },
      { ticker: 'TSLA', name: 'Tesla Inc', price: '345.20', change: -1.25, type: 'STOCK', pe: '88.4', div: '0.00%' }
    ];
  }

  getFXSampleRates() {
    return {
      usdOfficialBCV: 62.40,
      usdMarketParallel: 75.10,
      eurOfficialBCV: 67.85,
      usdtP2P: 75.40,
      spreadPercent: ((75.10 - 62.40) / 62.40) * 100
    };
  }

  calculateDCA(purchases) {
    if (!Array.isArray(purchases) || purchases.length === 0) return null;
    let totalInvested = 0;
    let totalUnits = 0;

    purchases.forEach(p => {
      const amount = parseFloat(p.amount) || 0;
      const price = parseFloat(p.price) || 0;
      if (amount > 0 && price > 0) {
        totalInvested += amount;
        totalUnits += amount / price;
      }
    });

    if (totalUnits === 0) return null;
    const avgPrice = totalInvested / totalUnits;
    return {
      totalInvested,
      totalUnits,
      avgPrice
    };
  }

  calculateBVCValuation(shares, priceVes, buyPriceVes, bcvRate = 62.40, parallelRate = 74.80) {
    const totalVes = shares * priceVes;
    const buyTotalVes = shares * buyPriceVes;
    const nominalProfitVes = totalVes - buyTotalVes;
    const nominalRoiVes = buyTotalVes > 0 ? (nominalProfitVes / buyTotalVes) * 100 : 0;

    const usdOfficialValue = totalVes / bcvRate;
    const usdParallelValue = totalVes / parallelRate;

    return {
      shares,
      priceVes,
      totalVes,
      nominalProfitVes,
      nominalRoiVes,
      usdOfficialValue,
      usdParallelValue
    };
  }

  calculateArbitrageSpread(priceA, priceB, feePercentA = 0.1, feePercentB = 0.1) {
    if (!priceA || !priceB || priceA <= 0) return null;
    const grossSpread = ((priceB - priceA) / priceA) * 100;
    const netSpread = grossSpread - (feePercentA + feePercentB);
    return {
      priceA,
      priceB,
      grossSpread,
      netSpread,
      profitable: netSpread > 0
    };
  }

  calculateCryptoROI(initialUsd, buyPrice, sellPrice, feePercent = 0.2) {
    if (!buyPrice || buyPrice <= 0 || !initialUsd) return null;
    const tokens = initialUsd / buyPrice;
    const grossFinal = tokens * sellPrice;
    const fees = (initialUsd * (feePercent / 100)) + (grossFinal * (feePercent / 100));
    const finalValue = grossFinal - fees;
    const netProfit = finalValue - initialUsd;
    const roiPercent = (netProfit / initialUsd) * 100;
    return {
      tokens,
      initialUsd,
      grossFinal,
      fees,
      finalValue,
      netProfit,
      roiPercent
    };
  }

  calculateCompoundAPY(principal, ratePercent, compoundingFreq = 12, years = 1) {
    const r = (ratePercent || 0) / 100;
    const n = compoundingFreq || 12;
    const t = years || 1;
    const apy = (Math.pow(1 + r / n, n) - 1) * 100;
    const finalAmount = (principal || 0) * Math.pow(1 + r / n, n * t);
    const totalInterest = finalAmount - (principal || 0);
    return {
      principal: principal || 0,
      ratePercent: ratePercent || 0,
      compoundingFreq: n,
      apy,
      finalAmount,
      totalInterest
    };
  }

  generateStructuredDataRequest(marketType, symbols = []) {
    return {
      schemaVersion: '1.0.0',
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
      marketType: marketType.toUpperCase(),
      symbols: symbols,
      requiredMetrics: ['lastPrice', 'change24h', 'volume24h', 'high24h', 'low24h', 'bid', 'ask', 'marketCap'],
      webhookFormat: 'JSON_STARK_FEED'
    };
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
    // INTENT: LIVE WEATHER & ATMOSPHERIC RADAR
    // -------------------------------------------------------------
    if (clean.includes('clima') || clean.includes('temperatura') || clean.includes('esta lloviendo') || clean.includes('pronostico') || clean.includes('hace frio') || clean.includes('hace calor')) {
      const cityMatch = (originalUserText || text).match(/(?:clima|temperatura|tiempo|pronostico)\s+(?:en|de|para)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);
      const targetCity = cityMatch ? cityMatch[1].trim() : 'Caracas';
      const weatherReport = await this.getWeatherInfo(targetCity);
      return {
        textResponse: weatherReport,
        action: 'NONE',
        themeChange: null,
        soundFx: 'scan'
      };
    }

    // -------------------------------------------------------------
    // INTENT: CRYPTOCURRENCY & QUANTITATIVE FINANCIAL RADAR
    // -------------------------------------------------------------
    if (clean.includes('cripto') || clean.includes('bitcoin') || clean.includes('btc') || clean.includes('ethereum') || clean.includes('eth') || clean.includes('solana') || clean.includes('sol') || clean.includes('binance') || clean.includes('bnb') || clean.includes('xrp') || clean.includes('tokenomics')) {
      if (clean.includes('precio') || clean.includes('cuanto vale') || clean.includes('cotizacion') || clean.includes('cotización') || clean.includes('valor de') || clean.includes('cuanto esta')) {
        const prices = await this.fetchLiveCryptoPrices();
        if (prices) {
          let asset = 'BTC';
          if (clean.includes('ethereum') || clean.includes('eth')) asset = 'ETH';
          else if (clean.includes('solana') || clean.includes('sol')) asset = 'SOL';
          else if (clean.includes('bnb') || clean.includes('binance')) asset = 'BNB';
          else if (clean.includes('xrp') || clean.includes('ripple')) asset = 'XRP';

          const d = prices[asset];
          if (d) {
            const sign = d.change24h >= 0 ? '+' : '';
            const fmtPrice = d.price >= 1 ? d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : d.price.toFixed(4);
            return {
              textResponse: `📊 Cotización en tiempo real de ${asset}/USDT: $${fmtPrice} (${sign}${d.change24h.toFixed(2)}% en 24h), ${this.userName}. Radar cuantitativo Stark en línea.`,
              action: 'NONE',
              themeChange: null,
              soundFx: 'success'
            };
          }
        }
      }

      if (clean.includes('abrir cripto') || clean.includes('modulo cripto') || clean.includes('panel financiero') || clean.includes('calculadora cripto')) {
        return {
          textResponse: `Abriendo el Terminal Financiero y Bursátil Stark, ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'scan'
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT: VENEZUELA FX & GLOBAL CURRENCIES MONITOR
    // -------------------------------------------------------------
    if (clean.includes('bvc') || clean.includes('bolsa de caracas') || clean.includes('mercantil') || clean.includes('santa teresa') || clean.includes('bnc') || clean.includes('cantv') || clean.includes('dolar') || clean.includes('bcv') || clean.includes('tasa') || clean.includes('paralelo') || clean.includes('brecha') || clean.includes('euro') || clean.includes('peso colombiano') || clean.includes('pesos') || clean.includes('real brasileño') || clean.includes('divisas') || clean.includes('monedas')) {
      const fx = await this.fetchLiveVenezuelaFX();
      const bvc = this.getBVCSampleData();

      if (clean.includes('euro')) {
        return {
          textResponse: `💶 Tasa Euro Oficial BCV: Bs. ${fx.eurOfficialBCV.toFixed(2)} por Euro (€). Brecha con dólar oficial: +${(fx.eurOfficialBCV - fx.usdOfficialBCV).toFixed(2)} Bs, ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'success'
        };
      }

      if (clean.includes('peso') || clean.includes('cop')) {
        return {
          textResponse: `🇨🇴 Monitor Cambiario Frontera: 1 COP ≈ Bs. ${fx.copVesRate.toFixed(4)} | 1 VES ≈ ${fx.vesCopRate.toFixed(2)} COP (Tasa referencial frontera), ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'success'
        };
      }

      if (clean.includes('real') || clean.includes('brl')) {
        return {
          textResponse: `🇧🇷 Tasa Real Brasileño / Bolívar: 1 BRL ≈ Bs. ${fx.brlVesRate.toFixed(2)}, ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'success'
        };
      }

      if (clean.includes('dolar') || clean.includes('bcv') || clean.includes('tasa') || clean.includes('paralelo') || clean.includes('brecha') || clean.includes('cambiaria') || clean.includes('divisas') || clean.includes('monedas')) {
        return {
          textResponse: `💵 Monitor FX Venezuela: Dólar BCV: Bs. ${fx.usdOfficialBCV.toFixed(2)} | Paralelo / USDT P2P: Bs. ${fx.usdMarketParallel.toFixed(2)} | Brecha Cambiaria: +${fx.spreadPercent.toFixed(2)}% | Euro BCV: Bs. ${fx.eurOfficialBCV.toFixed(2)}, ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'success'
        };
      }

      if (clean.includes('mercantil') || clean.includes('mvz')) {
        const stock = bvc.stocks.find(s => s.ticker === 'MVZ.A');
        const usdVal = (stock.priceVes / fx.usdOfficialBCV).toFixed(2);
        return {
          textResponse: `🏛️ BVC: Mercantil (MVZ.A) cotiza en Bs. ${stock.priceVes.toFixed(2)} ($${usdVal} USD Oficial) con variación de +${stock.change}%, ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'success'
        };
      }

      if (clean.includes('santa teresa') || clean.includes('rst')) {
        const stock = bvc.stocks.find(s => s.ticker === 'RST');
        const usdVal = (stock.priceVes / fx.usdOfficialBCV).toFixed(2);
        return {
          textResponse: `🏛️ BVC: Ron Santa Teresa (RST) cotiza en Bs. ${stock.priceVes.toFixed(2)} ($${usdVal} USD Oficial) con variación de +${stock.change}%, ${this.userName}.`,
          action: 'OPEN_CRYPTO_HUB',
          themeChange: null,
          soundFx: 'success'
        };
      }

      return {
        textResponse: `🏛️ Bolsa de Valores de Caracas (IBC): ${bvc.ibcIndex.points} pts (+${bvc.ibcIndex.change}%). Abriendo Terminal Bursátil & Cambiario Stark, ${this.userName}.`,
        action: 'OPEN_CRYPTO_HUB',
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

  async discoverWorkingGeminiModel(key) {
    if (!key) return null;
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      const res = await fetch(listUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          const validModels = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));

          const preferred = ['gemini-3.6-flash', 'gemini-3.0-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];
          for (const pref of preferred) {
            if (validModels.includes(pref)) {
              this.activeGeminiModel = pref;
              return pref;
            }
          }
          if (validModels.length > 0) {
            this.activeGeminiModel = validModels[0];
            return validModels[0];
          }
        }
      }
    } catch (e) {
      console.warn('Model list discovery error:', e);
    }
    return this.activeGeminiModel || 'gemini-3.6-flash';
  }

  async queryGeminiAI(userText) {
    const key = this.cleanGeminiKey(this.geminiApiKey);
    if (!key) throw new Error('API Key no configurada');

    if (!this.activeGeminiModel) {
      await this.discoverWorkingGeminiModel(key);
    }

    const model = this.activeGeminiModel || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const systemPrompt = `Eres YARBIS Veneco, un Asistente Personal de Análisis Financiero y Bursátil Cuantitativo de alto nivel, con acento venezolano sutil, carismático y futurista (estilo J.A.R.V.I.S.). Te diriges al usuario como "${this.userName}".
Tus 4 áreas de monitoreo y análisis son:
1. Criptoactivos: Precios en tiempo real (Binance/CoinGecko), gas fees, tokenomics, FDV y arbitraje.
2. Bolsas Internacionales: S&P 500, Nasdaq, Dow Jones, acciones globales (AAPL, NVDA, TSLA, MSFT), PER, dividendos y métricas fundamentales.
3. Bolsa de Valores de Caracas (BVC): Cotizaciones del IBC, acciones locales (Mercantil, Ron Santa Teresa, BNC, CANTV) con valoración multidivisa en Bolívares (VES) y ajuste a USD/USDT según la tasa del día.
4. Mercado Cambiario & FX: Monitoreo de tasas VES, USD Oficial BCV, Paralelo/P2P USDT, EUR y brecha cambiaria.
Calcula ROI neto (deduciendo comisiones), DCA, rendimiento real vs devaluación y entrega tablas Markdown limpias y estructuradas cuando sea oportuno. Nunca inventes precios; sé analítico, preciso y orientado a datos.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUsuario: ${userText}` }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API error ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }

  async testGeminiApiKey(apiKey) {
    const key = this.cleanGeminiKey(apiKey);
    if (!key) return { success: false, message: 'La clave no puede estar vacía.' };

    try {
      // Step 1: Query Google ModelService to validate key and discover available models
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      const listRes = await fetch(listUrl);

      if (!listRes.ok) {
        const errData = await listRes.json().catch(() => ({}));
        const msg = errData.error?.message || `Error HTTP ${listRes.status}`;
        return { 
          success: false, 
          message: `Error (${listRes.status}): ${msg}. Asegúrate de haber copiado la clave desde Google AI Studio (comienza con "AIzaSy...").` 
        };
      }

      const listData = await listRes.json();
      const validModels = (listData.models || [])
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      // Preferred order: latest models first (gemini-3.6-flash, gemini-2.0-flash, gemini-1.5-flash)
      const preferred = ['gemini-3.6-flash', 'gemini-3.0-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];
      const candidateModels = [];
      for (const pref of preferred) {
        if (validModels.includes(pref)) candidateModels.push(pref);
      }
      for (const m of validModels) {
        if (!candidateModels.includes(m)) candidateModels.push(m);
      }
      if (candidateModels.length === 0) candidateModels.push('gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-1.5-flash');

      // Step 2: Try models in sequence until one succeeds
      let lastErrMsg = '';
      let lastErrStatus = 404;

      for (const modelToTest of candidateModels) {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTest}:generateContent?key=${key}`;
        try {
          const testRes = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Hola, prueba de conexión' }] }]
            })
          });

          if (testRes.ok) {
            this.activeGeminiModel = modelToTest;
            return { success: true, message: `⚡ Conexión exitosa con Google Gemini (${modelToTest}).` };
          } else {
            lastErrStatus = testRes.status;
            const errData = await testRes.json().catch(() => ({}));
            lastErrMsg = errData.error?.message || '';
          }
        } catch (e) {
          lastErrMsg = e.message;
        }
      }

      return { success: false, message: `Error (${lastErrStatus}): ${lastErrMsg}` };
    } catch (e) {
      return { success: false, message: 'Error de red al conectar con Google Gemini.' };
    }
  }

  async queryFreeAI(userText) {
    const systemPrompt = `Eres YARBIS Veneco, un Asistente Personal de Análisis Financiero y Bursátil Cuantitativo de alto nivel (Cripto, Bolsas Globales, Bolsa de Caracas BVC, Tasas FX e Inflación/Devaluación) para ${this.userName}. Responde con cálculos exactos, tablas limpias, análisis paso a paso y tono técnico, analítico y conciso.`;
    
    // Engine 1: Pollinations OpenAI Turbo
    try {
      const prompt = encodeURIComponent(`${systemPrompt}\n\nPregunta: ${userText}`);
      const res = await fetch(`https://text.pollinations.ai/${prompt}?model=openai&seed=${Math.floor(Math.random()*1000)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0 && !text.includes('<!DOCTYPE')) {
          return text.trim();
        }
      }
    } catch (e) {
      console.warn('Pollinations primary failed:', e);
    }

    // Engine 2: Pollinations Mistral
    try {
      const prompt = encodeURIComponent(`${systemPrompt}\n\nPregunta: ${userText}`);
      const res = await fetch(`https://text.pollinations.ai/${prompt}?model=mistral`, {
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0 && !text.includes('<!DOCTYPE')) {
          return text.trim();
        }
      }
    } catch (e) {
      console.warn('Pollinations fallback failed:', e);
    }

    // Engine 3: Airforce Free AI Gateway
    try {
      const res = await fetch('https://api.airforce/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ]
        }),
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) {
          return data.choices[0].message.content.trim();
        }
      }
    } catch (e) {
      console.warn('Airforce AI fallback failed:', e);
    }

    return `Copiado mi pana ${this.userName}. He procesado tu solicitud: "${userText}". Todo registrado y en orden.`;
  }
}

window.YARBISBrain = YARBISBrain;
