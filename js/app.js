/* ==========================================================================
   YARBIS - MAIN APPLICATION CONTROLLER 3.0
   Personal Assistant: STT/TTS, Arc Reactor Canvas, Notes, Timers & Settings
   ========================================================================== */

function initYarbisApp() {
  if (window.__yarbisInitialized) return;
  window.__yarbisInitialized = true;

  // Initialize Subsystems Resiliently
  let audioSynth = window.audioSynth;
  if (!audioSynth && window.AudioSynthesizer) {
    try { audioSynth = new window.AudioSynthesizer(); } catch(e) { console.warn('AudioSynth init warning:', e); }
  }

  let arcReactor = null;
  if (window.ArcReactorEngine) {
    try { arcReactor = new window.ArcReactorEngine('arcReactorCanvas', 'waveformCanvas', 'bgParticlesCanvas'); } catch(e) { console.warn('ArcReactor init warning:', e); }
  }

  let speechEngine = window.speechEngine;
  if (!speechEngine && window.YARBISSpeechEngine) {
    try { speechEngine = new window.YARBISSpeechEngine(); } catch(e) { console.warn('SpeechEngine init warning:', e); }
  }

  let brain = window.brain;
  if (!brain && window.YARBISBrain) {
    try { brain = new window.YARBISBrain(); } catch(e) { console.warn('Brain init warning:', e); }
  }

  window.audioSynth = audioSynth || { playClickSound: ()=>{}, playSuccessChime: ()=>{}, playScanSound: ()=>{}, initContext: ()=>{} };
  window.arcReactor = arcReactor || { setAudioLevel: ()=>{}, setState: ()=>{} };
  window.speechEngine = speechEngine || { speak: ()=>{}, toggleListening: ()=>{}, primeSpeechSynthesis: ()=>{} };
  window.brain = brain || { userName: 'Señor', assistantName: 'YARBIS' };

  // UI Element References
  const btnMic = document.getElementById('btnMic');
  const btnSettings = document.getElementById('btnSettings');
  const btnScan = document.getElementById('btnScan');
  const btnMute = document.getElementById('btnMute');
  const textInput = document.getElementById('textInput');
  const btnSend = document.getElementById('btnSend');
  const transcriptScroll = document.getElementById('transcriptScroll');
  const btnClearChat = document.getElementById('btnClearChat');

  const stateValue = document.getElementById('stateValue');
  const hudClock = document.getElementById('hudClock');
  const promptPills = document.querySelectorAll('.prompt-pill');
  const protocolButtons = document.querySelectorAll('.btn-protocol');
  const appPills = document.querySelectorAll('.app-pill');

  // Header Brand Elements
  const displayAssistantName = document.getElementById('displayAssistantName');
  const displayUserGreeting = document.getElementById('displayUserGreeting');

  // Notes & Reminders Elements
  const inputNewNote = document.getElementById('inputNewNote');
  const btnAddNote = document.getElementById('btnAddNote');
  const notesScroll = document.getElementById('notesScroll') || document.getElementById('notesList');
  const notesCount = document.getElementById('notesCount');
  const noteFilterBtns = document.querySelectorAll('.btn-filter-note');

  // Timer Elements
  const timerWidget = document.getElementById('timerWidget');
  const timerDisplay = document.getElementById('timerDisplay');
  const timerProgress = document.getElementById('timerProgress');
  const btnCancelTimer = document.getElementById('btnCancelTimer');

  // Telemetry Elements
  const valEnergy = document.getElementById('valEnergy');
  const barEnergy = document.getElementById('barEnergy');
  const valTemp = document.getElementById('valTemp');
  const barTemp = document.getElementById('barTemp');
  const radarStatus = document.getElementById('radarStatus');

  // Modal Settings Elements
  const modalSettings = document.getElementById('modalSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const inputAssistantName = document.getElementById('inputAssistantName');
  const inputUserName = document.getElementById('inputUserName');
  const inputGeminiKey = document.getElementById('inputGeminiKey');
  const selectLanguage = document.getElementById('selectLanguage');
  const keyTestResult = document.getElementById('keyTestResult');

  // Modal Elements
  const modalWatermarksCleaner = document.getElementById('modalWatermarksCleaner');
  const modalCryptoFinance = document.getElementById('modalCryptoFinance');
  const modalInstallPwa = document.getElementById('modalInstallPwa');
  const btnCloseInstallPwa = document.getElementById('btnCloseInstallPwa');
  const txtWatermarkInput = document.getElementById('txtWatermarkInput');
  const txtWatermarkOutput = document.getElementById('txtWatermarkOutput');
  const valZeroWidthTokens = document.getElementById('valZeroWidthTokens');
  const valAiPatterns = document.getElementById('valAiPatterns');
  const valPurityScore = document.getElementById('valPurityScore');
  const watermarkStatusBadge = document.getElementById('watermarkStatusBadge');

  let isMuted = false;
  let activeFilter = 'all';
  let notesList = JSON.parse(localStorage.getItem('yarbis_notes_list') || '[]');
  let timerInterval = null;
  let timerTotalSec = 0;
  let timerRemainingSec = 0;

  // Initialize Clock
  function updateClock() {
    const now = new Date();
    hudClock.textContent = now.toLocaleTimeString('es-ES', { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Load and apply Assistant & User Name Branding
  function updateBrandingUI() {
    if (displayAssistantName) {
      displayAssistantName.textContent = (brain.assistantName || 'YARBIS').toUpperCase();
    }
    if (displayUserGreeting) {
      displayUserGreeting.textContent = `Tu Asistente Personal • ${brain.userName}`;
    }
  }
  updateBrandingUI();

  // Live Telemetry Simulation
  function simulateTelemetry() {
    if (!valEnergy) return;
    const energyVal = (98.2 + (Math.random() * 0.6 - 0.3)).toFixed(1);
    const tempVal = Math.floor(41 + Math.random() * 3);

    valEnergy.textContent = `${energyVal}%`;
    barEnergy.style.width = `${energyVal}%`;
    valTemp.textContent = `${tempVal}°C`;
    barTemp.style.width = `${Math.min(tempVal, 100)}%`;
  }
  setInterval(simulateTelemetry, 3000);

  // Audio Level Sync from Speech Engine to Canvas Reactor
  speechEngine.onAudioLevel = (level) => {
    arcReactor.setAudioLevel(level);
  };

  speechEngine.onPermissionError = (msg) => {
    appendMessage(brain.assistantName, `⚠️ ${msg}`);
  };

  // State Change Sync
  speechEngine.onStateChange = (state) => {
    arcReactor.setState(state);

    if (state === 'LISTENING') {
      btnMic.classList.add('listening');
      stateValue.textContent = 'ESCUCHANDO...';
      stateValue.style.color = 'var(--color-danger)';
    } else if (state === 'PROCESSING') {
      btnMic.classList.remove('listening');
      stateValue.textContent = 'PROCESANDO...';
      stateValue.style.color = 'var(--color-accent)';
    } else if (state === 'SPEAKING') {
      btnMic.classList.remove('listening');
      stateValue.textContent = 'HABLANDO...';
      stateValue.style.color = 'var(--color-primary)';
    } else {
      btnMic.classList.remove('listening');
      stateValue.textContent = 'EN ESPERA';
      stateValue.style.color = 'var(--color-primary)';
    }
  };

  // Speech Recognition Result
  speechEngine.onSpeechResult = async (userText) => {
    appendMessage('USER', userText);
    await handleUserQuery(userText);
  };

  speechEngine.onInterimResult = (interimText) => {
    if (stateValue) {
      stateValue.textContent = `🎙️ "${interimText.substring(0, 30)}"`;
      stateValue.style.color = 'var(--color-danger)';
    }
  };

  // Central User Command Handler
  async function handleUserQuery(userText) {
    if (!userText) return;

    audioSynth.playSuccessChime();

    // Query Brain
    const response = await brain.processCommand(userText);

    // Play Special Sound FX if requested
    if (response.soundFx === 'hulkbuster') {
      audioSynth.playHulkbusterSound();
    } else if (response.soundFx === 'scan') {
      audioSynth.playScanSound();
    } else if (response.soundFx === 'repulsor') {
      audioSynth.playRepulsorSound();
    } else if (response.soundFx === 'nano') {
      audioSynth.playNanoArmorSound();
    }

    // Apply UI Theme Changes if commanded
    if (response.themeChange) {
      applyTheme(response.themeChange);
    }

    // Special Action Handlers
    if (response.action === 'CLEAR_LOGS') {
      transcriptScroll.innerHTML = '';
    } else if (response.action === 'SCAN') {
      if (radarStatus) radarStatus.textContent = "AMENAZAS DETECTADAS: 0 • PERÍMETRO SEGURO";
    } else if (response.action === 'OPEN_URL') {
      launchApp(response.url, response.deepLink);
    } else if (response.action === 'ADD_NOTE' && response.noteText) {
      addNote(response.noteText);
    } else if (response.action === 'SHOW_NOTES') {
      setNoteFilter('all');
    } else if (response.action === 'CLEAR_NOTES') {
      clearAllNotes();
    } else if (response.action === 'SET_TIMER' && response.durationSeconds) {
      startTimer(response.durationSeconds);
    } else if (response.action === 'CANCEL_TIMER') {
      cancelTimer();
    } else if (response.action === 'SET_ALARM' && response.alarmData) {
      addAlarm(response.alarmData);
    } else if (response.action === 'OPEN_CAMERA') {
      openCameraModal();
    } else if (response.action === 'OPEN_WATERMARK_CLEANER') {
      openWatermarkModal();
    } else if (response.action === 'OPEN_CRYPTO_HUB') {
      openCryptoFinanceModal();
    } else if (response.action === 'TORCH_ON') {
      toggleTorch(true);
    } else if (response.action === 'TORCH_OFF') {
      toggleTorch(false);
    } else if (response.action === 'CHECK_BATTERY') {
      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          const levelPct = Math.round(battery.level * 100);
          const isCharging = battery.charging ? 'y se encuentra cargando ⚡' : 'desconectado del cargador 🔋';
          const batteryMsg = `Tu teléfono tiene ${levelPct}% de batería ${isCharging}, ${brain.userName}.`;
          appendMessage(brain.assistantName, batteryMsg, true);
          speechEngine.speak(batteryMsg);
          return;
        } catch (e) {}
      }
      const genericMsg = `No tengo acceso al sensor de batería en este navegador, pero los sistemas de energía de YARBIS están al 100%, ${brain.userName}.`;
      appendMessage(brain.assistantName, genericMsg, true);
      speechEngine.speak(genericMsg);
      return;
    }

    // Append Assistant Response
    appendMessage(brain.assistantName, response.textResponse, true);

    // If opening an app, call, or whatsapp, attach interactive launch button
    if (response.action === 'OPEN_URL') {
      const isCall = (response.deepLink && response.deepLink.startsWith('tel:')) || (response.url && response.url.startsWith('tel:'));
      const isWa = (response.deepLink && response.deepLink.includes('whatsapp')) || (response.url && response.url.includes('whatsapp'));
      
      const btnLabel = isCall ? '📞 Tocar para Iniciar Llamada' : (isWa ? '💬 Tocar para Abrir WhatsApp' : '🚀 Abrir Aplicación');
      const actionUrl = response.deepLink || response.url;

      const launchCard = document.createElement('div');
      launchCard.style.marginTop = '8px';
      launchCard.innerHTML = `<a href="${actionUrl}" style="display:inline-block; background:var(--color-primary); color:#04070d; font-weight:700; font-size:0.78rem; padding:8px 16px; border-radius:20px; text-decoration:none; box-shadow:0 0 15px var(--hud-glow);">${btnLabel}</a>`;
      transcriptScroll.appendChild(launchCard);
      transcriptScroll.scrollTop = transcriptScroll.scrollHeight;

      launchApp(response.url, response.deepLink);
    }

    // Speak Response
    speechEngine.speak(response.textResponse);
  }

  // Append Chat Message
  function appendMessage(sender, messageText, animateTypewriter = false) {
    const msgDiv = document.createElement('div');
    const isUser = sender === 'USER';
    msgDiv.className = `chat-msg ${isUser ? 'user' : 'yarbis'}`;

    const authorSpan = document.createElement('span');
    authorSpan.className = 'msg-author';
    authorSpan.textContent = isUser ? brain.userName.toUpperCase() : `${brain.assistantName.toUpperCase()} OS`;

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'msg-body';

    msgDiv.appendChild(authorSpan);
    msgDiv.appendChild(bodyDiv);
    transcriptScroll.appendChild(msgDiv);

    if (animateTypewriter && !isUser) {
      let index = 0;
      bodyDiv.textContent = '';
      const typeInterval = setInterval(() => {
        bodyDiv.textContent += messageText.charAt(index);
        index++;
        transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
        if (index >= messageText.length) {
          clearInterval(typeInterval);
        }
      }, 14);
    } else {
      bodyDiv.textContent = messageText;
      transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
    }
  }

  // Smart Application Launcher for Mobile Native Apps & Web
  function launchApp(webUrl, deepLink) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const targetUrl = (isMobile && deepLink) ? deepLink : (webUrl || deepLink);

    if (!targetUrl) return;

    if (targetUrl.startsWith('tel:') || targetUrl.startsWith('whatsapp:') || targetUrl.startsWith('sms:') || targetUrl.startsWith('whatsapp-business:')) {
      window.location.href = targetUrl;
    } else if (isMobile) {
      window.location.href = targetUrl;
    } else {
      window.open(webUrl || targetUrl, '_blank');
    }
  }

  // Theme Switcher
  function applyTheme(themeName) {
    document.body.className = '';
    if (themeName && themeName !== 'default') {
      document.body.classList.add(themeName);
    }

    const computedPrimary = getComputedStyle(document.body).getPropertyValue('--color-primary').trim();
    const computedRgb = getComputedStyle(document.body).getPropertyValue('--color-primary-rgb').trim();
    arcReactor.setTheme(computedPrimary, computedRgb);

    audioSynth.playProtocolAlert();
  }

  /* ==========================================
     NOTES & REMINDERS CONTROLLER
     ========================================== */
  function saveNotes() {
    localStorage.setItem('yarbis_notes_list', JSON.stringify(notesList));
    renderNotes();
  }

  function addNote(text) {
    if (!text || !text.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const newNote = {
      id: Date.now(),
      text: text.trim(),
      completed: false,
      timestamp: timeStr
    };
    notesList.unshift(newNote);
    saveNotes();
  }

  function toggleNoteCompleted(id) {
    notesList = notesList.map(n => n.id === id ? { ...n, completed: !n.completed } : n);
    saveNotes();
  }

  function deleteNote(id) {
    notesList = notesList.filter(n => n.id !== id);
    saveNotes();
  }

  function clearAllNotes() {
    notesList = [];
    saveNotes();
  }

  function setNoteFilter(filter) {
    activeFilter = filter;
    noteFilterBtns.forEach(btn => {
      if (btn.getAttribute('data-filter') === filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    renderNotes();
  }

  function renderNotes() {
    notesScroll.innerHTML = '';

    const filtered = notesList.filter(n => {
      if (activeFilter === 'active') return !n.completed;
      if (activeFilter === 'completed') return n.completed;
      return true;
    });

    const activeCount = notesList.filter(n => !n.completed).length;
    notesCount.textContent = `${activeCount} ${activeCount === 1 ? 'NOTA' : 'NOTAS'}`;

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-notes';
      emptyDiv.textContent = activeFilter === 'completed'
        ? 'No hay notas completadas.'
        : 'No hay notas o recordatorios. ¡Agrega uno nuevo!';
      notesScroll.appendChild(emptyDiv);
      return;
    }

    filtered.forEach(note => {
      const itemDiv = document.createElement('div');
      itemDiv.className = `note-item ${note.completed ? 'completed' : ''}`;

      const checkBtn = document.createElement('button');
      checkBtn.className = 'btn-note-check';
      checkBtn.innerHTML = note.completed ? '✓' : '';
      checkBtn.title = note.completed ? 'Marcar pendiente' : 'Marcar completado';
      checkBtn.addEventListener('click', () => {
        audioSynth.playClickSound();
        toggleNoteCompleted(note.id);
      });

      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content';

      const textSpan = document.createElement('span');
      textSpan.className = 'note-text';
      textSpan.textContent = note.text;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'note-time';
      timeSpan.textContent = note.timestamp;

      contentDiv.appendChild(textSpan);
      contentDiv.appendChild(timeSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-note-delete';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Eliminar nota';
      delBtn.addEventListener('click', () => {
        audioSynth.playClickSound();
        deleteNote(note.id);
      });

      itemDiv.appendChild(checkBtn);
      itemDiv.appendChild(contentDiv);
      itemDiv.appendChild(delBtn);

      notesScroll.appendChild(itemDiv);
    });
  }

  // Note Input Listener
  if (btnAddNote && inputNewNote) {
    const handleAddNoteSubmit = () => {
      const val = inputNewNote.value.trim();
      if (val) {
        audioSynth.playClickSound();
        addNote(val);
        inputNewNote.value = '';
      }
    };
    btnAddNote.addEventListener('click', handleAddNoteSubmit);
    inputNewNote.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddNoteSubmit();
    });
  }

  // Note Filter Buttons
  noteFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      audioSynth.playClickSound();
      setNoteFilter(btn.getAttribute('data-filter'));
    });
  });

  /* ==========================================
     TIMERS & COUNTDOWNS CONTROLLER
     ========================================== */
  function startTimer(seconds) {
    cancelTimer();

    timerTotalSec = seconds;
    timerRemainingSec = seconds;

    if (timerWidget) timerWidget.style.display = 'flex';
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      timerRemainingSec--;
      updateTimerDisplay();

      if (timerRemainingSec <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;

        // Finish Alarm
        audioSynth.playProtocolAlert();
        const finishMsg = `¡${brain.userName}! El temporizador de ${formatTime(timerTotalSec)} ha finalizado.`;
        appendMessage(brain.assistantName, `⏰ ${finishMsg}`);
        speechEngine.speak(finishMsg);

        setTimeout(() => {
          if (timerWidget) timerWidget.style.display = 'none';
        }, 5000);
      }
    }, 1000);
  }

  function cancelTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (timerWidget) timerWidget.style.display = 'none';
  }

  function updateTimerDisplay() {
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(timerRemainingSec);
    }
    if (timerProgress) {
      const pct = (timerRemainingSec / timerTotalSec) * 100;
      timerProgress.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  function formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (btnCancelTimer) {
    btnCancelTimer.addEventListener('click', () => {
      audioSynth.playClickSound();
      cancelTimer();
    });
  }

  /* ==========================================
     GENERAL EVENT LISTENERS & SHORTCUTS
     ========================================== */

  // Mic Button Click
  if (btnMic) {
    btnMic.addEventListener('click', async () => {
      audioSynth.initContext();
      audioSynth.playClickSound();
      speechEngine.primeSpeechSynthesis();
      await speechEngine.toggleListening();
    });
  }

  // Continuous Hands-Free Listening Toggle
  const btnContinuous = document.getElementById('btnContinuous');
  if (btnContinuous) {
    btnContinuous.addEventListener('click', () => {
      audioSynth.initContext();
      audioSynth.playClickSound();
      speechEngine.continuousMode = !speechEngine.continuousMode;
      btnContinuous.classList.toggle('active', speechEngine.continuousMode);
      
      const msg = speechEngine.continuousMode 
        ? 'Modo Manos Libres (Escucha Continua) Activado' 
        : 'Modo Manos Libres Desactivado';
      
      appendMessage(brain.assistantName, `🔄 ${msg}`);
      speechEngine.speak(msg);

      if (speechEngine.continuousMode && !speechEngine.isListening) {
        speechEngine.startListening();
      }
    });
  }

  // Scan Button Click
  if (btnScan) {
    btnScan.addEventListener('click', () => {
      audioSynth.initContext();
      audioSynth.playClickSound();
      appendMessage('USER', 'Escaneo de amenazas');
      handleUserQuery('escaneo de amenazas');
    });
  }

  // Arc Reactor Click
  const arcCanvas = document.getElementById('arcReactorCanvas');
  if (arcCanvas) {
    arcCanvas.addEventListener('click', () => {
      audioSynth.initContext();
      audioSynth.playRepulsorSound();
      arcReactor.setAudioLevel(1.0);
      speechEngine.speak(`Núcleo del asistente ${brain.assistantName} operando al 100% de capacidad.`);
    });
  }

  // Clear Chat Button
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      audioSynth.playClickSound();
      transcriptScroll.innerHTML = '';
    });
  }

  // Text Input Submit
  function submitTextInput() {
    const val = textInput.value.trim();
    if (val) {
      audioSynth.initContext();
      audioSynth.playClickSound();
      appendMessage('USER', val);
      handleUserQuery(val);
      textInput.value = '';
    }
  }

  if (btnSend) {
    btnSend.addEventListener('click', submitTextInput);
  }
  if (textInput) {
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitTextInput();
    });
  }

  // Prompt Pills
  promptPills.forEach(pill => {
    pill.addEventListener('click', () => {
      audioSynth.initContext();
      audioSynth.playClickSound();
      const promptText = pill.getAttribute('data-prompt');
      appendMessage('USER', promptText);
      handleUserQuery(promptText);
    });
  });

  // Protocol / Theme Buttons
  protocolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      audioSynth.initContext();
      audioSynth.playClickSound();
      const themeName = btn.getAttribute('data-theme');
      applyTheme(themeName);
    });
  });

  // Mute Button
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      isMuted = !isMuted;
      audioSynth.setMuted(isMuted);
      audioSynth.playClickSound();
      btnMute.innerHTML = isMuted ? '🔇' : '🔊';
    });
  }

  // AI Badge Status Updates
  const btnTestKey = document.getElementById('btnTestKey');
  const keyTestResult = document.getElementById('keyTestResult');
  const aiStatusText = document.getElementById('aiStatusText');
  const aiStatusDot = document.getElementById('aiStatusDot');

  function updateAiStatusBadge() {
    if (!aiStatusText) return;
    if (brain.geminiApiKey) {
      aiStatusText.textContent = 'GEMINI LIVE';
      if (aiStatusDot) aiStatusDot.style.backgroundColor = 'var(--color-success)';
    } else {
      aiStatusText.textContent = 'IA EN VIVO';
      if (aiStatusDot) aiStatusDot.style.backgroundColor = 'var(--color-primary)';
    }
  }
  updateAiStatusBadge();

  if (btnTestKey && inputGeminiKey && keyTestResult) {
    btnTestKey.addEventListener('click', async () => {
      audioSynth.playClickSound();
      keyTestResult.textContent = '⚡ Probando conexión en tiempo real con Google Gemini API...';
      keyTestResult.style.color = 'var(--color-accent)';
      const res = await brain.testGeminiApiKey(inputGeminiKey.value);
      keyTestResult.textContent = res.message;
      keyTestResult.style.color = res.success ? 'var(--color-success)' : 'var(--color-danger)';
      if (res.success) {
        audioSynth.playSuccessChime();
      }
    });
  }

  // Contacts Agenda UI Controller
  const inputContactName = document.getElementById('inputContactName');
  const inputContactPhone = document.getElementById('inputContactPhone');
  const btnAddContact = document.getElementById('btnAddContact');
  const contactsListDisplay = document.getElementById('contactsListDisplay');

  function renderContactsUI() {
    if (!contactsListDisplay) return;
    const contacts = brain.getAllContacts();
    const keys = Object.keys(contacts);
    if (keys.length === 0) {
      contactsListDisplay.textContent = 'No hay contactos guardados en tu agenda. Puedes añadir un contacto arriba o por voz.';
      return;
    }

    contactsListDisplay.innerHTML = keys.map(k => 
      `<span style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid var(--hud-glass-border); border-radius:10px; padding:2px 8px; margin:2px;">
        👤 <strong>${k.toUpperCase()}</strong>: ${contacts[k]}
        <button onclick="window.yarbisDeleteContact('${k}')" style="background:none; border:none; color:var(--color-danger); cursor:pointer; font-weight:bold; margin-left:4px;">✕</button>
      </span>`
    ).join('');
  }

  window.yarbisDeleteContact = (name) => {
    brain.deleteContact(name);
    renderContactsUI();
  };

  if (btnAddContact && inputContactName && inputContactPhone) {
    btnAddContact.addEventListener('click', () => {
      const name = inputContactName.value.trim();
      const phone = inputContactPhone.value.trim();
      if (name && phone) {
        audioSynth.playClickSound();
        brain.saveContact(name, phone);
        inputContactName.value = '';
        inputContactPhone.value = '';
        renderContactsUI();
      }
    });
  }

  const btnImportPhoneContacts = document.getElementById('btnImportPhoneContacts');
  const inputVcfFile = document.getElementById('inputVcfFile');

  // Native Web Contact Picker API (iOS Safari 14.5+ & Android Chrome)
  if (btnImportPhoneContacts) {
    btnImportPhoneContacts.addEventListener('click', async () => {
      audioSynth.playClickSound();
      if ('contacts' in navigator && 'select' in navigator.contacts) {
        try {
          const props = ['name', 'tel'];
          const opts = { multiple: true };
          const contacts = await navigator.contacts.select(props, opts);
          if (contacts && contacts.length > 0) {
            let count = 0;
            contacts.forEach(c => {
              const name = (c.name && c.name[0]) ? c.name[0] : '';
              const tel = (c.tel && c.tel[0]) ? c.tel[0] : '';
              if (name && tel) {
                brain.saveContact(name, tel);
                count++;
              }
            });
            renderContactsUI();
            audioSynth.playSuccessChime();
            speechEngine.speak(`Se han importado ${count} contactos de tu teléfono a YARBIS, ${brain.userName}.`);
          }
        } catch (err) {
          console.warn('Contact picker cancelled or failed:', err);
        }
      } else {
        alert('Tu navegador no admite la selección directa de contactos. Puedes usar el botón "Cargar Archivo .VCF" para importar tu lista de contactos exportada.');
      }
    });
  }

  // Parse .VCF Contact File
  if (inputVcfFile) {
    inputVcfFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const vcardBlocks = text.split(/END:VCARD/i);
        let count = 0;

        vcardBlocks.forEach(block => {
          const nameMatch = block.match(/FN:(.*)/i) || block.match(/N:(.*)/i);
          const telMatch = block.match(/TEL.*:(.*)/i);
          if (nameMatch && telMatch) {
            let name = nameMatch[1].replace(/;/g, ' ').trim();
            let tel = telMatch[1].trim();
            if (name && tel) {
              brain.saveContact(name, tel);
              count++;
            }
          }
        });

        renderContactsUI();
        audioSynth.playSuccessChime();
        speechEngine.speak(`Se han importado ${count} contactos del archivo VCF a tu agenda, ${brain.userName}.`);
      };
      reader.readAsText(file);
    });
  }

  // Settings Modal Controls
  const openSettingsModal = (e) => {
    if (e && e.type === 'touchend') e.preventDefault();
    audioSynth.playClickSound();
    if (inputAssistantName) inputAssistantName.value = brain.assistantName;
    if (inputUserName) inputUserName.value = brain.userName;
    if (inputGeminiKey) inputGeminiKey.value = brain.geminiApiKey;
    if (selectLanguage) selectLanguage.value = speechEngine.language || 'es-ES';
    renderContactsUI();
    if (keyTestResult) {
      keyTestResult.textContent = brain.geminiApiKey
        ? '⚡ Clave Gemini configurada y activa.'
        : 'Si dejas el campo vacío, YARBIS utilizará el motor de IA Gratuito en vivo de forma automática.';
      keyTestResult.style.color = 'var(--color-text-dim)';
    }
    modalSettings.classList.add('active');
  };

  if (btnSettings) {
    btnSettings.addEventListener('click', openSettingsModal);
    btnSettings.addEventListener('touchend', openSettingsModal);
  }

  const closeSettingsModal = (e) => {
    if (e && e.type === 'touchend') e.preventDefault();
    audioSynth.playClickSound();
    modalSettings.classList.remove('active');
  };

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', closeSettingsModal);
    btnCloseSettings.addEventListener('touchend', closeSettingsModal);
  }

  function saveSettingsModal() {
    const newAssistantName = inputAssistantName ? inputAssistantName.value : 'YARBIS';
    const newUserName = inputUserName ? inputUserName.value : 'Señor';
    const apiKey = inputGeminiKey ? inputGeminiKey.value : '';
    const selectedLang = selectLanguage ? selectLanguage.value : 'es-ES';

    brain.setNames(newAssistantName, newUserName);
    brain.setApiKey(apiKey);
    speechEngine.setLanguage(selectedLang);

    updateBrandingUI();
    updateAiStatusBadge();
    renderNotes();

    if (modalSettings) modalSettings.classList.remove('active');
    audioSynth.playSuccessChime();
    speechEngine.speak(`Configuración actualizada correctamente, ${brain.userName}.`);
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', (e) => {
      if (e && e.type === 'touchend') e.preventDefault();
      saveSettingsModal();
    });
  }

  // Keyboard Shortcuts (Alt + M for Mic, Esc to close/clear)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      audioSynth.initContext();
      audioSynth.playClickSound();
      speechEngine.toggleListening();
    } else if (e.key === 'Escape') {
      if (modalSettings.classList.contains('active')) {
        modalSettings.classList.remove('active');
      } else {
        transcriptScroll.innerHTML = '';
      }
    }
  });

  // Mobile Tab Switcher Controller
  const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
  const voiceStage = document.querySelector('.voice-stage');
  const telemetryPanel = document.querySelector('.telemetry-panel');
  const terminalPanel = document.querySelector('.terminal-panel');

  function switchMobileTab(tabName) {
    mobileTabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (voiceStage) voiceStage.classList.remove('active-mobile-panel');
    if (telemetryPanel) telemetryPanel.classList.remove('active-mobile-panel');
    if (terminalPanel) terminalPanel.classList.remove('active-mobile-panel');

    if (tabName === 'voice' && voiceStage) {
      voiceStage.classList.add('active-mobile-panel');
    } else if (tabName === 'notes' && telemetryPanel) {
      telemetryPanel.classList.add('active-mobile-panel');
      renderNotes();
    } else if (tabName === 'chat' && terminalPanel) {
      terminalPanel.classList.add('active-mobile-panel');
      if (transcriptScroll) transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
    }
  }

  // Expose global methods for inline HTML onclick attributes
  window.openSettings = openSettingsModal;
  window.closeSettings = closeSettingsModal;
  window.saveSettings = saveSettingsModal;
  window.switchTab = switchMobileTab;
  window.toggleMic = async () => {
    audioSynth.initContext();
    audioSynth.playClickSound();
    speechEngine.primeSpeechSynthesis();
    await speechEngine.toggleListening();
  };
  window.toggleContinuous = () => {
    audioSynth.initContext();
    audioSynth.playClickSound();
    speechEngine.continuousMode = !speechEngine.continuousMode;
    if (btnContinuous) btnContinuous.classList.toggle('active', speechEngine.continuousMode);
    const msg = speechEngine.continuousMode ? 'Modo Manos Libres Activado' : 'Modo Manos Libres Desactivado';
    appendMessage(brain.assistantName, `🔄 ${msg}`);
    speechEngine.speak(msg);
    if (speechEngine.continuousMode && !speechEngine.isListening) {
      speechEngine.startListening();
    }
  // ==========================================
  // CAMERA VISION & MULTI-MODE SCANNER
  // ==========================================
  const modalCamera = document.getElementById('modalCamera');
  const videoCamera = document.getElementById('videoCamera');
  const canvasCameraSnapshot = document.getElementById('canvasCameraSnapshot');
  let cameraStream = null;
  let currentFacingMode = 'environment';
  let currentScanMode = 'general';
  let isFlashOn = false;

  async function startCameraStream() {
    if (!videoCamera) return;
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: currentFacingMode } },
        audio: false
      });
      videoCamera.srcObject = cameraStream;
      await videoCamera.play();
    } catch (err) {
      console.warn('Camera stream error:', err);
      alert('No se pudo acceder a la cámara. Por favor verifica los permisos en tu navegador.');
    }
  }

  async function openCameraModal() {
    audioSynth.playScanSound();
    if (modalCamera) modalCamera.classList.add('active');
    await startCameraStream();
  }

  function closeCameraModal() {
    audioSynth.playClickSound();
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    if (modalCamera) modalCamera.classList.remove('active');
  }

  window.setScanMode = (mode) => {
    currentScanMode = mode;
    audioSynth.playClickSound();
    document.querySelectorAll('.btn-camera-mode').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    const txtCapture = document.getElementById('txtCaptureBtn');
    if (txtCapture) {
      if (mode === 'document') txtCapture.textContent = '📄 Escanear Documento';
      else if (mode === 'translate') txtCapture.textContent = '🌐 Traducir Texto';
      else if (mode === 'qr') txtCapture.textContent = '📱 Leer Código QR';
      else txtCapture.textContent = '📸 Escanear con IA';
    }
  };

  window.toggleCameraFlash = async () => {
    audioSynth.playClickSound();
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        try {
          isFlashOn = !isFlashOn;
          await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
          const btnFlash = document.getElementById('btnToggleFlash');
          if (btnFlash) btnFlash.classList.toggle('active', isFlashOn);
        } catch (e) {
          console.warn('Torch constraint error:', e);
        }
      } else {
        alert('La linterna no está disponible en este dispositivo/navegador.');
      }
    }
  };

  window.handleGalleryUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    audioSynth.playClickSound();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Img = e.target.result;
      closeCameraModal();
      appendMessage('USER', '📂 [Imagen subida desde Galería]');
      appendMessage(brain.assistantName, '⚡ Analizando imagen con visión artificial Stark...', true);
      audioSynth.playScanSound();
      const visionAnalysis = await brain.analyzeImage(base64Img, currentScanMode);
      appendMessage(brain.assistantName, visionAnalysis, true);
      speechEngine.speak(visionAnalysis);
    };
    reader.readAsDataURL(file);
  };

  window.openCamera = openCameraModal;
  window.closeCamera = closeCameraModal;
  window.switchCamera = async () => {
    audioSynth.playClickSound();
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    await startCameraStream();
  };
  window.captureScan = async () => {
    audioSynth.playClickSound();
    if (!videoCamera || !canvasCameraSnapshot) return;
    canvasCameraSnapshot.width = videoCamera.videoWidth || 640;
    canvasCameraSnapshot.height = videoCamera.videoHeight || 480;
    const ctx = canvasCameraSnapshot.getContext('2d');
    ctx.drawImage(videoCamera, 0, 0, canvasCameraSnapshot.width, canvasCameraSnapshot.height);
    const base64Img = canvasCameraSnapshot.toDataURL('image/jpeg', 0.85);
    closeCameraModal();
    appendMessage('USER', `📸 [Foto enviada a Escáner (${currentScanMode.toUpperCase()})]`);
    appendMessage(brain.assistantName, '⚡ Analizando imagen con visión artificial Stark...', true);
    audioSynth.playScanSound();
    const visionAnalysis = await brain.analyzeImage(base64Img, currentScanMode);
    appendMessage(brain.assistantName, visionAnalysis, true);
    speechEngine.speak(visionAnalysis);

    if (currentScanMode === 'document' && visionAnalysis.length > 20) {
      appendMessage(brain.assistantName, `💡 Puedes copiar este texto o guardarlo tocando [📝 Notas]`, false);
    }
  };
  window.openInstallPwa = () => {
    audioSynth.playClickSound();
    if (modalInstallPwa) modalInstallPwa.classList.add('active');
  };
  window.closeInstallPwa = () => {
    audioSynth.playClickSound();
    if (modalInstallPwa) modalInstallPwa.classList.remove('active');
  };

  // Watermarks Cleaner Modal & Handlers
  function openWatermarkModal() {
    audioSynth.playScanSound();
    if (modalWatermarksCleaner) {
      modalWatermarksCleaner.classList.add('active');
      if (txtWatermarkInput) {
        txtWatermarkInput.focus();
        updateWatermarkLiveScan();
      }
    }
  }

  function closeWatermarkModal() {
    audioSynth.playClickSound();
    if (modalWatermarksCleaner) modalWatermarksCleaner.classList.remove('active');
  }

  function updateWatermarkLiveScan() {
    if (!txtWatermarkInput) return;
    const text = txtWatermarkInput.value || '';
    const zeroWidthRegex = /[\u200B-\u200D\u200E\u200F\uFEFF\u2060\u202A-\u202E\u2066-\u2069\u180E\u00AD]/g;
    const matches = text.match(zeroWidthRegex) || [];
    const count = matches.length;

    const aiPhrases = /\b(en conclusión|a modo de conclusión|en resumen|es crucial|cabe destacar|en el panorama actual|juega un papel fundamental|es importante tener en cuenta)\b/gi;
    const aiMatches = text.match(aiPhrases) || [];

    if (valZeroWidthTokens) valZeroWidthTokens.textContent = count;
    if (valAiPatterns) valAiPatterns.textContent = aiMatches.length;

    if (valPurityScore) {
      if (count === 0 && aiMatches.length === 0) {
        valPurityScore.textContent = '100% LIMPIO';
        valPurityScore.style.color = 'var(--color-success)';
      } else {
        const score = Math.max(0, 100 - (count * 10 + aiMatches.length * 15));
        valPurityScore.textContent = `${score}% RASTROS`;
        valPurityScore.style.color = score < 50 ? 'var(--color-danger)' : 'var(--color-accent)';
      }
    }

    if (watermarkStatusBadge) {
      if (count > 0 || aiMatches.length > 0) {
        watermarkStatusBadge.textContent = 'RASTROS DETECTADOS';
        watermarkStatusBadge.style.color = 'var(--color-danger)';
      } else {
        watermarkStatusBadge.textContent = 'LISTO';
        watermarkStatusBadge.style.color = 'var(--color-primary)';
      }
    }
  }

  if (txtWatermarkInput) {
    txtWatermarkInput.addEventListener('input', updateWatermarkLiveScan);
    txtWatermarkInput.addEventListener('paste', () => setTimeout(updateWatermarkLiveScan, 50));
  }

  function sanitizeWatermarkText() {
    if (!txtWatermarkInput || !txtWatermarkOutput) return;
    const raw = txtWatermarkInput.value;
    if (!raw.trim()) return;

    audioSynth.playSuccessChime();
    const result = brain.cleanAIWatermarks(raw, { humanize: false });
    txtWatermarkOutput.value = result.cleanedText;
    updateWatermarkLiveScan();

    if (watermarkStatusBadge) {
      watermarkStatusBadge.textContent = `SANITIZADO (-${result.zeroWidthCount} TOKENS)`;
      watermarkStatusBadge.style.color = 'var(--color-success)';
    }
  }

  function humanizeWatermarkText() {
    if (!txtWatermarkInput || !txtWatermarkOutput) return;
    const raw = txtWatermarkInput.value;
    if (!raw.trim()) return;

    audioSynth.playScanSound();
    const result = brain.cleanAIWatermarks(raw, { humanize: true });
    txtWatermarkOutput.value = result.cleanedText;
    updateWatermarkLiveScan();

    if (watermarkStatusBadge) {
      watermarkStatusBadge.textContent = `HUMANIZADO Y SANITIZADO`;
      watermarkStatusBadge.style.color = 'var(--color-success)';
    }
  }

  function copyCleanedWatermarkText() {
    if (!txtWatermarkOutput || !txtWatermarkOutput.value) return;
    navigator.clipboard.writeText(txtWatermarkOutput.value).then(() => {
      audioSynth.playSuccessChime();
      speechEngine.speak('Texto sanitizado copiado al portapapeles.');
      const copyBtn = document.getElementById('btnCopyCleanedText');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copiado';
        setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
      }
    }).catch(() => {
      txtWatermarkOutput.select();
      document.execCommand('copy');
      audioSynth.playSuccessChime();
    });
  }

  function saveCleanedAsNote() {
    if (!txtWatermarkOutput || !txtWatermarkOutput.value) return;
    audioSynth.playClickSound();
    addNote(txtWatermarkOutput.value.trim());
    speechEngine.speak('Texto sanitizado guardado en tus notas.');
    const noteBtn = document.getElementById('btnSaveCleanedAsNote');
    if (noteBtn) {
      const orig = noteBtn.textContent;
      noteBtn.textContent = '✓ Guardado';
      setTimeout(() => { noteBtn.textContent = orig; }, 2000);
    }
  }

  window.openWatermarkCleaner = openWatermarkModal;
  window.closeWatermarkCleaner = closeWatermarkModal;
  window.sanitizeWatermarkText = sanitizeWatermarkText;
  window.humanizeWatermarkText = humanizeWatermarkText;
  window.copyCleanedWatermarkText = copyCleanedWatermarkText;
  window.saveCleanedAsNote = saveCleanedAsNote;

  // ==========================================
  // CRYPTOCURRENCY & QUANTITATIVE FINANCE MODAL
  // ==========================================
  let cachedCryptoData = null;

  async function openCryptoFinanceModal() {
    audioSynth.playScanSound();
    if (modalCryptoFinance) {
      modalCryptoFinance.classList.add('active');
      await refreshCryptoPrices();
      calculateCryptoConversion();
      calcRoiUi();
    }
  }

  let cachedVenezuelaFX = null;
  let cachedFiatRates = null;

  function closeCryptoFinanceModal() {
    audioSynth.playClickSound();
    if (modalCryptoFinance) modalCryptoFinance.classList.remove('active');
  }

  async function refreshCryptoPrices() {
    const btnRefresh = document.getElementById('btnRefreshCrypto');
    if (btnRefresh) btnRefresh.textContent = '⏳ Cargando...';
    
    const [cryptoData, fxData, fiatData] = await Promise.all([
      brain.fetchLiveCryptoPrices(),
      brain.fetchLiveVenezuelaFX(),
      brain.fetchGlobalFiatRates()
    ]);

    if (cryptoData) cachedCryptoData = cryptoData;
    if (fxData) cachedVenezuelaFX = fxData;
    if (fiatData) cachedFiatRates = fiatData;

    // 1. Update Crypto Tickers Strip
    if (cachedCryptoData) {
      const symbols = ['BTC', 'ETH', 'SOL'];
      symbols.forEach(sym => {
        const item = cachedCryptoData[sym];
        const card = document.getElementById(`ticker${sym}`);
        if (card && item) {
          const sign = item.change24h >= 0 ? '+' : '';
          const cls = item.change24h >= 0 ? 'positive' : 'negative';
          const fmtPrice = item.price >= 1 ? '$' + item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + item.price.toFixed(4);
          
          const priceEl = card.querySelector('.ticker-price');
          const changeEl = card.querySelector('.ticker-change');
          if (priceEl) priceEl.textContent = fmtPrice;
          if (changeEl) {
            changeEl.textContent = `${sign}${item.change24h.toFixed(2)}%`;
            changeEl.className = `ticker-change ${cls}`;
          }
        }
      });
    }

    // 2. Update Venezuela FX Tickers
    if (cachedVenezuelaFX) {
      const tickerBcv = document.getElementById('tickerBCV');
      const tickerUsdt = document.getElementById('tickerUSDT');
      const cardBcv = document.getElementById('cardBcvRate');
      const cardParallel = document.getElementById('cardParallelRate');
      const cardSpread = document.getElementById('cardSpreadRate');
      const cardEur = document.getElementById('cardEurRate');

      if (tickerBcv) {
        const p = tickerBcv.querySelector('.ticker-price');
        if (p) p.textContent = `Bs. ${cachedVenezuelaFX.usdOfficialBCV.toFixed(2)}`;
      }
      if (tickerUsdt) {
        const p = tickerUsdt.querySelector('.ticker-price');
        const c = tickerUsdt.querySelector('.ticker-change');
        if (p) p.textContent = `Bs. ${cachedVenezuelaFX.usdMarketParallel.toFixed(2)}`;
        if (c) c.textContent = `+${cachedVenezuelaFX.spreadPercent.toFixed(1)}% spread`;
      }
      if (cardBcv) cardBcv.textContent = `Bs. ${cachedVenezuelaFX.usdOfficialBCV.toFixed(2)}`;
      if (cardParallel) cardParallel.textContent = `Bs. ${cachedVenezuelaFX.usdMarketParallel.toFixed(2)}`;
      if (cardSpread) cardSpread.textContent = `+${cachedVenezuelaFX.spreadPercent.toFixed(1)}% Brecha`;
      if (cardEur) cardEur.textContent = `Bs. ${cachedVenezuelaFX.eurOfficialBCV.toFixed(2)}`;
    }

    calculateCryptoConversion();

    if (btnRefresh) btnRefresh.textContent = '🔄 Actualizar';
  }

  function swapCurrencies() {
    audioSynth.playClickSound();
    const selFrom = document.getElementById('selectFromCurrency');
    const selTo = document.getElementById('selectToCurrency');
    if (selFrom && selTo) {
      const temp = selFrom.value;
      selFrom.value = selTo.value;
      selTo.value = temp;
      calculateCryptoConversion();
    }
  }

  function calculateCryptoConversion() {
    const inputAmount = document.getElementById('inputCryptoAmount');
    const selFrom = document.getElementById('selectFromCurrency');
    const selTo = document.getElementById('selectToCurrency');
    const lblResult = document.getElementById('lblConversionResult');
    const lblRate = document.getElementById('lblConversionRate');

    if (!inputAmount || !selFrom || !selTo || !lblResult) return;

    const amount = parseFloat(inputAmount.value) || 0;
    const fromCode = selFrom.value;
    const toCode = selTo.value;

    const fx = cachedVenezuelaFX || (brain.getFXSampleRates ? brain.getFXSampleRates() : { usdOfficialBCV: 62.40, usdMarketParallel: 75.10, eurOfficialBCV: 67.85 });
    const fiat = cachedFiatRates || (brain.fetchGlobalFiatRates ? { EUR: 0.92, COP: 4120, BRL: 5.65, MXN: 19.80, PEN: 3.75, CLP: 940, ARS: 1040, GBP: 0.79, JPY: 154.5, CAD: 1.38, CNY: 7.24, RUB: 98.5 } : {});
    const crypto = cachedCryptoData || { BTC: { price: 95000 }, ETH: { price: 3400 }, SOL: { price: 190 }, BNB: { price: 650 }, XRP: { price: 1.45 } };

    const converted = brain.convertUniversalCurrency(amount, fromCode, toCode, fx, crypto, fiat);

    // Format display
    let formattedResult = '';
    if (toCode.startsWith('VES')) {
      formattedResult = `Bs. ${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (toCode === 'USD' || toCode === 'USDT' || toCode === 'USDC') {
      formattedResult = `$${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCode}`;
    } else if (toCode === 'EUR') {
      formattedResult = `€${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
    } else if (toCode === 'COP' || toCode === 'ARS' || toCode === 'CLP' || toCode === 'JPY') {
      formattedResult = `${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${toCode}`;
    } else if (crypto && crypto[toCode]) {
      formattedResult = `${converted < 0.0001 ? converted.toFixed(8) : converted.toFixed(4)} ${toCode}`;
    } else {
      formattedResult = `${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCode}`;
    }

    lblResult.textContent = formattedResult;

    // Unit rate label
    const unitRate = brain.convertUniversalCurrency(1, fromCode, toCode, fx, crypto, fiat);
    if (lblRate) {
      lblRate.textContent = `1 ${fromCode.replace('_', ' ')} ≈ ${unitRate < 0.0001 ? unitRate.toFixed(6) : unitRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toCode.replace('_', ' ')}`;
    }
  }

  function calcDcaUi() {
    const p1 = parseFloat(document.getElementById('inputDcaP1')?.value) || 0;
    const a1 = parseFloat(document.getElementById('inputDcaA1')?.value) || 0;
    const p2 = parseFloat(document.getElementById('inputDcaP2')?.value) || 0;
    const a2 = parseFloat(document.getElementById('inputDcaA2')?.value) || 0;

    const res = brain.calculateDCA([
      { amount: a1, price: p1 },
      { amount: a2, price: p2 }
    ]);

    const lblAvg = document.getElementById('lblDcaAvg');
    const lblTot = document.getElementById('lblDcaTotal');

    if (res) {
      if (lblAvg) lblAvg.textContent = `$${res.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      if (lblTot) lblTot.textContent = `$${res.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    }
  }

  function generateWebhookJson() {
    audioSynth.playClickSound();
    const payload = brain.generateStructuredDataRequest('BVC_CRYPTO_FEED', ['BTC', 'ETH', 'MVZ.A', 'RST', 'USD_BCV', 'USD_P2P']);
    const jsonStr = JSON.stringify(payload, null, 2);
    
    const boxOutput = document.getElementById('boxMathOutput');
    const lblOutput = document.getElementById('lblMathOutput');

    if (boxOutput) boxOutput.style.display = 'block';
    if (lblOutput) lblOutput.textContent = `// Payload JSON para Webhook / Automatización:\n${jsonStr}`;
    
    navigator.clipboard.writeText(jsonStr).then(() => {
      speechEngine.speak('Estructura JSON generada y copiada al portapapeles.');
    });
  }

  function calcRoiUi() {
    const inInitial = document.getElementById('inputRoiInitial');
    const inBuy = document.getElementById('inputRoiBuy');
    const inSell = document.getElementById('inputRoiSell');
    const lblPercent = document.getElementById('lblRoiPercent');
    const lblProfit = document.getElementById('lblRoiNetProfit');

    if (!inInitial || !inBuy || !inSell || !lblPercent || !lblProfit) return;

    const initial = parseFloat(inInitial.value) || 0;
    const buy = parseFloat(inBuy.value) || 0;
    const sell = parseFloat(inSell.value) || 0;

    const res = brain.calculateCryptoROI(initial, buy, sell);
    if (res) {
      const sign = res.roiPercent >= 0 ? '+' : '';
      lblPercent.textContent = `${sign}${res.roiPercent.toFixed(2)}%`;
      lblPercent.style.color = res.roiPercent >= 0 ? 'var(--color-success)' : '#ff3366';

      const profitSign = res.netProfit >= 0 ? '+$' : '-$';
      lblProfit.textContent = `${profitSign}${Math.abs(res.netProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      lblProfit.style.color = res.netProfit >= 0 ? '#fff' : '#ff3366';
    }
  }

  async function solveMathProblem() {
    const txt = document.getElementById('txtMathQuery');
    const btn = document.getElementById('btnSolveMath');
    const boxOutput = document.getElementById('boxMathOutput');
    const lblOutput = document.getElementById('lblMathOutput');

    if (!txt || !txt.value.trim()) return;

    audioSynth.playScanSound();
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⚡ Auditando y Calculando...';
    }

    if (boxOutput) boxOutput.style.display = 'block';
    if (lblOutput) lblOutput.textContent = 'Procesando modelo bursátil/matemático con precisión Stark...';

    try {
      const answer = await brain.queryFreeAI(txt.value.trim());
      if (lblOutput) lblOutput.textContent = answer;
      audioSynth.playSuccessChime();
      speechEngine.speak(`Análisis financiero y auditoría completados, ${brain.userName}.`);
    } catch (e) {
      if (lblOutput) lblOutput.textContent = `Error al procesar el análisis: ${e.message}`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Auditar y Resolver con Precisión Stark';
      }
    }
  }

  window.openCryptoFinance = openCryptoFinanceModal;
  window.closeCryptoFinance = closeCryptoFinanceModal;
  window.refreshCryptoPrices = refreshCryptoPrices;
  window.switchCryptoTab = switchCryptoTab;
  window.calculateCryptoConversion = calculateCryptoConversion;
  window.swapCurrencies = swapCurrencies;
  window.calcRoiUi = calcRoiUi;
  window.calcDcaUi = calcDcaUi;
  window.generateWebhookJson = generateWebhookJson;
  window.solveMathProblem = solveMathProblem;

  window.addNoteFromInput = () => {
    if (inputNewNote && inputNewNote.value.trim()) {
      audioSynth.playClickSound();
      addNote(inputNewNote.value.trim());
      inputNewNote.value = '';
    }
  };
  window.clearAllNotes = clearAllNotes;
  window.clearLogs = () => {
    audioSynth.playClickSound();
    if (transcriptScroll) transcriptScroll.innerHTML = '';
  };
  window.submitTextInput = submitTextInput;
  window.cancelTimer = cancelTimer;

  // Set default active tab on mobile
  switchMobileTab('voice');

  mobileTabBtns.forEach(btn => {
    const handleTabClick = (e) => {
      if (e && e.type === 'touchend') e.preventDefault();
      audioSynth.playClickSound();
      switchMobileTab(btn.getAttribute('data-tab'));
    };
    btn.addEventListener('click', handleTabClick);
    btn.addEventListener('touchend', handleTabClick);
  });

  // Device Torch / Flashlight Controller
  let torchTrack = null;
  async function toggleTorch(turnOn) {
    try {
      if (turnOn) {
        if (!torchTrack) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          torchTrack = stream.getVideoTracks()[0];
        }
        if (torchTrack && torchTrack.applyConstraints) {
          await torchTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
        }
      } else {
        if (torchTrack) {
          torchTrack.stop();
          torchTrack = null;
        }
      }
    } catch (e) {
      console.warn('Torch not supported or permission denied:', e);
    }
  }

  // App Pills Quick Launcher (appPills queried above)
  const appLinksMap = {
    'whatsapp': { url: 'https://web.whatsapp.com', deep: 'whatsapp://' },
    'youtube': { url: 'https://www.youtube.com', deep: 'youtube://' },
    'spotify': { url: 'https://open.spotify.com', deep: 'spotify://' },
    'bdv': { url: 'https://bdvenlinea.banvenez.com/' },
    'banesco': { url: 'https://www.banesconline.com/' },
    'pedidosya': { url: 'https://www.pedidosya.com.ve/', deep: 'pedidosya://' },
    'yummy': { url: 'https://www.yummy.com.ve/', deep: 'yummy://' },
    'mercadolibre': { url: 'https://www.mercadolibre.com.ve/', deep: 'mercadolibre://' },
    'gmail': { url: 'https://mail.google.com', deep: 'googlegmail://' },
    'maps': { url: 'https://maps.google.com', deep: 'comgooglemaps://' },
    'chatgpt': { url: 'https://chatgpt.com', deep: 'chatgpt://' },
    'drive': { url: 'https://drive.google.com', deep: 'googledrive://' }
  };

  appPills.forEach(pill => {
    pill.addEventListener('click', () => {
      audioSynth.playClickSound();
      const appKey = pill.getAttribute('data-launch');
      const target = appLinksMap[appKey];
      if (target) {
        launchApp(target.url, target.deep);
      }
    });
  });

  // Camera Vision Controller
  const btnCamera = document.getElementById('btnCamera');
  const modalCamera = document.getElementById('modalCamera');
  const btnCloseCamera = document.getElementById('btnCloseCamera');
  const btnSwitchCamera = document.getElementById('btnSwitchCamera');
  const btnCaptureScan = document.getElementById('btnCaptureScan');
  const videoCamera = document.getElementById('videoCamera');
  const canvasCameraSnapshot = document.getElementById('canvasCameraSnapshot');

  let cameraStream = null;
  let currentFacingMode = 'environment';

  async function openCameraModal() {
    if (!modalCamera) return;
    modalCamera.classList.add('active');
    audioSynth.playScanSound();
    await startCameraStream();
  }

  function closeCameraModal() {
    if (!modalCamera) return;
    modalCamera.classList.remove('active');
    stopCameraStream();
  }

  async function startCameraStream() {
    try {
      stopCameraStream();
      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoCamera) {
        videoCamera.srcObject = cameraStream;
        await videoCamera.play();
      }
    } catch (e) {
      console.warn('Camera stream error:', e);
      appendMessage(brain.assistantName, 'No pude acceder a la cámara. Por favor autoriza el permiso en tu navegador.', true);
    }
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    if (videoCamera) videoCamera.srcObject = null;
  }

  if (btnCamera) btnCamera.addEventListener('click', openCameraModal);
  if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCameraModal);
  if (btnSwitchCamera) {
    btnSwitchCamera.addEventListener('click', async () => {
      audioSynth.playClickSound();
      currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      await startCameraStream();
    });
  }

  if (btnCaptureScan) {
    btnCaptureScan.addEventListener('click', async () => {
      audioSynth.playClickSound();
      if (!videoCamera || !canvasCameraSnapshot) return;

      canvasCameraSnapshot.width = videoCamera.videoWidth || 640;
      canvasCameraSnapshot.height = videoCamera.videoHeight || 480;
      const ctx = canvasCameraSnapshot.getContext('2d');
      ctx.drawImage(videoCamera, 0, 0, canvasCameraSnapshot.width, canvasCameraSnapshot.height);

      const base64Img = canvasCameraSnapshot.toDataURL('image/jpeg', 0.85);
      closeCameraModal();

      appendMessage('USER', '📸 [Foto enviada a Escáner]');
      appendMessage(brain.assistantName, '⚡ Analizando imagen con visión artificial Stark...', true);
      audioSynth.playScanSound();

      const visionAnalysis = await brain.analyzeImage(base64Img);
      appendMessage(brain.assistantName, visionAnalysis, true);
      speechEngine.speak(visionAnalysis);
    });
  }

  // Alarms Scheduler Controller
  let activeAlarms = JSON.parse(localStorage.getItem('yarbis_alarms') || '[]');
  const alarmsContainer = document.getElementById('alarmsContainer');
  const alarmsList = document.getElementById('alarmsList');

  function saveAlarms() {
    localStorage.setItem('yarbis_alarms', JSON.stringify(activeAlarms));
    renderAlarms();
  }

  function addAlarm(alarmData) {
    activeAlarms.push({
      id: Date.now(),
      timeStr: alarmData.timeStr,
      timestamp: alarmData.timestamp,
      note: alarmData.note || 'Alarma YARBIS'
    });
    saveAlarms();
  }

  function removeAlarm(id) {
    activeAlarms = activeAlarms.filter(a => a.id !== id);
    saveAlarms();
  }

  function renderAlarms() {
    if (!alarmsContainer || !alarmsList) return;
    if (activeAlarms.length === 0) {
      alarmsContainer.style.display = 'none';
      alarmsList.innerHTML = '';
      return;
    }
    alarmsContainer.style.display = 'block';
    alarmsList.innerHTML = activeAlarms.map(a => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(var(--color-primary-rgb),0.15); border:1px solid var(--hud-glass-border); padding:6px 10px; border-radius:8px; font-size:0.75rem;">
        <span>⏰ <strong>${a.timeStr}</strong> — ${a.note}</span>
        <button onclick="window.removeAlarm(${a.id})" style="background:transparent; border:none; color:var(--color-danger); cursor:pointer; font-size:0.8rem;">✕</button>
      </div>
    `).join('');
  }

  window.removeAlarm = removeAlarm;
  renderAlarms();

  // Check alarms interval
  setInterval(() => {
    const now = Date.now();
    const triggered = activeAlarms.filter(a => now >= a.timestamp);
    if (triggered.length > 0) {
      triggered.forEach(a => {
        audioSynth.playSuccessChime();
        const alarmMsg = `⏰ ¡Alarma activa! Son las ${a.timeStr}: ${a.note}, ${brain.userName}.`;
        appendMessage(brain.assistantName, alarmMsg, true);
        speechEngine.speak(alarmMsg);
        removeAlarm(a.id);
      });
    }
  }, 5000);

  // Voice Pitch and Rate Modulators
  const sliderVoicePitch = document.getElementById('sliderVoicePitch');
  const valVoicePitch = document.getElementById('valVoicePitch');
  const sliderVoiceRate = document.getElementById('sliderVoiceRate');
  const valVoiceRate = document.getElementById('valVoiceRate');

  if (sliderVoicePitch && valVoicePitch) {
    sliderVoicePitch.value = speechEngine.pitch;
    valVoicePitch.textContent = speechEngine.pitch;
    sliderVoicePitch.addEventListener('input', (e) => {
      speechEngine.setPitch(e.target.value);
      valVoicePitch.textContent = e.target.value;
    });
  }

  if (sliderVoiceRate && valVoiceRate) {
    sliderVoiceRate.value = speechEngine.rate;
    valVoiceRate.textContent = speechEngine.rate + 'x';
    sliderVoiceRate.addEventListener('input', (e) => {
      speechEngine.setRate(e.target.value);
      valVoiceRate.textContent = e.target.value + 'x';
    });
  }

  // PWA Install Modal Controller
  const btnInstallPwa = document.getElementById('btnInstallPwa');

  if (btnInstallPwa && modalInstallPwa) {
    btnInstallPwa.addEventListener('click', () => {
      audioSynth.playClickSound();
      modalInstallPwa.classList.add('active');
    });
  }
  if (btnCloseInstallPwa && modalInstallPwa) {
    btnCloseInstallPwa.addEventListener('click', () => {
      audioSynth.playClickSound();
      modalInstallPwa.classList.remove('active');
    });
  }

  // Initial Load Render
  renderNotes();

  // Startup Greeting
  setTimeout(() => {
    audioSynth.playStartupSound();
    const greet = brain.getVenezuelanGreeting();
    appendMessage(brain.assistantName, greet, true);
  }, 800);
}

// Guarantee execution on all browsers and mobile WebKit
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initYarbisApp);
} else {
  initYarbisApp();
}
