/* ==========================================================================
   YARBIS - NOTAS, LISTAS, TEMPORIZADORES Y ALARMAS
   Los datos viven en localStorage. Los temporizadores guardan su hora de fin
   (no un contador), así no se desfasan en segundo plano y sobreviven a una
   recarga. Las alarmas pueden repetirse (diario, lunes a viernes, etc.).
   La parte de interfaz sólo se monta si existe el DOM.
   ========================================================================== */

(function (root) {
  'use strict';

  const U = root.YarbisUtils;
  const S = U.storage;

  const DEFAULT_LISTS = ['Personal', 'Compras', 'Trabajo'];
  const SHOPPING = 'Compras';
  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  class Emitter {
    constructor() { this.listeners = new Set(); }
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(payload) { this.listeners.forEach(fn => { try { fn(payload); } catch (e) { console.warn(e); } }); }
  }

  /* ==========================================
     NOTAS Y LISTAS
     ========================================== */
  class NotesStore extends Emitter {
    constructor() {
      super();
      this.items = this.load();
      this.customLists = S.get('yarbis_note_lists', []);
      if (!Array.isArray(this.customLists)) this.customLists = [];
    }

    load() {
      let list = S.get('yarbis_notes', null);
      if (!Array.isArray(list)) {
        // Migración desde v10 (yarbis_notes_list)
        const old = S.get('yarbis_notes_list', []);
        list = (Array.isArray(old) ? old : []).map(n => ({
          id: String(n.id || U.uid()),
          text: String(n.text || ''),
          done: !!n.completed,
          createdAt: typeof n.id === 'number' && n.id > 1e12 ? n.id : Date.now(),
          updatedAt: Date.now()
        })).filter(n => n.text);
        S.remove('yarbis_notes_list');
      }
      // Migración desde v11: las notas sin lista van a "Personal"
      let changed = false;
      list.forEach(n => {
        if (!n.list) { n.list = 'Personal'; changed = true; }
      });
      if (changed || !S.get('yarbis_notes', null)) S.set('yarbis_notes', list);
      return list;
    }

    save() {
      S.set('yarbis_notes', this.items);
      this.emit(this.items);
    }

    lists() {
      const set = [...DEFAULT_LISTS];
      [...this.customLists, ...this.items.map(n => n.list)].forEach(l => {
        if (l && !set.some(x => U.normalize(x) === U.normalize(l))) set.push(l);
      });
      return set;
    }

    // "compras", "lista del mercado", "super" -> "Compras"
    resolveList(name) {
      const n = U.normalize(name || '').replace(/^(la\s+)?lista\s+(de\s+|del\s+)?/, '').trim();
      if (!n) return 'Personal';
      if (/^(compras?|mercado|super(mercado)?|abasto|bodega|mandado)$/.test(n)) return SHOPPING;
      const found = this.lists().find(l => U.normalize(l) === n);
      return found || U.capitalize(n);
    }

    addList(name) {
      const clean = String(name || '').trim().slice(0, 24);
      if (!clean) return null;
      const resolved = this.resolveList(clean);
      if (!this.lists().includes(resolved)) {
        this.customLists.push(resolved);
        S.set('yarbis_note_lists', this.customLists);
        this.emit(this.items);
      }
      return resolved;
    }

    add(text, list = 'Personal') {
      const clean = String(text || '').trim();
      if (!clean) return null;
      const target = list ? this.resolveList(list) : 'Personal';
      const note = { id: U.uid(), text: clean, done: false, list: target, createdAt: Date.now(), updatedAt: Date.now() };
      this.items.unshift(note);
      this.save();
      return note;
    }

    addMany(texts, list) {
      const added = [];
      const target = this.resolveList(list);
      texts.map(t => String(t || '').trim()).filter(Boolean).forEach(t => {
        // No duplicar un ítem pendiente que ya está en la lista
        const exists = this.items.find(n => !n.done && n.list === target && U.normalize(n.text) === U.normalize(t));
        if (exists) return;
        added.push({ id: U.uid(), text: U.capitalize(t), done: false, list: target, createdAt: Date.now(), updatedAt: Date.now() });
      });
      if (added.length) {
        this.items.unshift(...added);
        this.save();
      }
      return added;
    }

    inList(list) {
      const target = this.resolveList(list);
      return this.items.filter(n => n.list === target);
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

    clearDone(list) {
      const target = list ? this.resolveList(list) : null;
      this.items = this.items.filter(n => !n.done || (target && n.list !== target));
      this.save();
    }

    clearList(list) {
      const target = this.resolveList(list);
      const n = this.items.filter(x => x.list === target).length;
      this.items = this.items.filter(x => x.list !== target);
      this.save();
      return n;
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
        if (!n.done) score += 1;
        if (score > bestScore) { bestScore = score; best = n; }
      });
      return bestScore > 1 ? best : null;
    }
  }

  /* ==========================================
     REPETICIÓN DE ALARMAS
     ========================================== */
  function repeatDays(repeat) {
    if (repeat === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    if (repeat === 'weekdays') return [1, 2, 3, 4, 5];
    if (repeat === 'weekends') return [0, 6];
    if (Array.isArray(repeat) && repeat.length) return repeat.map(Number).filter(d => d >= 0 && d <= 6);
    return null;
  }

  function repeatLabel(repeat) {
    if (!repeat || repeat === 'none') return '';
    if (repeat === 'daily') return 'Todos los días';
    if (repeat === 'weekdays') return 'Lunes a viernes';
    if (repeat === 'weekends') return 'Fines de semana';
    const days = repeatDays(repeat);
    return days ? days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DAY_NAMES[d]).join(', ') : '';
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
      this.onRing = null; // ({ kind, item, late }) => {}
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

    addAlarm(at, label, repeat = 'none') {
      const ts = Number(at);
      if (!ts) return null;
      const d = new Date(ts);
      const alarm = {
        id: U.uid(),
        at: ts,
        label: String(label || '').trim() || 'Alarma',
        repeat: repeatDays(repeat) ? repeat : 'none',
        h: d.getHours(),
        m: d.getMinutes()
      };
      // Si la primera hora no cae en un día válido, mover a la siguiente ocurrencia
      if (alarm.repeat !== 'none') alarm.at = ScheduleStore.nextOccurrence(alarm.h, alarm.m, alarm.repeat, ts - 1);
      this.alarms.push(alarm);
      this.saveAlarms();
      this.ensureTicking();
      return alarm;
    }

    removeAlarm(id) {
      this.alarms = this.alarms.filter(a => a.id !== id);
      this.saveAlarms();
    }

    // Próxima ocurrencia de HH:MM después de `from`, respetando los días de repetición
    static nextOccurrence(hours, minutes, repeat = 'none', from = Date.now()) {
      const days = repeatDays(repeat);
      const base = new Date(from);
      for (let add = 0; add <= 8; add++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + add, hours, minutes, 0, 0);
        if (d.getTime() <= from) continue;
        if (!days || days.includes(d.getDay())) return d.getTime();
      }
      return from + 86400000;
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
      const rings = [];
      if (dueAlarms.length) {
        dueAlarms.forEach(a => {
          rings.push({ ...a, late: now - a.at > 120000 });
          if (a.repeat && a.repeat !== 'none') {
            const h = a.h !== undefined ? a.h : new Date(a.at).getHours();
            const m = a.m !== undefined ? a.m : new Date(a.at).getMinutes();
            a.at = ScheduleStore.nextOccurrence(h, m, a.repeat, now);
          }
        });
        this.alarms = this.alarms.filter(a => !dueAlarms.includes(a) || (a.repeat && a.repeat !== 'none'));
        this.saveAlarms();
      }
      dueTimers.forEach(item => this.onRing && this.onRing({ kind: 'timer', item }));
      rings.forEach(item => this.onRing && this.onRing({ kind: 'alarm', item, late: item.late }));
      this.emit({ type: 'tick' });

      const active = this.timers.some(t => t.pausedRemaining === null) || this.alarms.length;
      if (!active && this.tickTimer) {
        clearInterval(this.tickTimer);
        this.tickTimer = null;
      }
    }

    upcoming(limit = 3) {
      const items = [
        ...this.timers.filter(t => t.pausedRemaining === null).map(t => ({ kind: 'timer', at: t.endAt, label: t.label })),
        ...this.alarms.map(a => ({ kind: 'alarm', at: a.at, label: a.label, repeat: a.repeat }))
      ];
      return items.sort((a, b) => a.at - b.at).slice(0, limit);
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

  async function notify(title, body, tag = 'yarbis-ring') {
    if (!('Notification' in root) || Notification.permission !== 'granted') return;
    const options = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag, renotify: true, requireInteraction: tag === 'yarbis-ring', vibrate: [300, 120, 300] };
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
      this.list = S.getRaw('yarbis_notes_list_sel', 'all');
    }

    mount() {
      const $ = U.$;
      this.notesList = $('#notesList');
      this.notesCount = $('#notesCount');
      this.timersList = $('#timersList');
      this.alarmsList = $('#alarmsList');
      this.listChips = $('#listChips');
      if (!this.notesList) return;

      const formNote = $('#formNote');
      if (formNote) {
        formNote.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = $('#inputNewNote');
          const target = this.list === 'all' ? 'Personal' : this.list;
          // En la lista de compras se pueden agregar varios ítems separados por coma
          const parts = target === SHOPPING ? input.value.split(/\s*,\s*/) : [input.value];
          const added = parts.length > 1 ? this.notes.addMany(parts, target) : [this.notes.add(input.value, target)].filter(Boolean);
          if (added.length) {
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
          const repeatSel = $('#alarmRepeat') ? $('#alarmRepeat').value : 'none';
          const at = ScheduleStore.nextOccurrence(Number(m[1]), Number(m[2]), repeatSel);
          const alarm = this.schedule.addAlarm(at, $('#alarmLabel').value, repeatSel);
          requestNotificationPermission();
          $('#alarmLabel').value = '';
          const when = new Date(alarm.at);
          const rep = repeatLabel(alarm.repeat);
          U.toast(`Alarma para las ${U.fmtTime(alarm.at)}${rep ? ` · ${rep}` : when.toDateString() !== new Date().toDateString() ? ' (mañana)' : ''}.`, { type: 'ok' });
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

    setList(list) {
      this.list = list;
      S.setRaw('yarbis_notes_list_sel', list);
      this.renderNotes();
    }

    renderListChips() {
      if (!this.listChips) return;
      const el = U.el;
      const lists = this.notes.lists();
      if (this.list !== 'all' && !lists.includes(this.list)) this.list = 'all';
      const count = (l) => this.notes.items.filter(n => !n.done && (l === 'all' || n.list === l)).length;
      const chip = (value, label) => {
        const c = count(value);
        return el('button', {
          type: 'button',
          class: `list-chip${this.list === value ? ' active' : ''}`,
          'aria-pressed': this.list === value ? 'true' : 'false',
          onClick: () => this.setList(value)
        }, label, c ? el('span', { class: 'list-chip-count', text: String(c) }) : null);
      };
      this.listChips.replaceChildren(
        chip('all', 'Todas'),
        ...lists.map(l => chip(l, `${l === SHOPPING ? '🛒 ' : l === 'Trabajo' ? '💼 ' : l === 'Personal' ? '🙂 ' : ''}${l}`)),
        el('button', {
          type: 'button', class: 'list-chip add', title: 'Nueva lista', 'aria-label': 'Nueva lista',
          onClick: () => {
            const name = root.prompt('Nombre de la nueva lista:');
            const created = name && this.notes.addList(name);
            if (created) this.setList(created);
          }
        }, U.icon('plus')));
      const input = U.$('#inputNewNote');
      if (input) {
        input.placeholder = this.list === SHOPPING ? 'Agrega productos (separa con comas)…'
          : this.list === 'all' ? 'Nueva nota o recordatorio…' : `Nueva nota en ${this.list}…`;
      }
    }

    renderNotes() {
      if (!this.notesList) return;
      const el = U.el;
      this.renderListChips();
      const pendingCount = this.notes.pending().length;
      if (this.notesCount) this.notesCount.textContent = `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`;

      let items = this.notes.items;
      if (this.list !== 'all') items = items.filter(n => n.list === this.list);
      if (this.filter === 'pending') items = items.filter(n => !n.done);
      if (this.filter === 'done') items = items.filter(n => n.done);
      if (this.search) items = items.filter(n => U.normalize(n.text).includes(this.search));
      this.notesList.classList.toggle('shopping', this.list === SHOPPING);

      this.notesList.replaceChildren();
      if (!items.length) {
        const msg = this.search ? 'Ninguna nota coincide con la búsqueda.'
          : this.filter === 'done' ? 'Todavía no has completado notas.'
          : this.filter === 'pending' ? '¡Nada pendiente! 🎉'
          : this.list === SHOPPING ? 'La lista de compras está vacía. Dime "agrega leche y huevos a la lista de compras".'
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
          onClick: () => {
            li.classList.add('checking');
            setTimeout(() => this.notes.toggle(note.id), 180);
          }
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

        const meta = this.list === 'all' && note.list !== 'Personal'
          ? `${note.list} · ${U.fmtDateTime(note.createdAt)}`
          : U.fmtDateTime(note.createdAt);
        const body = el('div', { class: 'note-body' },
          el('span', { class: 'note-text', text: note.text }),
          el('span', { class: 'note-meta', text: meta }));
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
            li.classList.add('leaving');
            setTimeout(() => {
              this.notes.remove(note.id);
              U.toast('Nota borrada', {
                actionLabel: 'Deshacer',
                onAction: () => { this.notes.items.unshift(copy); this.notes.save(); }
              });
            }, 160);
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
          const isToday = d.toDateString() === new Date().toDateString();
          const rep = repeatLabel(a.repeat);
          const when = isToday ? 'Hoy' : d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric' });
          this.alarmsList.appendChild(el('li', { class: 'alarm-item' },
            el('span', { class: 'alarm-time', text: U.fmtTime(a.at) }),
            el('div', { class: 'alarm-info' },
              el('span', { class: 'alarm-label', text: a.label }),
              el('span', { class: 'note-meta' }, rep ? el('span', { class: 'repeat-badge', text: `🔁 ${rep}` }) : null, rep ? ` · próxima: ${when}` : when)),
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
    SHOPPING,
    repeatLabel,
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
