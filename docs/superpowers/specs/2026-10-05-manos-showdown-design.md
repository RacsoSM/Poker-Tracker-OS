# Manos de showdown y líneas roja / azul — Especificación de diseño

- **Fecha:** 2026-10-05
- **Estado:** pendiente de revisión por el usuario
- **Base:** `2026-09-25-poker-tracker-os-design.md` (v1). Este documento solo describe lo que cambia.

## 1. Propósito

Los trackers populares dibujan, además del resultado total, dos líneas que lo descomponen:

| Línea | Color | Qué mide |
|---|---|---|
| Total | verde | Resultado acumulado |
| Showdown | azul | Lo ganado o perdido en manos que llegan al showdown |
| Sin showdown | roja | Lo ganado o perdido en manos que **no** llegan: ciegas foldeadas, botes robados y botes abandonados |

La sala no da el historial de todas las manos, pero sí el total de cada tramo ("My stats"). Como `total = showdown + sin showdown`, basta con subir **solo las manos de cada tramo que llegaron al showdown** (≈ 6–10 % de las manos) para obtener las tres líneas:

- `showdown(tramo) = Σ heroResultCny` de sus manos de showdown
- `sinShowdown(tramo) = resultCny(tramo) − showdown(tramo)`

**Éxito significa:** tras una sesión, el usuario sube de una vez las capturas de sus manos de showdown asociándolas a ese tramo, marca el tramo como completo y ve en Gráficas las tres líneas acumuladas.

### Definición de showdown
Una mano cuenta como showdown si el héroe sigue en ella cuando se resuelve el bote con cartas, aunque no las enseñe:
- All-in resuelto en cualquier calle (incluido preflop): **sí**.
- Llega al final del river, pierde y tira las cartas sin mostrarlas: **sí** (pérdida en showdown).
- Un rival foldea ante su apuesta en el river: **no**.
- Foldea en cualquier calle, incluidas las ciegas y el straddle: **no**. No hace falta subirla: su pérdida ya está en el total del tramo y cae sola en la línea roja.

## 2. Modelo de datos

Todos los campos nuevos son **opcionales**, de modo que los datos existentes, las copias de seguridad antiguas y los registros de la nube siguen siendo válidos sin migración de contenido.

### Hand
- `showdown?: boolean` — `true` si la mano llegó al showdown según §1. Lo propone el detector (§3.3) y el usuario lo confirma. Ausente equivale a `false`.
- `chunkId?: string` — tramo al que pertenece la mano. Solo es obligatorio para que la mano cuente en las líneas (§4); las manos de estudio pueden seguir sin tramo.

Una mano `kind = "allin"` es siempre de showdown: al guardar, `showdown` se fuerza a `true`. `kind` y `showdown` son independientes en el resto de casos (una mano de estudio puede ser de showdown).

### SessionChunk
- `showdownComplete?: boolean` — el usuario confirma que ya subió **todas** las manos de showdown del tramo. Ausente equivale a `false`.

### Base de datos (Dexie)
- `version(3)`: índice nuevo `chunkId` en `hands` (`'id, &handId, playedAt, kind, chunkId'`). No hay que transformar filas.

### Copia de seguridad
- `handZ` admite `showdown: z.boolean().optional()` y `chunkId: z.string().optional()`; `chunkZ` admite `showdownComplete: z.boolean().optional()`.
- `BACKUP_SCHEMA_VERSION` se mantiene en `1`: el cambio es aditivo y una copia nueva sigue siendo legible por la validación actual (zod descarta las claves desconocidas).
- Al importar, un `chunkId` que no exista entre los tramos de la copia (ni en la base, en modo fusionar) se elimina de la mano en lugar de rechazar la copia.

### Sincronización
Los campos viajan dentro del JSON del registro, sin cambios en `sync/` ni en `firestore.rules`.

## 3. Flujo de importación

### 3.1 Subir manos de showdown de un tramo
- En el **detalle del día**, cada tramo muestra el botón **"Subir manos de showdown"**.
- Abre el selector de archivos (múltiple) y entra en el flujo de subida normal (§5 de v1) en **modo showdown**, con el tramo como destino:
  - Cada borrador de mano llega con `chunkId = tramo.id` y `showdown` = lo que diga el detector (§3.3).
  - `playedAt` se toma de `tramo.startedAt` en lugar del momento de subida, para que la mano caiga en el mismo día de juego que su tramo aunque se suba al día siguiente.
  - El formulario muestra arriba "Showdown · tramo HH:MM (resultado)" y la casilla **"Llegó al showdown"**, editable.
  - Si el detector dice que **no** hubo showdown, la casilla sale desmarcada y aparece el aviso "Esta mano no parece de showdown". El usuario decide. Así se cuela menos una mano equivocada en el lote.
- Al terminar el lote se pregunta: **"¿Ya subiste todas las manos de showdown de este tramo?"** Sí → `showdownComplete = true`. No → queda pendiente y se puede marcar después.

### 3.2 Subida normal (botón "+")
- El formulario de mano gana dos controles: la casilla **"Llegó al showdown"** (prerrellenada por el detector) y un selector **"Tramo"** con los tramos del mismo día de juego (por defecto ninguno).
- Si se elige un tramo, `playedAt` pasa a ser `tramo.startedAt`, igual que en §3.1.

### 3.3 Detección automática del showdown
El parser de manos (`parsers/hand`) añade al borrador `showdown: boolean | null` y, cuando no está seguro, el campo `'showdown'` a `uncertain` (casilla en amarillo). Combina cuatro señales de la captura.

**Señales**
- **S1 · El héroe foldea.** En alguna columna de calle (PRE-FLOP, FLOP, TURN, RIVER), la casilla de acción del héroe dice "Fold" (escritorio) o "No ir" (móvil). La casilla se localiza como hoy la posición: la fila del héroe en esa columna (§10a de v1).
- **S2 · All-in con equity.** El parser ya encontró porcentajes de equity (`kind = "allin"`). El bote se resolvió con cartas.
- **S3 · Jugadores que siguen al final.** `vivos = N − folds`, donde `N` es el número de filas de la columna RIVER (= jugadores) y `folds` es el número de casillas "Fold"/"No ir" en todas las columnas de calle. Cada jugador foldea como mucho una vez. Hay showdown si `vivos ≥ 2`.
- **S4 · Cartas de rivales boca arriba.** En la columna RIVER, cada fila tiene dos cartas pequeñas: boca arriba (fondo blanco) o boca abajo (reverso oscuro con trama). Se clasifican por píxeles, con la fracción de píxeles claros en la zona de las cartas de cada fila ya detectada (`vision/rows`). Hay showdown si al menos un rival, es decir una fila distinta de la del héroe, enseña sus cartas. Las del héroe no cuentan, porque la captura las muestra siempre, incluso cuando foldea.

El vocabulario de fold (`Fold`, `No ir`) va en una lista en `parsers/` para poder ampliarla con otros idiomas.

**Decisión**

| Caso | `showdown` | ¿Dudoso? |
|---|---|---|
| S1: el héroe foldeó | `false` | no |
| S2: all-in con equity | `true` | no |
| S3 y S4 dicen "sí" | `true` | no |
| S3 y S4 dicen "no" | `false` | no (el héroe ganó sin que le pagaran) |
| S3 y S4 no coinciden | lo que diga S4 | sí |
| No se pudo leer la columna RIVER | `null` | sí |

Por qué hacen falta S3 y S4 a la vez:
- **S3 puede fallar** si la captura del móvil está recortada y falta parte de una columna. Faltarían folds y saldría un falso "sí".
- **S4 puede fallar** si el rival pierde en el showdown y tira sus cartas sin enseñarlas, o si un rival enseña cartas voluntariamente tras foldear.

Cuando no coinciden, la mano queda en amarillo para que el usuario la confirme.

**Comprobación con los fixtures actuales**
- `hand-1323539300829384704` con héroe `RacsoSM`: foldea en el FLOP (S1) → `false`.
- La misma mano con héroe `HiTeR2504`: all-in con 13 % (S2) → `true`. S3 da 8 − 6 = 2 vivos y S4 ve las cartas de 超激进流, así que coinciden.
- `mobile-hand-01` y `mobile-hand-02`: all-in con equity (S2) → `true`. S3 y S4 coinciden.

### 3.4 Duplicados
Sin cambios: el `handId` sintético por huella del archivo ya impide subir dos veces la misma captura.

## 4. Reglas de cálculo

### 4.1 Por tramo
- `manosSD(t)` = manos con `chunkId = t.id` y `showdown = true`
- `showdownCny(t)` = Σ `heroResultCny` de `manosSD(t)`
- `sinShowdownCny(t)` = `t.resultCny − showdownCny(t)`
- En bb: cada importe ÷ `t.stakes.bb`

`heroResultCny` es el neto del héroe en la mano (columna RIVER), con el rake ya descontado (§4.2 de v1), igual que el resultado de "My stats". Por eso la resta no deja restos de rake en la línea roja.

### 4.2 Qué tramos entran
Solo los tramos con `showdownComplete = true`. Uno incompleto pondría en la roja el resultado de las manos que faltan, sin que se note.

En la gráfica de líneas, **la verde también usa solo los tramos completos**, para que se cumpla `verde = azul + roja` en todo punto. El resultado acumulado de todos los tramos sigue en su gráfica actual.

### 4.3 Serie
`showdownSeries(chunks, hands)` → `{ hands, total, showdown, nonShowdown }[]`:
- Empieza en `{ hands: 0, total: 0, showdown: 0, nonShowdown: 0 }`.
- Tramos completos ordenados por `startedAt`; un punto al final de cada uno.
- `hands` = manos acumuladas (`Σ t.hands`); el resto, importes acumulados en ¥.
- No hay puntos dentro de un tramo: el total solo se conoce por tramo.

### 4.4 Métricas del periodo
Calculadas sobre los tramos completos del periodo:
- `cobertura` = tramos completos / tramos, y manos de esos tramos / manos totales
- `bb/100 showdown` y `bb/100 sin showdown` (misma fórmula que el bb/100 de v1)
- `% manos de showdown` = Σ |manosSD| / Σ manos

### 4.5 Avisos de coherencia
En el detalle del tramo, aviso no bloqueante si:
- un tramo completo no tiene ninguna mano de showdown y tiene más de 30 manos;
- las manos de showdown son más del 25 % de las manos del tramo;
- hay más manos vinculadas que `t.hands`.

## 5. Pantallas

### Gráficas
Gráfica nueva **"Showdown / sin showdown"** debajo de "Resultado acumulado":
- Eje X: manos acumuladas. Eje Y: ¥.
- Líneas: Total (verde, `--pos`), Showdown (azul, `--accent`) y Sin showdown (roja, `--neg`), con leyenda. Las tres deben distinguirse en modo claro y oscuro.
- Debajo: "Basada en N de M tramos (X % de las manos)". Si no hay tramos completos: "Marca un tramo como completo para ver estas líneas."
- Las tarjetas del periodo añaden bb/100 showdown y bb/100 sin showdown cuando hay al menos un tramo completo.

### Detalle del día
Cada tramo muestra: manos de showdown vinculadas (cantidad y % de sus manos), su showdown y sin-showdown en ¥, la casilla **"Showdown completo"**, el botón de §3.1 y los avisos de §4.5.

### Manos
- Filtro nuevo: Todas · Showdown · Sin marcar.
- El detalle de la mano muestra y permite editar "Llegó al showdown" y el tramo.

## 6. Borrados

- **Borrar un tramo:** sus manos se conservan y pierden `chunkId`. El diálogo de confirmación lo dice: "Las N manos vinculadas se quedan en la biblioteca, sin tramo."
- **Borrar o editar una mano** de un tramo completo: el tramo sigue marcado como completo, porque el usuario puede estar corrigiendo un error.

## 7. Fuera de alcance

- Leer con OCR una lista o historial de manos en lugar de una captura por mano.
- Líneas ajustadas a EV dentro de showdown y sin showdown.
- Estadísticas de calle (WTSD, W$SD, WWSF): necesitan las manos que no llegan al showdown.

## 8. Pruebas

- **`domain/stats`:**
  - `showdownCny` y `sinShowdownCny` de un tramo, con manos ganadas, perdidas y un all-in.
  - Los tramos incompletos y las manos sin `chunkId` o con `showdown = false` no cuentan.
  - `showdownSeries`: orden por `startedAt`, manos acumuladas y `total = showdown + nonShowdown` en cada punto.
  - bb/100 por tramo con stakes distintos.
  - Avisos de §4.5 en sus bordes (30 manos, 25 %).
- **`db/`:** la migración a `version(3)` conserva las filas; borrar un tramo desvincula sus manos.
- **Copia de seguridad:** exportar e importar conserva los campos nuevos; una copia antigua sin ellos se importa igual; un `chunkId` huérfano se elimina.
- **Importación:** en modo showdown el borrador sale con `chunkId`, el `showdown` del detector y `playedAt = tramo.startedAt`.
- **Detector (`parsers/hand`), sobre el OCR serializado:**
  - Los cuatro fixtures de §3.3 dan el resultado esperado.
  - Tests unitarios de la tabla de decisión con señales sintéticas, incluidos el caso en que S3 y S4 no coinciden y el de la columna RIVER ilegible.
  - Clasificación de cartas boca arriba / boca abajo sobre las filas RIVER de los fixtures: en `hand-1323539300829384704` hay 3 filas boca arriba (incluida la del héroe) y 5 boca abajo.
- **Fixtures nuevos que pedir al usuario** (escritorio y móvil si es posible):
  - Gana el bote sin showdown (el rival foldea al river) → `false`.
  - Showdown sin all-in, pagando en el river, ganado y perdido → `true`.
  - Pierde en el showdown y el rival gana sin enseñar → comprobar S3 frente a S4.
  - Captura del móvil recortada → comprobar que queda como dudosa.
- **Formulario:** una mano `allin` se guarda con `showdown = true` aunque la casilla esté desmarcada.
