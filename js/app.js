/* ==========================================================================
   YARBIS - MAIN APPLICATION CONTROLLER 3.0
   Personal Assistant: STT/TTS, Arc Reactor Canvas, Notes, Timers & Settings
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Subsystems
  const audioSynth = window.audioSynth;
  const arcReactor = new window.ArcReactorEngine('arcReactorCanvas', 'waveformCanvas', 'bgParticlesCanvas');
  const speechEngine = new window.YARBISSpeechEngine();
  const brain = new window.YARBISBrain();

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
  const notesScroll = document.getElementById('notesScroll');
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
    stateValue.textContent = `"${interimText.substring(0, 22)}..."`;
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
    } else if (response.action === 'OPEN_URL' && response.url) {
      window.open(response.url, '_blank');
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
    }

    // Append Assistant Response
    appendMessage(brain.assistantName, response.textResponse, true);

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
     WEB APP QUICK LAUNCHER BINDINGS
     ========================================== */
  const webAppUrls = {
    whatsapp: { name: 'WhatsApp Web', url: 'https://web.whatsapp.com' },
    youtube: { name: 'YouTube', url: 'https://www.youtube.com' },
    spotify: { name: 'Spotify', url: 'https://open.spotify.com' },
    gmail: { name: 'Gmail', url: 'https://mail.google.com' },
    maps: { name: 'Google Maps', url: 'https://maps.google.com' },
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com' },
    drive: { name: 'Google Drive', url: 'https://drive.google.com' }
  };

  appPills.forEach(pill => {
    pill.addEventListener('click', () => {
      audioSynth.playClickSound();
      const appKey = pill.getAttribute('data-launch');
      const appInfo = webAppUrls[appKey];
      if (appInfo) {
        window.open(appInfo.url, '_blank');
        const msg = `Abriendo ${appInfo.name}, ${brain.userName}.`;
        appendMessage(brain.assistantName, msg);
        speechEngine.speak(msg);
      }
    });
  });

  /* ==========================================
     GENERAL EVENT LISTENERS & SHORTCUTS
     ========================================== */

  // Mic Button Click
  btnMic.addEventListener('click', () => {
    audioSynth.initContext();
    audioSynth.playClickSound();
    speechEngine.toggleListening();
  });

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

  btnSend.addEventListener('click', submitTextInput);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTextInput();
  });

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
  btnMute.addEventListener('click', () => {
    isMuted = !isMuted;
    audioSynth.setMuted(isMuted);
    audioSynth.playClickSound();
    btnMute.innerHTML = isMuted ? '🔇' : '🔊';
  });

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

  // Settings Modal Controls
  btnSettings.addEventListener('click', () => {
    audioSynth.playClickSound();
    if (inputAssistantName) inputAssistantName.value = brain.assistantName;
    if (inputUserName) inputUserName.value = brain.userName;
    if (inputGeminiKey) inputGeminiKey.value = brain.geminiApiKey;
    if (selectLanguage) selectLanguage.value = speechEngine.language || 'es-ES';
    if (keyTestResult) {
      keyTestResult.textContent = brain.geminiApiKey
        ? '⚡ Clave Gemini configurada y activa.'
        : 'Si dejas el campo vacío, YARBIS utilizará el motor de IA Gratuito en vivo de forma automática.';
      keyTestResult.style.color = 'var(--color-text-dim)';
    }
    modalSettings.classList.add('active');
  });

  btnCloseSettings.addEventListener('click', () => {
    audioSynth.playClickSound();
    modalSettings.classList.remove('active');
  });

  btnSaveSettings.addEventListener('click', () => {
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

    modalSettings.classList.remove('active');
    audioSynth.playSuccessChime();
    speechEngine.speak(`Configuración actualizada correctamente, ${brain.userName}.`);
  });

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
    } else if (tabName === 'chat' && terminalPanel) {
      terminalPanel.classList.add('active-mobile-panel');
    }
  }

  // Set default active tab on mobile
  switchMobileTab('voice');

  mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      audioSynth.playClickSound();
      switchMobileTab(btn.getAttribute('data-tab'));
    });
  });

  // Initial Load Render
  renderNotes();

  // Startup Greeting
  setTimeout(() => {
    audioSynth.playStartupSound();
    appendMessage(brain.assistantName, `Sistemas de ${brain.assistantName} en línea. Asistente personal listo para servirle, ${brain.userName}.`, true);
  }, 800);
});
