# Poker Tracker-os

PWA local para llevar estadísticas de poker en salas sin trackers (WPT Global).
Lee con OCR, **dentro de tu móvil**, las capturas de "My stats" y las manos descargadas, y te muestra resultados por día, bb/100, ¥/h y el EV de tus all-ins. Ningún dato sale de tu teléfono.

## Instalar en Android
1. Abre la URL de la app en **Chrome**.
2. Menú ⋮ → **Instalar app** (o "Añadir a pantalla de inicio").
3. La primera vez que subas una captura, la app descarga el lector (≈ 3 MB). Hazlo con internet; después funciona sin conexión.

## Uso
- **+ (Subir):** elige una o varias capturas de la galería. También puedes, desde la galería, tocar **Compartir → Poker Tracker-os**.
  - *My stats* → se lee resultado, manos y duración. Revisa la fecha y la hora (sale del archivo) y toca **Guardar**.
  - *Mano descargada* → se leen tus cartas, posición, tablero, resultado y, si fuiste all-in, tu equity y el bote. Los campos en **amarillo** son los que el lector no pudo confirmar: revísalos.
  - Si la app no reconoce el valor de una carta, elígelo con el selector. La app **aprende** esa carta para la próxima vez.
- **Días:** tabla por día de juego (de 06:00 a 06:00, configurable) con tramos, manos, tiempo, resultado, ¥/h, bb/100, all-ins y "real − EV". Toca un día para ver el detalle.
- **Gráficas:** resultado acumulado y all-ins real vs EV.
- **Manos:** tu biblioteca de manos para estudiar, con etiquetas y notas.
- **Ajustes:** tu nombre en la mesa (**RacsoSM**), stakes, hora de corte y **copia de seguridad**.

## Copia de seguridad (importante)
Tus datos viven solo en el navegador del móvil. Exporta una copia cada semana desde **Ajustes → Exportar copia** y guárdala en Drive. La app te lo recuerda.

## Qué calcula
- **bb/100** = (resultado / BB) / manos × 100, con BB = ¥2 (el straddle no cuenta como BB).
- **EV de all-in** = equity × bote disputado − lo que pusiste. **Real − EV** es tu suerte en esos all-ins.
- El resultado del día sale solo de las capturas "My stats". Las manos subidas solo suman al EV.

## Desarrollo
```bash
npm install
npm run dev        # servidor local
npm test           # tests rápidos
npm run test:ocr   # tests con OCR real (lentos)
npm run build      # build de producción en dist/
```
Regenerar datos derivados de los fixtures: `npx tsx scripts/make-seed-templates.ts` y `npx tsx scripts/dump-ocr.ts`.

## Publicar (Netlify, gratis)
1. Entra en https://app.netlify.com → **Add new site → Import an existing project → GitHub** y elige `RacsoSM/Poker-Tracker-OS`.
2. Netlify lee `netlify.toml` (build `npm run build`, carpeta `dist`). Pulsa **Deploy**.
3. Abre en el móvil la URL `https://<tu-sitio>.netlify.app` e instala la app.
