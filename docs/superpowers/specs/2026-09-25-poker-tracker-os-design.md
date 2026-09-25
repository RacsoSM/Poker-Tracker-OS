# Poker Tracker-os — Especificación de diseño (v1)

- **Fecha:** 2026-09-25
- **Estado:** pendiente de revisión por el usuario
- **Proyecto:** `poker-tracker-os`

## 1. Propósito

El usuario juega cash **fast/zoom ¥1/¥2 con straddle de ¥4** en WPT Global, sala que no permite trackers (PokerTracker, Holdem Manager) ni HUDs. Quiere llevar un seguimiento de su juego para rentabilizar el hobby, usando solo lo que la sala le da **después** de jugar:

- La ventana **"My stats"** al cerrar una mesa: resultado, manos y duración.
- La **imagen descargada de una mano** (botón de descarga del historial), que incluye cartas, acciones, equity en el all-in y resultado por jugador.

**Éxito significa:** subir capturas desde la galería del móvil sin escribir datos a mano, y ver por día —como en PokerTracker— resultados, manos, tiempo, ¥/h, bb/100 y la comparación entre resultado real y EV de sus all-ins.

### Restricciones acordadas
- **PWA instalable en Android**; también usable desde el navegador del PC.
- **Todo local en el dispositivo.** Ni los datos ni las capturas salen del móvil. El hosting estático solo sirve el código.
- **Coste cero.** OCR local con Tesseract.js, sin APIs de pago ni de terceros.
- **Nunca escribir texto a mano.** El OCR rellena y el usuario solo confirma o corrige (con un selector para las cartas y el teclado numérico para cifras).
- El usuario **no compra Insurance**, así que el Insurance queda fuera del cálculo de EV.
- El usuario no mantendrá el código. La documentación de uso va en español.

### Fuera de alcance (v1)
- Estadísticas por mano completas (VPIP, PFR, 3-bet…): imposibles sin historial de todas las manos.
- Conversión a MXN y gestión de bankroll (depósitos, retiros, buy-ins): candidatos para la v2.
- Sincronización en la nube, cuentas o login.
- Cualquier interacción con el cliente de WPT durante el juego.
- Publicación en Play Store.

## 2. Arquitectura

**Stack:** React + TypeScript + Vite, `vite-plugin-pwa` (service worker, manifest, offline), IndexedDB mediante Dexie, Tesseract.js (datos de idioma `eng` cacheados para uso offline), Recharts para gráficas, `fflate` para el archivo de copia de seguridad y Vitest para tests.

**Hosting:** sitio estático gratuito con HTTPS (Netlify, Cloudflare Pages o GitHub Pages; se elige en el plan).

### Unidades y responsabilidades

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| `domain/` | Tipos (`Settings`, `SessionChunk`, `Hand`, `Card`) y cálculos puros: EV, ¥/h, bb/100, agrupación por día y totales | nada |
| `ocr/` | Envoltura de Tesseract.js: recibe una imagen y devuelve palabras con caja delimitadora y confianza | Tesseract.js |
| `vision/` | Utilidades de píxeles: detección de rectángulos de carta y clasificación del palo por color | Canvas API |
| `parsers/summary` | Salida del OCR → borrador de tramo (resultado, manos, duración) | `ocr` (tipos), `domain` |
| `parsers/hand` | Salida del OCR + píxeles → borrador de mano | `ocr`, `vision`, `domain` |
| `parsers/detect` | Decide el tipo de captura: "My stats" → resumen, "HAND ID" → mano, otro → preguntar | `ocr` (tipos) |
| `db/` | Esquema Dexie, repositorios y copia de seguridad (exportar/importar) | Dexie, fflate, `domain` |
| `ui/` | Pantallas y componentes | todo lo anterior |

`domain/` y `parsers/` son funciones puras, testeables sin navegador. La UI no contiene lógica de cálculo.

## 3. Modelo de datos

### Settings (un único registro)
- `heroName`: `"RacsoSM"`
- `stakes`: `{ sb: 1, bb: 2, straddle: 4, gameType: "fast" }`
- `currency`: `"CNY"`
- `dayCutoffHour`: `6`
- `lastBackupAt`: fecha o `null`

### SessionChunk (tramo = una captura "My stats")
- `id`, `startedAt` (fecha-hora; ver §4.3), `resultCny` (número, p. ej. `-13.00`), `hands` (entero), `durationSec` (entero)
- `stakes` (copia de Settings en el momento de crear el tramo), `imageId`, `note?`, `createdAt`

### Hand
- `id`, `handId` (string, **único**), `playedAt` (de la imagen), `heroPosition` (`UTG|UTG+1|MP|HJ|CO|BTN|SB|BB`), `heroCards` (2 cartas), `board` (0–5 cartas), `heroResultCny`
- `kind`: `"allin"` | `"study"`
- Solo si `kind = "allin"`: `allinStreet` (`preflop|flop|turn`), `heroEquity` (0–1), `potContested` (¥), `heroInvested` (¥)
- `tags: string[]`, `note?`, `imageId`, `createdAt`

### Image
- `id`, `blob`, `mime`, `width`, `height`

**Cartas:** `rank` ∈ `A K Q J T 9…2`, `suit` ∈ `s h d c`.

## 4. Reglas de cálculo

### 4.1 EV de all-in (por mano con `kind = "allin"`)
- `EV = heroEquity × potContested − heroInvested`
- `suerte = heroResultCny − EV`
- **Ejemplo** con la mano de prueba, visto desde el CO: equity 0.87, bote ¥347.20, invertido ¥156.10. EV = +¥145.96; real = +¥191.10; suerte = +¥45.14.

### 4.2 Bote disputado e inversión (a partir de la columna RIVER)
El "Total pot" de la imagen **no** se usa, porque incluye apuestas no pagadas (en la mano de prueba muestra ¥403.10 cuando el bote real es ¥347.20). Se usan los resultados netos por jugador `r_i` de la columna RIVER:
- **Héroe pierde:** `heroInvested = −r_héroe`. Ganador `w`: `potContested = inversión_w + r_w`, con `inversión_w = heroInvested` en un all-in heads-up.
- **Héroe gana:** `heroInvested` = la mayor pérdida entre los rivales que llegaron al all-in (lo que el héroe tuvo que igualar). `potContested = heroInvested + r_héroe`.
- **Casos ambiguos** (tres o más jugadores en el all-in, bote dividido, resultado del héroe ≈ 0): se rellenan los valores estimados y `potContested` y `heroInvested` se marcan para confirmación manual.
- El rake, si existe, ya está descontado en `r_i`, así que no requiere tratamiento aparte.

### 4.3 Fecha de un tramo
"My stats" no muestra fecha. `startedAt` se toma, en este orden, de: fecha EXIF de la imagen → `lastModified` del archivo → momento de la subida. Siempre es editable en la pantalla de confirmación.

### 4.4 Día de juego
`díaDeJuego(t) = fechaLocal(t − dayCutoffHour horas)`. Con corte a las 06:00, un tramo a las 01:30 del 26/09 cuenta para el 25/09. Las manos usan `playedAt` y se asignan al día con la misma regla.

### 4.5 Métricas (por día y por periodo)
- `resultado` = Σ `resultCny` de los tramos
- `manos` = Σ `hands`
- `tiempo` = Σ `durationSec`
- `¥/h` = resultado ÷ (tiempo en horas); se muestra "—" si el tiempo es 0
- `bb/100` = (resultado ÷ bb) ÷ manos × 100, con bb = ¥2 (la de los stakes del tramo); "—" si no hay manos
- `manos/h` = manos ÷ horas
- `all-ins` = número de manos `allin` del día; `real − EV` = Σ `suerte` de esas manos

Las métricas de resultado provienen **solo de los tramos**. Las manos no se suman al resultado, porque ya están incluidas en su tramo; solo aportan las métricas de EV.

## 5. Flujo de importación

1. **Entrada:** botón "+" (selector de archivos, múltiple) o Web Share Target de Android ("Compartir → Poker Tracker-os"; el service worker recibe la imagen).
2. **OCR** local. La primera vez se descargan y cachean los datos de idioma. Se muestra un indicador de progreso.
3. **Detección de tipo** (`parsers/detect`).
4. **Parseo:**
   - **Resumen:** regex sobre el texto: resultado `[-+]?CN¥\s?[\d,]+\.\d{2}`, manos `(\d+)\s*hands`, duración `(\d{2}):(\d{2}):(\d{2})`.
   - **Mano:** lectura por zonas del diseño fijo de WPT:
     - `HAND ID` y fecha-hora por OCR.
     - Cartas: rectángulos de color detectados en `vision/`; el palo por el color de fondo (verde ♣, azul ♦, rojo ♥, negro ♠) y el rango por OCR del carácter.
     - Fila del héroe: se localiza `heroName` en la columna RIVER; de ahí salen posición, cartas y resultado.
     - Equity: primera columna de calle donde aparece un porcentaje junto a las cartas del héroe. Si el héroe no tiene porcentaje, `kind = "study"`.
     - Bote e inversión según §4.2.
5. **Confirmación (obligatoria):** captura arriba y formulario prerrellenado abajo. Los campos con baja confianza o vacíos se resaltan en amarillo, y no se puede guardar con campos obligatorios vacíos. Las cartas se editan con un selector y las cifras con el teclado numérico. En las manos, el tipo (all-in o estudio) se puede cambiar.
6. **Duplicados:**
   - Una mano con un `handId` existente **se bloquea**, con aviso y opción de abrir la existente.
   - Un tramo con el mismo resultado, manos, duración y día **genera un aviso** que se puede ignorar.
7. **Lotes:** si se suben varias imágenes, se confirman una tras otra (indicador "2 de 5").
8. **Vinculación:** las manos no se vinculan manualmente a un tramo; se agrupan con los tramos por día de juego.

## 6. Pantallas

Barra inferior con cuatro pestañas y botón flotante "+".

1. **Días (inicio):** tabla con una fila por día de juego. Columnas: Fecha · Tramos · Manos · Tiempo · Resultado ¥ · ¥/h · bb/100 · All-ins · Real − EV. Filtro de periodo (semana, mes, año, todo, rango) y fila de totales del periodo. Verde para positivo y rojo para negativo. En móvil la tabla tiene desplazamiento horizontal con la columna Fecha fija.
   - **Detalle del día:** lista de tramos (hora, resultado, manos, duración, miniatura; tocar para ver o editar) y lista de manos del día.
2. **Gráficas:** tarjetas del periodo (resultado, manos, horas, ¥/h, bb/100, real − EV). Resultado acumulado por día y gráfica de EV de all-in con dos líneas acumuladas por all-in registrado: real y EV.
3. **Manos:** lista con cartas, posición, tablero, resultado y tipo. Filtros por tipo, posición, etiqueta y fecha. El detalle muestra la captura con zoom, los datos y las notas, y permite editar y etiquetar.
4. **Ajustes:** nombre en mesa, stakes, hora de corte del día, exportar e importar la copia, estado del almacenamiento persistente y versión.

## 7. Almacenamiento y copias de seguridad

- Al iniciar se llama a `navigator.storage.persist()`. Si se deniega, aparece un aviso fijo en Ajustes.
- **Exportar:** un archivo `poker-tracker-os-backup-AAAA-MM-DD.zip` con `data.json` (con versión del esquema) y `images/`. Se descarga o comparte (Drive, etc.).
- **Importar:** se valida el archivo completo (estructura, versión e imágenes referenciadas) **antes** de modificar la base de datos. Se ofrecen dos modos: *reemplazar todo* o *fusionar* (las manos se desduplican por `handId`). Si la validación falla, no se toca nada.
- **Recordatorio:** un banner en Días si `lastBackupAt` tiene más de 7 días o es nulo y existen datos.

## 8. Errores

| Situación | Comportamiento |
|---|---|
| El OCR no lee un campo | Campo vacío en amarillo; no se puede guardar hasta completarlo |
| Imagen no reconocida o recortada | Aviso; se ofrece elegir el tipo a mano o descartar |
| Porcentajes sin el héroe | `kind = "study"`, editable |
| Datos de OCR aún no descargados y sin conexión | Mensaje: "Conéctate una vez para descargar el lector" |
| Almacenamiento persistente denegado | Aviso fijo en Ajustes y recordatorio de backup más frecuente |
| Importación inválida | Error descriptivo; los datos actuales quedan intactos |
| Borrar un tramo o una mano | Diálogo de confirmación |

## 9. Pruebas

- **Fixtures reales** en `tests/fixtures/`:
  - `session-summary-01.png` → resultado −13.00, manos 18, duración 133 s.
  - `hand-1323539300829384704.png` → handId `1323539300829384704`, fecha 2026-09-25 11:00:47, héroe RacsoSM en HJ con A♦8♣, tablero 5♣ Q♦ 8♥ 4♣ 3♦, resultado −28.00, `kind = "study"`.
  - Test adicional con la misma mano configurando `heroName = "超激进流"`, para validar la rama all-in con bote: equity 0.87, calle flop, bote 347.20, invertido 156.10, resultado +191.10. Si el OCR no lee nombres chinos, este caso se prueba sobre el parser con la salida del OCR serializada.
- **Tests unitarios** de `domain/`: EV, suerte, ¥/h, bb/100, día de juego con corte (incluidos los bordes 05:59 y 06:00) y totales.
- **Tests de parsers** sobre la salida del OCR serializada (rápidos y deterministas), más un test de integración lento que ejecuta Tesseract sobre las imágenes reales.
- **Tests de copia de seguridad:** exportar e importar da un resultado idéntico, y un archivo corrupto no modifica la base de datos.
- Las nuevas capturas del usuario (sobre todo all-ins propios ganados y perdidos) se añadirán como fixtures.

## 10. Riesgos y primer paso

**Riesgo principal:** la precisión del OCR en la imagen de la mano (rangos de carta, cifras pequeñas, porcentajes).

**Primer paso del plan: prueba de viabilidad** con Tesseract.js sobre los dos fixtures, midiendo qué campos se leen bien. Alternativas si algo falla:
- Para los rangos de carta: comparación con plantillas de imagen.
- Para cifras: preprocesado (escala, binarización, lista blanca de caracteres).
- Último recurso por campo: selector manual (nunca texto libre).

El resultado de esta prueba puede ajustar el §5.4 antes de construir la UI.
