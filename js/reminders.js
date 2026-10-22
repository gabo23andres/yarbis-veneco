/* ==========================================================================
   YARBIS - NOTAS, TEMPORIZADORES Y ALARMAS
   Los datos viven en localStorage. Los temporizadores guardan su hora de fin
   (no un contador), así no se desfasan en segundo plano y sobreviven a una
   recarga. La parte de interfaz sólo se monta si existe el DOM.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;

  class Emitter {
    constructor() { this.listeners = new Set(); }
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(payload) { this.listeners.forEach(fn => { try { fn(payload); } catch (e) { console.warn(e); } }); }
  }

  /* ==========================================
     NOTAS
     ========================================== */
  class NotesStore extends Emitter {
    constructor() {
      super();
      this.items = this.load();
    }

    load() {
      const list = S.get('yarbis_notes', null);
      if (Array.isArray(list)) return list;
      // Migración desde v10 (yarbis_notes_list)
      const old = S.get('yarbis_notes_list', []);
      const migrated = (Array.isArray(old) ? old : []).map(n => ({
        id: String(n.id || U.uid()),
        text: String(n.text || ''),
        done: !!n.completed,
        createdAt: typeof n.id === 'number' && n.id > 1e12 ? n.id : Date.now(),
        updatedAt: Date.now()
      })).filter(n => n.text);
      S.set('yarbis_notes', migrated);
      S.remove('yarbis_notes_list');
      return migrated;
    }

    save() {
      S.set('yarbis_notes', this.items);
      this.emit(this.items);
    }

    add(text) {
      const clean = String(text || '').trim();
      if (!clean) return null;
      const note = { id: U.uid(), text: clean, done: false, createdAt: Date.now(), updatedAt: Date.now() };
      this.items.unshift(note);
      this.save();
      return note;
    }

    update(id, text) {
      const note = this.items.find(n => n.id === id);
      const clean = String(text || '').trim();
      if (!note || !clean) return null;
      note.text = clean;
      note.updatedAt = Date.now();
      this.save();
      return note;
    }

    toggle(id, value) {
      const note = this.items.find(n => n.id === id);
      if (!note) return null;
      note.done = value === undefined ? !note.done : !!value;
      note.updatedAt = Date.now();
      this.save();
      return note;
    }

    remove(id) {
      const before = this.items.length;
      this.items = this.items.filter(n => n.id !== id);
      if (this.items.length !== before) this.save();
    }

    clearDone() {
      this.items = this.items.filter(n => !n.done);
      this.save();
    }

    clearAll() {
      this.items = [];
      this.save();
    }

    pending() {
      return this.items.filter(n => !n.done);
    }

    // Busca la nota que mejor coincide con una frase ("la de comprar pan")
    findByQuery(query) {
      const q = U.normalize(query).replace(/^(la|el|las|los)\s+(nota\s+)?(de|del|que dice|sobre)?\s*/, '').trim();
      if (!q) return null;
      const words = q.split(' ').filter(w => w.length > 2);
      let best = null;
      let bestScore = 0;
      this.items.forEach(n => {
        const t = U.normalize(n.text);
        let score = t.includes(q) ? 100 : 0;
        words.forEach(w => { if (t.includes(w)) score += 10; });
        if (score > bestScore) { bestScore = score; best = n; }
      });
      return bestScore > 0 ? best : null;
    }
  }

  /* ==========================================
     TEMPORIZADORES Y ALARMAS
     ========================================== */
  class ScheduleStore extends Emitter {
    constructor() {
      super();
      this.timers = S.get('yarbis_timers', []);
      if (!Array.isArray(this.timers)) this.timers = [];
      this.alarms = S.get('yarbis_alarms_v2', null);
      if (!Array.isArray(this.alarms)) {
        const old = S.get('yarbis_alarms', []);
        this.alarms = (Array.isArray(old) ? old : []).map(a => ({
          id: String(a.id || U.uid()),
          at: Number(a.timestamp) || 0,
          label: a.note || 'Alarma'
        })).filter(a => a.at);
        S.remove('yarbis_alarms');
        this.saveAlarms(false);
      }
      this.onRing = null; // ({ kind, item }) => {}
      this.tickTimer = null;
    }

    saveTimers(emit = true) {
      S.set('yarbis_timers', this.timers);
      if (emit) this.emit({ type: 'timers' });
    }

    saveAlarms(emit = true) {
      this.alarms.sort((a, b) => a.at - b.at);
      S.set('yarbis_alarms_v2', this.alarms);
      if (emit) this.emit({ type: 'alarms' });
    }

    addTimer(seconds, label) {
      const sec = Math.round(Number(seconds));
      if (!sec || sec <= 0) return null;
      const timer = {
        id: U.uid(),
        label: String(label || '').trim() || `Temporizador de ${U.describeDuration(sec)}`,
        durationMs: sec * 1000,
        endAt: Date.now() + sec * 1000,
        pausedRemaining: null
      };
      this.timers.push(timer);
      this.saveTimers();
      this.ensureTicking();
      return timer;
    }

    remaining(timer) {
      if (timer.pausedRemaining !== null && timer.pausedRemaining !== undefined) return timer.pausedRemaining;
      return Math.max(0, timer.endAt - Date.now());
    }

    pauseTimer(id) {
      const t = this.timers.find(x => x.id === id);
      if (!t || t.pausedRemaining !== null) return;
      t.pausedRemaining = Math.max(0, t.endAt - Date.now());
      this.saveTimers();
    }

    resumeTimer(id) {
      const t = this.timers.find(x => x.id === id);
      if (!t || t.pausedRemaining === null) return;
      t.endAt = Date.now() + t.pausedRemaining;
      t.pausedRemaining = null;
      this.saveTimers();
      this.ensureTicking();
    }

    cancelTimer(id) {
      this.timers = this.timers.filter(x => x.id !== id);
      this.saveTimers();
    }

    cancelAllTimers() {
      const n = this.timers.length;
      this.timers = [];
      this.saveTimers();
      return n;
    }

    addAlarm(at, label) {
      const ts = Number(at);
      if (!ts) return null;
      const alarm = { id: U.uid(), at: ts, label: String(label || '').trim() || 'Alarma' };
      this.alarms.push(alarm);
      this.saveAlarms();
      this.ensureTicking();
      return alarm;
    }

    removeAlarm(id) {
      this.alarms = this.alarms.filter(a => a.id !== id);
      this.saveAlarms();
    }

    // "HH:MM" -> próxima ocurrencia (hoy o mañana)
    static nextOccurrence(hours, minutes) {
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
      return target.getTime();
    }

    stopTicking() {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    ensureTicking() {
      if (this.tickTimer) return;
      this.tickTimer = setInterval(() => this.tick(), 1000);
      this.tick();
    }

    tick() {
      const now = Date.now();
      const dueTimers = this.timers.filter(t => t.pausedRemaining === null && t.endAt <= now);
      const dueAlarms = this.alarms.filter(a => a.at <= now);
      if (dueTimers.length) {
        this.timers = this.timers.filter(t => !dueTimers.includes(t));
        this.saveTimers();
      }
      if (dueAlarms.length) {
        this.alarms = this.alarms.filter(a => !dueAlarms.includes(a));
        this.saveAlarms();
      }
      dueTimers.forEach(item => this.onRing && this.onRing({ kind: 'timer', item }));
      dueAlarms.forEach(item => this.onRing && this.onRing({ kind: 'alarm', item, late: now - item.at > 120000 }));
      this.emit({ type: 'tick' });

      const active = this.timers.some(t => t.pausedRemaining === null) || this.alarms.length;
      if (!active && this.tickTimer) {
        clearInterval(this.tickTimer);
        this.tickTimer = null;
      }
    }
  }

  /* ==========================================
     NOTIFICACIONES DEL SISTEMA
     ========================================== */
  async function requestNotificationPermission() {
    if (!('Notification' in root)) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch (e) {
      return 'denied';
    }
  }

  async function notify(title, body) {
    if (!('Notification' in root) || Notification.permission !== 'granted') return;
    const options = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'yarbis-ring', renotify: true, requireInteraction: true, vibrate: [300, 120, 300] };
    try {
      const reg = root.navigator.serviceWorker && await root.navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
      new Notification(title, options);
    } catch (e) { /* ignorar */ }
  }

  /* ==========================================
     INTERFAZ (pestaña Notas)
     ========================================== */
  class RemindersUI {
    constructor(notes, schedule) {
      this.notes = notes;
      this.schedule = schedule;
      this.filter = 'all';
      this.search = '';
      this.editingId = null;
      this.timerNodes = new Map();
    }

    mount() {
      const $ = U.$;
      this.notesList = $('#notesList');
      this.notesCount = $('#notesCount');
      this.timersList = $('#timersList');
      this.alarmsList = $('#alarmsList');
      if (!this.notesList) return;

      const formNote = $('#formNote');
      if (formNote) {
        formNote.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = $('#inputNewNote');
          if (this.notes.add(input.value)) {
            input.value = '';
            if (root.audioSynth) root.audioSynth.playClickSound();
          }
        });
      }

      const search = $('#notesSearch');
      if (search) search.addEventListener('input', () => { this.search = U.normalize(search.value); this.renderNotes(); });

      U.$$('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.filter = btn.dataset.filter;
          U.$$('[data-filter]').forEach(b => {
            const active = b.dataset.filter === this.filter;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          this.renderNotes();
        });
      });

      const formTimer = $('#formTimer');
      if (formTimer) {
        formTimer.addEventListener('submit', (e) => {
          e.preventDefault();
          const min = parseFloat(String($('#timerMinutes').value).replace(',', '.'));
          if (!(min > 0)) { U.toast('Escribe cuántos minutos.', { type: 'warn' }); return; }
          this.schedule.addTimer(min * 60, $('#timerLabel').value);
          requestNotificationPermission();
          $('#timerMinutes').value = '';
          $('#timerLabel').value = '';
        });
      }

      const formAlarm = $('#formAlarm');
      if (formAlarm) {
        formAlarm.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = $('#alarmTime').value;
          const m = String(val).match(/^(\d{1,2}):(\d{2})/);
          if (!m) { U.toast('Elige una hora para la alarma.', { type: 'warn' }); return; }
          const at = ScheduleStore.nextOccurrence(Number(m[1]), Number(m[2]));
          this.schedule.addAlarm(at, $('#alarmLabel').value);
          requestNotificationPermission();
          $('#alarmLabel').value = '';
          U.toast(`Alarma para las ${U.fmtTime(at)}${new Date(at).getDate() !== new Date().getDate() ? ' (mañana)' : ''}.`, { type: 'ok' });
        });
      }

      this.notes.onChange(() => this.renderNotes());
      this.schedule.onChange((evt) => {
        if (evt && evt.type === 'tick') this.updateTimerProgress();
        else this.renderSchedule();
      });

      this.renderNotes();
      this.renderSchedule();
      this.schedule.ensureTicking();
    }

    renderNotes() {
      if (!this.notesList) return;
      const el = U.el;
      const pendingCount = this.notes.pending().length;
      if (this.notesCount) this.notesCount.textContent = `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`;

      let items = this.notes.items;
      if (this.filter === 'pending') items = items.filter(n => !n.done);
      if (this.filter === 'done') items = items.filter(n => n.done);
      if (this.search) items = items.filter(n => U.normalize(n.text).includes(this.search));

      this.notesList.replaceChildren();
      if (!items.length) {
        const msg = this.search ? 'Ninguna nota coincide con la búsqueda.'
          : this.filter === 'done' ? 'Todavía no has completado notas.'
          : this.filter === 'pending' ? '¡Nada pendiente! 🎉'
          : 'Sin notas. Escribe una arriba o dime "anota comprar pan".';
        this.notesList.appendChild(el('li', { class: 'empty-state', text: msg }));
        return;
      }

      items.forEach(note => {
        const li = el('li', { class: `note-item${note.done ? ' done' : ''}` });
        const check = el('button', {
          type: 'button',
          class: 'note-check',
          'aria-label': note.done ? 'Marcar como pendiente' : 'Marcar como hecha',
          'aria-pressed': note.done ? 'true' : 'false',
          onClick: () => this.notes.toggle(note.id)
        });
        li.appendChild(check);

        if (this.editingId === note.id) {
          const input = el('input', { type: 'text', class: 'note-edit-input', value: note.text, 'aria-label': 'Editar nota' });
          const save = () => {
            this.editingId = null;
            if (input.value.trim()) this.notes.update(note.id, input.value);
            else this.renderNotes();
          };
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { e.stopPropagation(); this.editingId = null; this.renderNotes(); }
          });
          li.appendChild(el('div', { class: 'note-body' }, input));
          li.appendChild(el('button', { type: 'button', class: 'icon-btn small', 'aria-label': 'Guardar', title: 'Guardar', onClick: save }, U.icon('check')));
          this.notesList.appendChild(li);
          setTimeout(() => input.focus(), 0);
          return;
        }

        const body = el('div', { class: 'note-body' },
          el('span', { class: 'note-text', text: note.text }),
          el('span', { class: 'note-meta', text: U.fmtDateTime(note.createdAt) }));
        body.addEventListener('dblclick', () => { this.editingId = note.id; this.renderNotes(); });
        li.appendChild(body);
        li.appendChild(el('button', {
          type: 'button', class: 'icon-btn small', 'aria-label': 'Editar nota', title: 'Editar',
          onClick: () => { this.editingId = note.id; this.renderNotes(); }
        }, U.icon('edit')));
        li.appendChild(el('button', {
          type: 'button', class: 'icon-btn small danger', 'aria-label': 'Borrar nota', title: 'Borrar',
          onClick: () => {
            const copy = { ...note };
            this.notes.remove(note.id);
            U.toast('Nota borrada', {
              actionLabel: 'Deshacer',
              onAction: () => { this.notes.items.unshift(copy); this.notes.save(); }
            });
          }
        }, U.icon('trash')));
        this.notesList.appendChild(li);
      });
    }

    renderSchedule() {
      const el = U.el;
      if (this.timersList) {
        this.timersList.replaceChildren();
        this.timerNodes.clear();
        if (!this.schedule.timers.length) {
          this.timersList.appendChild(el('li', { class: 'empty-state small', text: 'Sin temporizadores activos.' }));
        }
        this.schedule.timers.forEach(t => {
          const paused = t.pausedRemaining !== null;
          const time = el('span', { class: 'timer-time', text: U.fmtDuration(this.schedule.remaining(t) / 1000) });
          const bar = el('div', { class: 'progress-fill' });
          const li = el('li', { class: `timer-item${paused ? ' paused' : ''}` },
            el('div', { class: 'timer-row' },
              el('div', { class: 'timer-info' }, time, el('span', { class: 'timer-label', text: t.label })),
              el('div', { class: 'timer-actions' },
                el('button', {
                  type: 'button', class: 'icon-btn small', 'aria-label': paused ? 'Reanudar' : 'Pausar', title: paused ? 'Reanudar' : 'Pausar',
                  onClick: () => paused ? this.schedule.resumeTimer(t.id) : this.schedule.pauseTimer(t.id)
                }, U.icon(paused ? 'play' : 'pause')),
                el('button', {
                  type: 'button', class: 'icon-btn small danger', 'aria-label': 'Cancelar temporizador', title: 'Cancelar',
                  onClick: () => this.schedule.cancelTimer(t.id)
                }, U.icon('x')))),
            el('div', { class: 'progress' }, bar));
          this.timerNodes.set(t.id, { time, bar });
          this.timersList.appendChild(li);
        });
        this.updateTimerProgress();
      }

      if (this.alarmsList) {
        this.alarmsList.replaceChildren();
        if (!this.schedule.alarms.length) {
          this.alarmsList.appendChild(el('li', { class: 'empty-state small', text: 'Sin alarmas programadas.' }));
        }
        this.schedule.alarms.forEach(a => {
          const d = new Date(a.at);
          const isTomorrow = d.toDateString() !== new Date().toDateString();
          this.alarmsList.appendChild(el('li', { class: 'alarm-item' },
            el('span', { class: 'alarm-time', text: U.fmtTime(a.at) }),
            el('div', { class: 'alarm-info' },
              el('span', { class: 'alarm-label', text: a.label }),
              el('span', { class: 'note-meta', text: isTomorrow ? d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric' }) : 'Hoy' })),
            el('button', {
              type: 'button', class: 'icon-btn small danger', 'aria-label': 'Borrar alarma', title: 'Borrar',
              onClick: () => this.schedule.removeAlarm(a.id)
            }, U.icon('x'))));
        });
      }
    }

    updateTimerProgress() {
      this.schedule.timers.forEach(t => {
        const nodes = this.timerNodes.get(t.id);
        if (!nodes) return;
        const rem = this.schedule.remaining(t);
        nodes.time.textContent = U.fmtDuration(rem / 1000);
        nodes.bar.style.width = `${Math.max(0, Math.min(100, (rem / t.durationMs) * 100))}%`;
      });
    }
  }

  const notes = new NotesStore();
  const schedule = new ScheduleStore();

  root.YarbisReminders = {
    notes,
    schedule,
    ScheduleStore,
    ui: null,
    requestNotificationPermission,
    notify,
    mountUI() {
      if (!this.ui) {
        this.ui = new RemindersUI(notes, schedule);
        this.ui.mount();
      }
      return this.ui;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
