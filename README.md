# YARBIS · Asistente personal

Asistente por voz en el navegador, hecho para Venezuela. Es una página estática
(HTML + CSS + JavaScript, sin compilación) que se publica gratis en **GitHub Pages**.

## Qué hace

- **Voz y chat con IA**: toca el micrófono o escribe. La IA recuerda la conversación.
  Funciona sin clave (IA gratuita) o con tu clave gratis de
  [Google AI Studio](https://aistudio.google.com/app/apikey) para respuestas y visión más estables.
- **Dólar y finanzas**: tasa BCV, paralelo y euro en vivo (DolarApi), criptomonedas,
  convertidor, y calculadoras de DCA, interés compuesto, préstamo, devaluación y spread.
  Cada tasa dice si está en vivo, guardada o sin conexión.
- **Notas, temporizadores y alarmas**: se guardan en el teléfono, sobreviven a recargas,
  suenan con vibración y pueden avisar con notificación.
- **Cámara**: lector QR sin internet, y análisis de fotos, documentos o traducción con IA.
- **Más**: clima, llamadas y WhatsApp a tus contactos, rutas en Maps/Waze, música,
  purificador de texto, modo claro/oscuro y 7 colores.

Ejemplos de lo que puedes decir: *"¿A cómo está el dólar?"*, *"100 dólares a bolívares"*,
*"5000 bs a dólares a tasa paralela"*, *"temporizador de 10 minutos"*,
*"alarma a las 6:30 de la mañana"*, *"anota comprar harina PAN"*, *"llama a mamá"*,
*"manda un WhatsApp a Carlos que diga ya voy"*, *"¿va a llover mañana en Maracaibo?"*.

## Probar en tu computadora

**Windows (lo más fácil):** descarga o clona el repositorio y dale doble clic a
`iniciar.bat`. Se abre el navegador en <http://localhost:8000>.
No cierres la ventana negra mientras uses la app.

**Con comandos (Windows, Mac o Linux):**

```bash
git clone https://github.com/gabo23andres/yarbis-veneco.git
cd yarbis-veneco
py -m http.server 8000        # Windows (o: python -m http.server 8000)
python3 -m http.server 8000   # Mac / Linux
npm start                     # si tienes Node.js
```

Abre <http://localhost:8000>. Para hablarle por voz usa **Chrome** o **Edge**
(Brave y Firefox no traen reconocimiento de voz). En `localhost` el micrófono y la
cámara funcionan igual que en internet.

## Pruebas

```bash
npm test                       # calculadora y comandos (Node 18+)
npm install                    # una sola vez, instala Playwright
npx playwright install chromium
npm run test:e2e               # prueba completa en navegador (móvil y escritorio)
```

## Publicar en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment**.
2. *Source*: **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Cada vez que subas cambios a `main`, la página se actualiza en
   `https://gabo23andres.github.io/yarbis-veneco/` (puede tardar 1–2 minutos).

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `styles.css` | Interfaz (4 pestañas: Asistente, Notas, Finanzas, Más) |
| `js/app.js` | Controlador principal: navegación, chat, voz y acciones |
| `js/yarbisBrain.js` | Entiende los comandos y habla con la IA |
| `js/speechEngine.js` | Reconocimiento y síntesis de voz |
| `js/finance.js`, `js/financeView.js` | Tasas en vivo y pestaña Finanzas |
| `js/reminders.js` | Notas, temporizadores y alarmas |
| `js/camera.js` | Cámara, lector QR y visión |
| `js/mathEngine.js` | Calculadora segura (sin `eval`) y fórmulas financieras |
| `js/settings.js` | Ajustes, tema, agenda y copias de seguridad |
| `sw.js`, `manifest.json`, `icons/` | App instalable y uso sin conexión |

Tus datos (notas, contactos, clave de IA) se guardan sólo en tu dispositivo.

## Limitaciones conocidas

- El reconocimiento de voz funciona en Chrome y Safari, no en Firefox.
- En iPhone, las alarmas sólo suenan con la app abierta; instálala en la pantalla de inicio.
- Las APIs gratuitas de IA y tasas pueden fallar; la app reintenta, usa servicios de
  respaldo (IA: Pollinations y LLM7; clima: Open-Meteo y wttr.in) y, si todo falla, lo avisa
  en vez de inventar datos.
- La clave de Google AI Studio puede empezar por `AIza…` (formato clásico) o `AQ.…` (formato nuevo).
