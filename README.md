# YARBIS · Asistente personal

Asistente por voz en el navegador, hecho para Venezuela. Es una página estática
(HTML + CSS + JavaScript, sin compilación) que se publica gratis en **GitHub Pages**.

## Qué hace

- **Voz y chat con IA**: toca el micrófono o escribe. La IA recuerda la conversación,
  conoce tus pendientes, alarmas y gastos, y responde en tiempo real (el texto aparece
  mientras se escribe). Puedes encadenar órdenes: *"pon un timer de 5 minutos y anota comprar pan"*.
- **Inicio "Hoy"**: tasa del dólar con mini‑gráfico, clima, próximos avisos, pendientes,
  gastos del mes y accesos rápidos.
- **Dólar y finanzas**: tasa BCV, paralelo y euro en vivo, **historial con gráfico**
  (7/30/90 días), **alertas** ("avísame cuando el dólar pase de 250"), convertidor,
  calculadoras (DCA, interés, préstamo, devaluación, spread) y **lista de precios para
  tu negocio** en $ y Bs. lista para WhatsApp.
- **Gastos y presupuesto**: registra gastos por voz en $ o Bs., resumen del mes por
  categoría, presupuesto con avisos y exportación a CSV.
- **Notas, listas, temporizadores y alarmas**: listas (Personal, Compras, Trabajo y las
  tuyas), **alarmas repetitivas** (diario, lunes a viernes, días específicos), todo se
  guarda en el teléfono y sobrevive a recargas.
- **Pago Móvil**: guarda tus datos, compártelos con un toque y genera un QR para cobrar.
- **Traductor de voz y dictado**: habla y escucha la traducción en el otro idioma;
  dicta textos largos con puntuación por voz.
- **Cámara**: lector QR sin internet, y análisis de fotos, documentos o traducción con IA.
- **Compartir y atajos**: desde otra app, *Compartir → YARBIS*; y atajos al mantener
  presionado el ícono (Dólar, Nota, Compras, QR, Gasto, Dictado).
- **Más**: clima, llamadas y WhatsApp a tus contactos, rutas, música, purificador de texto,
  modo claro/oscuro y 7 colores.

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
| `js/charts.js` | Gráficos SVG (líneas, mini‑gráficos y barras) |
| `js/expenses.js` | Gastos y presupuesto |
| `js/pagomovil.js` | Datos de Pago Móvil, compartir y QR |
| `js/voicetools.js` | Traductor de voz y dictado |
| `js/home.js` | Panel "Hoy" del inicio |
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
