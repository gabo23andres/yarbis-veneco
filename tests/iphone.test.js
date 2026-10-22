'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./setup.js');

const { brain, win } = loadApp();
const R = win.YarbisReminders;
const A = win.YarbisApps;

test.after(() => R.schedule.stopTicking());

test('iPhone: esquemas de apps con respaldo web', () => {
  assert.strictEqual(A.iosScheme('https://wa.me/584141234567?text=ya%20voy'), 'whatsapp://send?phone=584141234567&text=ya%20voy');
  assert.strictEqual(A.iosScheme('https://wa.me/?text=hola'), 'whatsapp://send?text=hola');
  assert.strictEqual(A.iosScheme('https://open.spotify.com/search/salsa'), 'spotify:search:salsa');
  assert.strictEqual(A.iosScheme('https://www.youtube.com/results?search_query=gaita'), 'youtube://results?search_query=gaita');
  assert.strictEqual(A.iosScheme('https://www.google.com/maps/search/farmacias/@10.5,-66.9,15z'), 'maps://?q=farmacias&sll=10.5,-66.9');
  assert.strictEqual(A.iosScheme('https://www.google.com/maps/dir/?api=1&destination=Sambil'), 'maps://?daddr=Sambil');
  assert.strictEqual(A.iosScheme('https://waze.com/ul?q=farmacia'), 'waze://?q=farmacia');
  assert.strictEqual(A.iosScheme('https://www.instagram.com/yarbis'), 'instagram://user?username=yarbis');
  // Sin app conocida, o no es una página de mapas: se queda en la web
  assert.strictEqual(A.iosScheme('https://www.bcv.org.ve/'), null);
  assert.strictEqual(A.iosScheme('https://www.google.com/search?q=hola'), null);
  assert.strictEqual(A.iosScheme('tel:04141234567'), null);
});

test('SMS con el formato de cada teléfono', () => {
  assert.strictEqual(A.smsUrl('0414 123-4567', 'ya llegué', 'ios'), 'sms:04141234567&body=ya%20llegu%C3%A9');
  assert.strictEqual(A.smsUrl('0414 123-4567', 'ya llegué', 'android'), 'sms:04141234567?body=ya%20llegu%C3%A9');
  assert.strictEqual(A.smsUrl('0414 123-4567', '', 'ios'), 'sms:04141234567');
});

test('calendario: alarma a la hora exacta y repeticiones', () => {
  const start = Date.UTC(2030, 0, 7, 10, 30); // lunes
  const once = R.buildIcs({ title: 'Gym; temprano', start, alarmMinutes: 0, uid: 'x', now: start });
  assert.match(once, /^BEGIN:VCALENDAR\r\n/);
  assert.match(once, /DTSTART:20300107T103000Z\r\nDTEND:20300107T104500Z/);
  assert.match(once, /SUMMARY:Gym\\; temprano/);
  assert.match(once, /BEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY/);
  assert.doesNotMatch(once, /RRULE/);

  assert.match(R.buildIcs({ title: 'a', start, repeat: 'daily' }), /RRULE:FREQ=DAILY\r\n/);
  assert.match(R.buildIcs({ title: 'a', start, repeat: 'weekdays' }), /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\n/);
  assert.match(R.buildIcs({ title: 'a', start, repeat: 'weekends' }), /RRULE:FREQ=WEEKLY;BYDAY=SU,SA\r\n/);
  assert.match(R.buildIcs({ title: 'a', start, repeat: [3, 1] }), /RRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\n/);
  assert.match(R.buildIcs({ title: 'a', start, alarmMinutes: 30 }), /TRIGGER:-PT30M/);
  assert.match(R.buildIcs({ title: 'a', start, allDay: true }), /DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}/);
});

test('las alarmas ofrecen guardarse en el calendario del teléfono', async () => {
  const r = await brain.process('alarma de lunes a viernes a las 6:30 para el gym');
  const act = r.actions.find(a => a.command === 'phone-alarm');
  assert.ok(act, JSON.stringify(r.actions));
  assert.strictEqual(act.value.repeat, 'weekdays');
  assert.strictEqual(new Date(act.value.at).getHours(), 6);
  assert.strictEqual(new Date(act.value.at).getMinutes(), 30);
});

test('voz a texto con Gemini (cuando el navegador no reconoce voz)', async () => {
  brain.setApiKey('AIzaSyPRUEBA_PRUEBA_PRUEBA_PRUEBA_123');
  brain.geminiModel = 'gemini-2.5-flash';
  assert.strictEqual(brain.canTranscribe(), true);
  let sent = null;
  const realFetch = win.fetch;
  win.fetch = async (url, opts) => {
    sent = { url: String(url), body: JSON.parse(opts.body) };
    const text = sent.body.contents[0].parts[1].inline_data.data === Buffer.from('audio-falso').toString('base64') ? '"¿A cómo está el dólar?"' : '[vacío]';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  };
  try {
    const text = await brain.transcribeAudio(new Blob(['audio-falso'], { type: 'audio/mp4' }), 'es-VE');
    assert.strictEqual(text, '¿A cómo está el dólar?');
    assert.match(sent.url, /gemini-2\.5-flash:generateContent$/);
    assert.strictEqual(sent.body.contents[0].parts[1].inline_data.mime_type, 'audio/mp4');
    assert.match(sent.body.contents[0].parts[0].text, /español/);
    assert.strictEqual(await brain.transcribeAudio(new Blob(['ruido'], { type: 'audio/webm' })), '');
  } finally {
    win.fetch = realFetch;
    brain.setApiKey('');
  }
});

test('voz a texto con Whisper (Groq) si no hay Gemini', async () => {
  const P = win.YarbisAIProviders;
  P.save({ provider: 'groq', key: 'gsk_prueba', model: 'llama-3.3-70b-versatile' });
  assert.strictEqual(brain.canTranscribe(), true);
  const realFetch = win.fetch;
  let req = null;
  win.fetch = async (url, opts) => {
    req = { url: String(url), opts };
    return new Response(JSON.stringify({ text: ' pon una alarma a las seis ' }), { status: 200 });
  };
  try {
    assert.strictEqual(await brain.transcribeAudio(new Blob(['x'], { type: 'audio/webm' }), 'es-ES'), 'pon una alarma a las seis');
    assert.strictEqual(req.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.strictEqual(req.opts.headers.Authorization, 'Bearer gsk_prueba');
    assert.strictEqual(req.opts.body.get('model'), 'whisper-large-v3');
    assert.strictEqual(req.opts.body.get('language'), 'es');
  } finally {
    win.fetch = realFetch;
    P.clear();
  }
  assert.strictEqual(brain.canTranscribe(), false);
});

test('elige la mejor voz en español', () => {
  require('../js/speechEngine.js');
  const rank = win.YARBISSpeechEngine.rankVoices;
  const voices = [
    { name: 'Eddy (Español (España))', lang: 'es-ES' },
    { name: 'Mónica', lang: 'es-ES' },
    { name: 'Paulina (Mejorada)', lang: 'es-MX' },
    { name: 'Bad News', lang: 'es-ES' }
  ];
  assert.strictEqual(rank(voices, 'es-ES')[0].name, 'Paulina (Mejorada)');
  assert.strictEqual(rank(voices, 'es-ES').at(-1).name, 'Bad News');
});
