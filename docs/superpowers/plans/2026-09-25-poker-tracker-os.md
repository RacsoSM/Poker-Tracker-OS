# Poker Tracker-os v1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA instalable en Android que lee con OCR local las capturas "My stats" y las manos descargadas de WPT Global, y muestra resultados por día de juego, bb/100, ¥/h y EV de all-in, todo guardado en el propio dispositivo.

**Architecture:** React + TypeScript + Vite. La lógica se reparte en funciones puras y testeables en Node:
- `domain/`: cálculos.
- `image/` y `vision/`: píxeles, cartas y filas.
- `parsers/`: de la salida del OCR a borradores.

Tesseract.js (`ocr/`) es la única pieza no determinista. Sus salidas reales se congelan en fixtures JSON, así que los parsers se testean sin ejecutar OCR. Los datos viven en IndexedDB (Dexie). La UI son páginas React que solo orquestan.

**Tech Stack:** React 19, react-router-dom 7 (HashRouter), Vite 8, TypeScript 6, Vitest 5, Dexie 4 + dexie-react-hooks, Tesseract.js 5.1.1 + @tesseract.js-data/eng 1.0.0, fast-png 8, fflate 0.8, zod 4, Recharts 3, vite-plugin-pwa 1.3 (injectManifest) + workbox 7, fake-indexeddb 6, Testing Library, tsx.

**Spec:** `docs/superpowers/specs/2026-09-25-poker-tracker-os-design.md` (incluye §10a con los resultados de la prueba de OCR que fija los umbrales usados aquí).

## Global Constraints

- **Todo local.** Ningún dato ni captura sale del dispositivo. No hay llamadas de red salvo la descarga de los assets de Tesseract, que se sirven desde el propio sitio en `/tesseract/`.
- **Coste cero.** No se usan APIs de pago ni servicios de terceros en runtime.
- **Nunca texto libre para datos extraídos.** Cartas con selector, posición con desplegable, cifras con `inputMode="decimal"`/`"numeric"` y signo con botón ±. Solo las etiquetas y las notas son texto libre.
- Stakes por defecto: `{ sb: 1, bb: 2, straddle: 4, gameType: 'fast' }`. Moneda `CNY`. `heroName` por defecto `"RacsoSM"`. `dayCutoffHour` por defecto `6`.
- bb/100 usa `bb` = `stakes.bb` del tramo (¥2), no el straddle.
- Los resultados del día salen **solo de los tramos** ("My stats"). Las manos aportan únicamente métricas de EV.
- `EV = heroEquity × potContested − heroInvested`; `suerte = heroResultCny − EV`. Todo redondeado a 2 decimales.
- `díaDeJuego(t) = fechaLocal(t − dayCutoffHour h)`, en formato `YYYY-MM-DD`.
- Umbrales de visión (spec §10a):
  - cartas: verde = ♣, azul = ♦, rojo `(r>110, g<70, b<70)` = ♥, negro `(max<45, max−min<12)` = ♠;
  - plantilla de rango 16×24, distancia máxima 0.15, siempre dentro de la misma clase de tamaño;
  - porcentaje válido solo con confianza ≥ 60.
- Los textos de la UI van en español. Los identificadores de código, en inglés.
- Versiones fijadas: `tesseract.js@5.1.1`, `@tesseract.js-data/eng@1.0.0` (carpeta `4.0.0_best_int`), `typescript@6`.
- Node ≥ 22 (el entorno tiene 24.18).
- Cada commit termina con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Capturas a otra resolución** (cliente móvil, 1080 px de ancho en lugar de 1280). Se espera que la detección de cartas y filas escale con `s = width/1280` y siga encontrando las 11 cartas y las 8 filas de RIVER. Test en Task 5 y Task 7 con el fixture reescalado ×0.75.
2. **Compresión JPEG o ruido de color** en la captura. Se espera que las filas sigan detectándose, porque la tolerancia es ≤ 4 por canal y basta con un 97 % de muestras cercanas al fondo. Test en Task 7 con ruido ±2 determinista.
3. **Nombre del héroe no encontrado** (cambio de nick o OCR fallido). Se espera un borrador sin crash, con cartas, posición y resultado en `null` marcados como inciertos y `kind = 'study'`. Test en Task 10.
4. **Resumen con resultado positivo, sin signo, con separador de miles o con guion tipográfico** (`+CN¥1,234.50`, `CN¥5.00`, `—CN¥3.00`). Se espera que se parsee bien. Test en Task 9.
5. **Primer uso sin conexión** (los assets de Tesseract aún no están en caché). Se espera un error claro, "Conéctate a internet una vez…", y que el siguiente intento vuelva a probar en lugar de quedarse roto. Test en Task 13.

---

## Estructura de archivos

```
poker-tracker-os/
├─ index.html · package.json · vite.config.ts · vitest.ocr.config.ts · netlify.toml
├─ tsconfig.json · tsconfig.app.json · tsconfig.node.json · tsconfig.sw.json
├─ README.md
├─ scripts/
│  ├─ copy-tesseract.mjs        copia worker/core/lang de node_modules a public/tesseract
│  ├─ make-seed-templates.ts    genera src/vision/seedTemplates.json desde el fixture
│  ├─ dump-ocr.ts               genera tests/fixtures/*.ocr.json con OCR real
│  └─ make-icons.ts             genera public/icons/*.png
├─ tests/fixtures/              PNG reales + salidas OCR congeladas (.ocr.json)
└─ src/
   ├─ main.tsx · styles.css · sw.ts · sharedCache.ts
   ├─ domain/      types · cards · format · stats · allin · positions · handFilter · backupReminder
   ├─ image/       rgba (decode/encode PNG, píxel, binarizar) · blob
   ├─ vision/      cards (detección por color) · glyph (plantillas de rango) · rows (filas) · seeds · fixtureTruth · seedTemplates.json
   ├─ ocr/         types · engine (Tesseract) · columns (pasada por columna) · nodePaths · loader (singleton navegador)
   ├─ parsers/     words · names · detect · summary · handLayout · hand
   ├─ db/          db (Dexie) · repo · backup · context
   ├─ import/      pipeline · decodeImage · shared · learn
   ├─ ui/          App · BottomNav · Fab · format · hooks · components/* · pages/*
   └─ test/        setup · fixtures · imageUtils
```

---

### Task 1: Esqueleto del proyecto

**Files:**
- Create: `package.json`, `.gitignore`, `index.html`, `vite.config.ts`, `vitest.ocr.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.sw.json`, `scripts/copy-tesseract.mjs`, `src/main.tsx`, `src/styles.css`, `src/ui/App.tsx`, `src/test/setup.ts`, `src/test/fixtures.ts`, `src/sw.ts`, `src/sharedCache.ts`
- Test: `src/ui/App.test.tsx`

**Interfaces:**
- Produces:
  - `fixtureBytes(name: string): Uint8Array`
  - `fixtureJson<T>(name: string): T`
  - `FIXTURES_DIR`, `SUMMARY_PNG = 'session-summary-01.png'`, `HAND_PNG = 'hand-1323539300829384704.png'`
  - `SHARED_CACHE = 'pt-shared'`
  - Scripts npm: `dev`, `build`, `test`, `test:ocr`, `typecheck`

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "poker-tracker-os",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "prepare-assets": "node scripts/copy-tesseract.mjs",
    "dev": "npm run prepare-assets && vite",
    "build": "npm run prepare-assets && tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ocr": "vitest run --config vitest.ocr.config.ts",
    "typecheck": "tsc -b"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm i react@19 react-dom@19 react-router-dom@7 dexie@4 dexie-react-hooks@4 recharts@3 fflate@0.8 zod@4 fast-png@8 tesseract.js@5.1.1 @tesseract.js-data/eng@1.0.0 workbox-precaching@7 workbox-routing@7 workbox-strategies@7
npm i -D vite@8 @vitejs/plugin-react@6 typescript@6 vitest@5 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb@6 vite-plugin-pwa@1 workbox-build@7 workbox-window@7 @types/react @types/react-dom @types/node tsx
```

Expected: termina sin errores de peer dependencies.

- [ ] **Step 3: Crear `.gitignore`**

```
node_modules
dist
dev-dist
public/tesseract
*.traineddata
coverage
```

- [ ] **Step 4: Crear los tsconfig**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.sw.json" }
  ]
}
```

`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client", "vite-plugin-pwa/client", "node"]
  },
  "include": ["src", "scripts"],
  "exclude": ["src/sw.ts", "scripts/*.mjs"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.ocr.config.ts"]
}
```

`tsconfig.sw.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.sw.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": []
  },
  "include": ["src/sw.ts", "src/sharedCache.ts"]
}
```

- [ ] **Step 5: Crear la configuración de Vite y Vitest**

`vite.config.ts` (el plugin PWA se añade en la Task 20):
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.ocr.test.ts', 'node_modules/**'],
    testTimeout: 20000,
  },
});
```

`vitest.ocr.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.ocr.test.ts'],
    testTimeout: 180000,
  },
});
```

- [ ] **Step 6: Crear el script de assets de Tesseract `scripts/copy-tesseract.mjs`**

```js
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const out = 'public/tesseract';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const f of readdirSync('node_modules/tesseract.js-core')) {
  if (/^tesseract-core.*\.wasm(\.js)?$/.test(f)) cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}
cpSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/lang/eng.traineddata.gz`);
console.log('Assets de Tesseract copiados a public/tesseract');
```

- [ ] **Step 7: Crear `index.html`, `src/main.tsx`, `src/styles.css`, un `App` mínimo y los stubs del service worker**

`index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f1115" />
    <link rel="icon" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <title>Poker Tracker-os</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/styles.css` (provisional; la Task 14 lo sustituye entero):
```css
body { margin: 0; background: #0f1115; color: #e8eaf0; font-family: system-ui, sans-serif; }
```

`src/ui/App.tsx`:
```tsx
export function App() {
  return <h1>Poker Tracker-os</h1>;
}
```

`src/sharedCache.ts`:
```ts
export const SHARED_CACHE = 'pt-shared';
```

`src/sw.ts` (stub para que `tsc -b` tenga entrada; la Task 20 lo completa):
```ts
/// <reference lib="webworker" />
export {};
```

- [ ] **Step 8: Crear los helpers de test**

`src/test/setup.ts`:
```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

`src/test/fixtures.ts`:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures');
export const SUMMARY_PNG = 'session-summary-01.png';
export const HAND_PNG = 'hand-1323539300829384704.png';

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

export function fixtureJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), 'utf8')) as T;
}
```

- [ ] **Step 9: Escribir el test de humo `src/ui/App.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('muestra el nombre de la app', () => {
    render(<App />);
    expect(screen.getByText('Poker Tracker-os')).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Ejecutar tests, typecheck y build**

Run: `npm test && npm run typecheck && npm run build`
Expected: 1 test PASS, typecheck sin errores, build genera `dist/` y `public/tesseract/` contiene `worker.min.js`, `core/*.wasm.js` y `lang/eng.traineddata.gz`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: esqueleto Vite + React + TS + Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tipos de dominio, cartas y formato

**Files:**
- Create: `src/domain/types.ts`, `src/domain/cards.ts`, `src/domain/format.ts`
- Test: `src/domain/cards.test.ts`, `src/domain/format.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - Tipos `Rank`, `Suit`, `Card`, `Position`, `Street`, `SizeClass`, `Stakes`, `Settings`, `SessionChunk`, `AllinData`, `Hand`, `HandValues`, `StoredImage`
  - Constantes `DEFAULT_SETTINGS`, `POSITIONS`, `STREETS`
- Produces (`cards.ts`):
  - Constantes `RANKS`, `SUITS`, `SUIT_SYMBOL`, `SUIT_NAME`
  - `isRank(x: string): x is Rank`
  - `formatCard(c: Card): string`
  - `parseCard(s: string): Card`
- Produces (`format.ts`):
  - `round2(n: number): number`
  - `fmtCny(n: number): string`
  - `fmtDuration(sec: number): string`
  - `fmtNum(n: number | null, digits?: number): string`
  - `fmtDay(day: string): string`
  - `fmtTime(ms: number): string`
  - `parseDecimal(t: string): number | null`
  - `toLocalInput(ms: number): string`
  - `fromLocalInput(s: string): number | null`

- [ ] **Step 1: Escribir los tests que fallan**

`src/domain/cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatCard, isRank, parseCard } from './cards';

describe('cards', () => {
  it('parsea y formatea', () => {
    expect(parseCard('Ad')).toEqual({ rank: 'A', suit: 'd' });
    expect(formatCard({ rank: 'T', suit: 's' })).toBe('10♠');
    expect(formatCard({ rank: '8', suit: 'c' })).toBe('8♣');
  });
  it('rechaza cartas inválidas', () => {
    expect(() => parseCard('1x')).toThrow();
    expect(isRank('Z')).toBe(false);
    expect(isRank('Q')).toBe(true);
  });
});
```

`src/domain/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fmtCny, fmtDay, fmtDuration, fmtNum, fromLocalInput, parseDecimal, round2, toLocalInput } from './format';

describe('format', () => {
  it('redondea a centavos', () => {
    expect(round2(145.9640000001)).toBe(145.96);
    expect(round2(-0.005)).toBe(-0);
  });
  it('formatea yuanes con signo', () => {
    expect(fmtCny(-13)).toBe('-¥13.00');
    expect(fmtCny(191.1)).toBe('+¥191.10');
    expect(fmtCny(0)).toBe('¥0.00');
  });
  it('formatea duración HH:MM:SS', () => {
    expect(fmtDuration(133)).toBe('00:02:13');
    expect(fmtDuration(3930)).toBe('01:05:30');
    expect(fmtDuration(360000)).toBe('100:00:00');
  });
  it('formatea números opcionales y días', () => {
    expect(fmtNum(null)).toBe('—');
    expect(fmtNum(-36.111, 2)).toBe('-36.11');
    expect(fmtDay('2026-09-25')).toBe('25/09/2026');
  });
  it('parsea decimales no negativos', () => {
    expect(parseDecimal('28')).toBe(28);
    expect(parseDecimal('13,5')).toBe(13.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
  it('convierte a y desde datetime-local', () => {
    const ms = new Date(2026, 8, 25, 11, 0, 47).getTime();
    expect(toLocalInput(ms)).toBe('2026-09-25T11:00:47');
    expect(fromLocalInput('2026-09-25T11:00:47')).toBe(ms);
    expect(fromLocalInput('2026-09-25T11:00')).toBe(new Date(2026, 8, 25, 11, 0, 0).getTime());
    expect(fromLocalInput('')).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/domain`
Expected: FAIL con "Failed to resolve import './cards'".

- [ ] **Step 3: Implementar**

`src/domain/types.ts`:
```ts
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = 's' | 'h' | 'd' | 'c';
export interface Card { rank: Rank; suit: Suit }
export type Position = 'UTG' | 'UTG+1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Street = 'preflop' | 'flop' | 'turn';
export type SizeClass = 'board' | 'hole';

export interface Stakes { sb: number; bb: number; straddle: number; gameType: 'fast' }

export interface Settings {
  heroName: string;
  stakes: Stakes;
  currency: 'CNY';
  dayCutoffHour: number;
  lastBackupAt: number | null;
}

export interface SessionChunk {
  id: string;
  startedAt: number;
  resultCny: number;
  hands: number;
  durationSec: number;
  stakes: Stakes;
  imageId: string;
  note?: string;
  createdAt: number;
}

export interface AllinData { street: Street; heroEquity: number; potContested: number; heroInvested: number }

export interface Hand {
  id: string;
  handId: string;
  playedAt: number;
  heroPosition: Position;
  heroCards: [Card, Card];
  board: Card[];
  heroResultCny: number;
  kind: 'allin' | 'study';
  allin?: AllinData;
  tags: string[];
  note?: string;
  imageId: string;
  createdAt: number;
}

export type HandValues = Omit<Hand, 'id' | 'createdAt' | 'imageId'>;

export interface StoredImage { id: string; bytes: Uint8Array; mime: string; width: number; height: number }

export const DEFAULT_SETTINGS: Settings = {
  heroName: 'RacsoSM',
  stakes: { sb: 1, bb: 2, straddle: 4, gameType: 'fast' },
  currency: 'CNY',
  dayCutoffHour: 6,
  lastBackupAt: null,
};

export const POSITIONS: Position[] = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const STREETS: Street[] = ['preflop', 'flop', 'turn'];
```

`src/domain/cards.ts`:
```ts
import type { Card, Rank, Suit } from './types';

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_NAME: Record<Suit, string> = { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' };

export function isRank(x: string): x is Rank {
  return (RANKS as string[]).includes(x);
}

export function formatCard(c: Card): string {
  return `${c.rank === 'T' ? '10' : c.rank}${SUIT_SYMBOL[c.suit]}`;
}

export function parseCard(s: string): Card {
  const rank = s[0];
  const suit = s[1];
  if (s.length !== 2 || !isRank(rank) || !(SUITS as string[]).includes(suit)) throw new Error(`Carta inválida: ${s}`);
  return { rank, suit: suit as Suit };
}
```

`src/domain/format.ts`:
```ts
const pad = (n: number) => String(n).padStart(2, '0');

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtCny(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}¥${Math.abs(n).toFixed(2)}`;
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function fmtNum(n: number | null, digits = 1): string {
  return n === null ? '—' : n.toFixed(digits);
}

export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDecimal(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fromLocalInput(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0).getTime();
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/domain`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(domain): tipos, cartas y formato

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Estadísticas, días de juego, periodos y series

**Files:**
- Create: `src/domain/stats.ts`, `src/domain/backupReminder.ts`
- Test: `src/domain/stats.test.ts`, `src/domain/backupReminder.test.ts`

**Interfaces:**
- Consumes: tipos de la Task 2; `round2`.
- Produces (`stats.ts`):
  - `dayKey(d: Date): string`, `parseDay(s: string): Date`, `addDays(d: Date, n: number): Date`
  - `playingDay(t: number, cutoffHour: number): string`
  - `allinEv(a: AllinData): number`, `handLuck(h: Hand): number`
  - `interface Aggregate { chunks; hands; durationSec; resultCny; cnyPerHour: number|null; bbPer100: number|null; handsPerHour: number|null; allins; luckCny }`
  - `aggregate(chunks: SessionChunk[], hands: Hand[]): Aggregate`
  - `interface DayStats extends Aggregate { day: string }`
  - `groupByDay(chunks, hands, cutoffHour): DayStats[]` (orden descendente)
  - `type Period = { kind: 'week'|'month'|'year'|'all' } | { kind: 'range'; from: string; to: string }`
  - `periodRange(p: Period, today: string): { from: string; to: string } | null`
  - `inRange(day: string, range): boolean`
  - `cumulativeResult(days: DayStats[]): { day: string; cum: number }[]` (orden ascendente)
  - `allinSeries(hands: Hand[]): { n: number; real: number; ev: number }[]`
- Produces (`backupReminder.ts`): `needsBackupReminder(settings: Settings, itemCount: number, now: number): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

`src/domain/stats.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Hand, SessionChunk } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  aggregate, allinEv, allinSeries, cumulativeResult, groupByDay, handLuck, inRange, periodRange, playingDay,
} from './stats';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

function chunk(p: Partial<SessionChunk>): SessionChunk {
  return {
    id: crypto.randomUUID(), startedAt: at(2026, 9, 25, 12), resultCny: -13, hands: 18, durationSec: 133,
    stakes: DEFAULT_SETTINGS.stakes, imageId: 'img', createdAt: 0, ...p,
  };
}

function hand(p: Partial<Hand>): Hand {
  return {
    id: crypto.randomUUID(), handId: crypto.randomUUID(), playedAt: at(2026, 9, 25, 11), heroPosition: 'BTN',
    heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [], heroResultCny: -156.1,
    kind: 'allin', allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
    tags: [], imageId: 'img', createdAt: 0, ...p,
  };
}

describe('playingDay', () => {
  it('asigna la madrugada al día anterior con corte a las 6', () => {
    expect(playingDay(at(2026, 9, 26, 1, 30), 6)).toBe('2026-09-25');
    expect(playingDay(at(2026, 9, 26, 5, 59), 6)).toBe('2026-09-25');
    expect(playingDay(at(2026, 9, 26, 6, 0), 6)).toBe('2026-09-26');
    expect(playingDay(at(2026, 9, 26, 1, 30), 0)).toBe('2026-09-26');
  });
});

describe('EV de all-in', () => {
  it('calcula EV y suerte del ejemplo de la spec', () => {
    expect(allinEv({ street: 'flop', heroEquity: 0.87, potContested: 347.2, heroInvested: 156.1 })).toBe(145.96);
    expect(handLuck(hand({ heroResultCny: 191.1, allin: { street: 'flop', heroEquity: 0.87, potContested: 347.2, heroInvested: 156.1 } }))).toBe(45.14);
    expect(handLuck(hand({}))).toBe(-45.14);
    expect(handLuck(hand({ kind: 'study', allin: undefined }))).toBe(0);
  });
});

describe('aggregate', () => {
  it('calcula métricas del tramo de prueba', () => {
    const a = aggregate([chunk({})], []);
    expect(a).toMatchObject({ chunks: 1, hands: 18, durationSec: 133, resultCny: -13, allins: 0, luckCny: 0 });
    expect(a.cnyPerHour).toBe(-351.88);
    expect(a.bbPer100).toBe(-36.11);
    expect(a.handsPerHour).toBe(487.22);
  });
  it('devuelve null en tasas sin tiempo ni manos', () => {
    const a = aggregate([], []);
    expect(a.cnyPerHour).toBeNull();
    expect(a.bbPer100).toBeNull();
    expect(a.handsPerHour).toBeNull();
  });
  it('suma la suerte de los all-ins y no suma manos al resultado', () => {
    const a = aggregate([chunk({ resultCny: 50 })], [hand({}), hand({ kind: 'study', allin: undefined, heroResultCny: -28 })]);
    expect(a.resultCny).toBe(50);
    expect(a.allins).toBe(1);
    expect(a.luckCny).toBe(-45.14);
  });
});

describe('groupByDay', () => {
  it('agrupa tramos y manos por día de juego, descendente', () => {
    const days = groupByDay(
      [chunk({ startedAt: at(2026, 9, 25, 20), resultCny: 10 }), chunk({ startedAt: at(2026, 9, 26, 2), resultCny: 5 }), chunk({ startedAt: at(2026, 9, 26, 12), resultCny: -3 })],
      [hand({ playedAt: at(2026, 9, 26, 3) })],
      6,
    );
    expect(days.map((d) => d.day)).toEqual(['2026-09-26', '2026-09-25']);
    expect(days[1]).toMatchObject({ chunks: 2, resultCny: 15, allins: 1 });
    expect(days[0]).toMatchObject({ chunks: 1, resultCny: -3, allins: 0 });
  });
});

describe('periodos', () => {
  it('calcula semana ISO, mes y año', () => {
    expect(periodRange({ kind: 'week' }, '2026-09-25')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(periodRange({ kind: 'month' }, '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange({ kind: 'year' }, '2026-09-25')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(periodRange({ kind: 'all' }, '2026-09-25')).toBeNull();
    expect(periodRange({ kind: 'range', from: '2026-09-01', to: '2026-09-10' }, '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-10' });
  });
  it('filtra días por rango inclusivo', () => {
    const r = { from: '2026-09-01', to: '2026-09-30' };
    expect(inRange('2026-09-30', r)).toBe(true);
    expect(inRange('2026-10-01', r)).toBe(false);
    expect(inRange('2020-01-01', null)).toBe(true);
  });
});

describe('series', () => {
  it('acumula resultado por día en orden ascendente', () => {
    const days = groupByDay([chunk({ startedAt: at(2026, 9, 26, 12), resultCny: -3 }), chunk({ startedAt: at(2026, 9, 25, 12), resultCny: 10 })], [], 6);
    expect(cumulativeResult(days)).toEqual([{ day: '2026-09-25', cum: 10 }, { day: '2026-09-26', cum: 7 }]);
  });
  it('acumula real vs EV por all-in, ignorando manos de estudio', () => {
    const s = allinSeries([
      hand({ playedAt: at(2026, 9, 25, 12), heroResultCny: 191.1, allin: { street: 'flop', heroEquity: 0.87, potContested: 347.2, heroInvested: 156.1 } }),
      hand({ playedAt: at(2026, 9, 25, 11) }),
      hand({ kind: 'study', allin: undefined }),
    ]);
    expect(s).toEqual([
      { n: 0, real: 0, ev: 0 },
      { n: 1, real: -156.1, ev: -110.96 },
      { n: 2, real: 35, ev: 35 },
    ]);
  });
});
```

`src/domain/backupReminder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { needsBackupReminder } from './backupReminder';

const DAY = 86_400_000;

describe('needsBackupReminder', () => {
  it('no avisa sin datos', () => {
    expect(needsBackupReminder(DEFAULT_SETTINGS, 0, 10 * DAY)).toBe(false);
  });
  it('avisa si nunca se exportó y hay datos', () => {
    expect(needsBackupReminder(DEFAULT_SETTINGS, 3, 10 * DAY)).toBe(true);
  });
  it('avisa pasados 7 días de la última copia', () => {
    const s = { ...DEFAULT_SETTINGS, lastBackupAt: 0 };
    expect(needsBackupReminder(s, 3, 7 * DAY)).toBe(false);
    expect(needsBackupReminder(s, 3, 7 * DAY + 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/domain`
Expected: FAIL con "Failed to resolve import './stats'".

- [ ] **Step 3: Implementar**

`src/domain/stats.ts`:
```ts
import { round2 } from './format';
import type { AllinData, Hand, SessionChunk } from './types';

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function playingDay(t: number, cutoffHour: number): string {
  return dayKey(new Date(t - cutoffHour * HOUR));
}

export function allinEv(a: AllinData): number {
  return round2(a.heroEquity * a.potContested - a.heroInvested);
}

export function handLuck(h: Hand): number {
  return h.kind === 'allin' && h.allin ? round2(h.heroResultCny - allinEv(h.allin)) : 0;
}

export interface Aggregate {
  chunks: number;
  hands: number;
  durationSec: number;
  resultCny: number;
  cnyPerHour: number | null;
  bbPer100: number | null;
  handsPerHour: number | null;
  allins: number;
  luckCny: number;
}

export interface DayStats extends Aggregate { day: string }

export function aggregate(chunks: SessionChunk[], hands: Hand[]): Aggregate {
  const resultCny = round2(sum(chunks.map((c) => c.resultCny)));
  const handCount = sum(chunks.map((c) => c.hands));
  const durationSec = sum(chunks.map((c) => c.durationSec));
  const resultBb = sum(chunks.map((c) => c.resultCny / c.stakes.bb));
  const hours = durationSec / 3600;
  const allinHands = hands.filter((h) => h.kind === 'allin' && h.allin);
  return {
    chunks: chunks.length,
    hands: handCount,
    durationSec,
    resultCny,
    cnyPerHour: hours > 0 ? round2(resultCny / hours) : null,
    bbPer100: handCount > 0 ? round2((resultBb / handCount) * 100) : null,
    handsPerHour: hours > 0 ? round2(handCount / hours) : null,
    allins: allinHands.length,
    luckCny: round2(sum(allinHands.map(handLuck))),
  };
}

export function groupByDay(chunks: SessionChunk[], hands: Hand[], cutoffHour: number): DayStats[] {
  const groups = new Map<string, { chunks: SessionChunk[]; hands: Hand[] }>();
  const get = (day: string) => {
    let g = groups.get(day);
    if (!g) groups.set(day, (g = { chunks: [], hands: [] }));
    return g;
  };
  for (const c of chunks) get(playingDay(c.startedAt, cutoffHour)).chunks.push(c);
  for (const h of hands) get(playingDay(h.playedAt, cutoffHour)).hands.push(h);
  return [...groups.entries()]
    .map(([day, g]) => ({ day, ...aggregate(g.chunks, g.hands) }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export type Period = { kind: 'week' | 'month' | 'year' | 'all' } | { kind: 'range'; from: string; to: string };

export function periodRange(p: Period, today: string): { from: string; to: string } | null {
  if (p.kind === 'all') return null;
  if (p.kind === 'range') return { from: p.from, to: p.to };
  const d = parseDay(today);
  if (p.kind === 'week') {
    const dow = (d.getDay() + 6) % 7;
    return { from: dayKey(addDays(d, -dow)), to: dayKey(addDays(d, 6 - dow)) };
  }
  if (p.kind === 'month') {
    return { from: dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
}

export function inRange(day: string, range: { from: string; to: string } | null): boolean {
  return !range || (day >= range.from && day <= range.to);
}

export function cumulativeResult(days: DayStats[]): { day: string; cum: number }[] {
  let cum = 0;
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ day: d.day, cum: (cum = round2(cum + d.resultCny)) }));
}

export function allinSeries(hands: Hand[]): { n: number; real: number; ev: number }[] {
  const out = [{ n: 0, real: 0, ev: 0 }];
  let real = 0;
  let ev = 0;
  const allins = hands.filter((h) => h.kind === 'allin' && h.allin).sort((a, b) => a.playedAt - b.playedAt);
  allins.forEach((h, i) => {
    real = round2(real + h.heroResultCny);
    ev = round2(ev + allinEv(h.allin!));
    out.push({ n: i + 1, real, ev });
  });
  return out;
}
```

`src/domain/backupReminder.ts`:
```ts
import type { Settings } from './types';

const WEEK = 7 * 86_400_000;

export function needsBackupReminder(settings: Settings, itemCount: number, now: number): boolean {
  if (itemCount === 0) return false;
  return settings.lastBackupAt === null || now - settings.lastBackupAt > WEEK;
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/domain`
Expected: PASS. Comprobación de las cifras del segundo punto de `allinSeries`: el EV de la mano ganada es 0.87 × 347.2 − 156.1 = 145.96, y −110.96 + 145.96 = 35.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(domain): métricas, días de juego, periodos y series

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Inferencia de bote, posiciones y nombres

**Files:**
- Create: `src/domain/allin.ts`, `src/domain/positions.ts`, `src/parsers/names.ts`
- Test: `src/domain/allin.test.ts`, `src/domain/positions.test.ts`, `src/parsers/names.test.ts`

**Interfaces:**
- Produces:
  - `interface AllinInference { heroInvested: number; potContested: number; ambiguous: boolean }`
  - `inferPot(heroResult: number, others: number[], equityPlayers: number): AllinInference`
  - `positionFromPreflopIndex(index: number, nPlayers: number, straddle: boolean): Position | null`
  - `normalizeName(s: string): string`, `levenshtein(a: string, b: string): number`, `nameMatches(text: string, heroName: string): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

`src/domain/allin.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { inferPot } from './allin';

const OTHERS_WHEN_BTN_HERO = [191.1, -28, -4, -2, -1, 0, 0];
const OTHERS_WHEN_CO_HERO = [-156.1, -28, -4, -2, -1, 0, 0];

describe('inferPot', () => {
  it('héroe pierde heads-up (BTN de la mano de prueba)', () => {
    expect(inferPot(-156.1, OTHERS_WHEN_BTN_HERO, 2)).toEqual({ heroInvested: 156.1, potContested: 347.2, ambiguous: false });
  });
  it('héroe gana heads-up (CO de la mano de prueba)', () => {
    expect(inferPot(191.1, OTHERS_WHEN_CO_HERO, 2)).toEqual({ heroInvested: 156.1, potContested: 347.2, ambiguous: false });
  });
  it('marca ambiguo con 3+ jugadores en el all-in', () => {
    expect(inferPot(-100, [150, -50], 3).ambiguous).toBe(true);
  });
  it('marca ambiguo con bote dividido o resultado cero', () => {
    expect(inferPot(0, [0, -2], 2).ambiguous).toBe(true);
    expect(inferPot(20, [20, -40], 2).ambiguous).toBe(true);
  });
});
```

`src/domain/positions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { positionFromPreflopIndex } from './positions';

describe('positionFromPreflopIndex', () => {
  it('8 jugadores con straddle: el orden empieza en UTG+1', () => {
    expect(positionFromPreflopIndex(0, 8, true)).toBe('UTG+1');
    expect(positionFromPreflopIndex(2, 8, true)).toBe('HJ');
    expect(positionFromPreflopIndex(4, 8, true)).toBe('BTN');
    expect(positionFromPreflopIndex(7, 8, true)).toBe('UTG');
  });
  it('sin straddle el orden empieza en UTG', () => {
    expect(positionFromPreflopIndex(0, 6, false)).toBe('UTG');
    expect(positionFromPreflopIndex(3, 6, false)).toBe('BTN');
  });
  it('devuelve null fuera de rango o con mesas no soportadas', () => {
    expect(positionFromPreflopIndex(8, 8, true)).toBeNull();
    expect(positionFromPreflopIndex(0, 9, true)).toBeNull();
    expect(positionFromPreflopIndex(-1, 8, true)).toBeNull();
  });
});
```

`src/parsers/names.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { nameMatches } from './names';

describe('nameMatches', () => {
  it('coincide exacto e ignorando mayúsculas y signos', () => {
    expect(nameMatches('RacsoSM', 'RacsoSM')).toBe(true);
    expect(nameMatches('racsosm,', 'RacsoSM')).toBe(true);
  });
  it('tolera un error de OCR en nombres de 5+ caracteres', () => {
    expect(nameMatches('RacsoSN', 'RacsoSM')).toBe(true);
    expect(nameMatches('HiTeR2S04', 'HiTeR2504')).toBe(true);
  });
  it('no coincide con otros nombres ni con nombres vacíos', () => {
    expect(nameMatches('Muck1564', 'RacsoSM')).toBe(false);
    expect(nameMatches('RacsoSM', '超激进流')).toBe(false);
    expect(nameMatches('SB', 'SA')).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/domain/allin.test.ts src/domain/positions.test.ts src/parsers/names.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar**

`src/domain/allin.ts`:
```ts
import { round2 } from './format';

export interface AllinInference { heroInvested: number; potContested: number; ambiguous: boolean }

// Spec §4.2: bote e inversión a partir de los resultados netos de la columna RIVER.
export function inferPot(heroResult: number, others: number[], equityPlayers: number): AllinInference {
  const losses = others.filter((r) => r < 0).map((r) => -r);
  const winners = others.filter((r) => r > 0);
  let heroInvested: number;
  let potContested: number;
  if (heroResult < 0) {
    heroInvested = -heroResult;
    potContested = heroInvested + Math.max(0, ...winners);
  } else {
    heroInvested = Math.max(0, ...losses);
    potContested = heroInvested + heroResult;
  }
  const positiveCount = winners.length + (heroResult > 0 ? 1 : 0);
  const ambiguous = equityPlayers > 2 || Math.abs(heroResult) < 0.005 || positiveCount > 1 || heroInvested === 0;
  return { heroInvested: round2(heroInvested), potContested: round2(potContested), ambiguous };
}
```

`src/domain/positions.ts`:
```ts
import type { Position } from './types';

// Asientos en orden desde UTG hasta BB, según el número de jugadores.
const SEATS: Record<number, Position[]> = {
  3: ['BTN', 'SB', 'BB'],
  4: ['UTG', 'BTN', 'SB', 'BB'],
  5: ['UTG', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

// Antes de que el héroe actúe por primera vez, cada fila de PRE-FLOP es un jugador distinto,
// así que el índice de su primera fila es su lugar en el orden de acción preflop.
export function positionFromPreflopIndex(index: number, nPlayers: number, straddle: boolean): Position | null {
  const seats = SEATS[nPlayers];
  if (!seats || index < 0 || index >= nPlayers) return null;
  const order = straddle && nPlayers >= 4 ? [...seats.slice(1), seats[0]] : seats;
  return order[index];
}
```

`src/parsers/names.ts`:
```ts
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function nameMatches(text: string, heroName: string): boolean {
  const a = normalizeName(text);
  const b = normalizeName(heroName);
  if (!b || !a) return false;
  if (a === b) return true;
  return b.length >= 5 && Math.abs(a.length - b.length) <= 1 && levenshtein(a, b) <= 1;
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/domain src/parsers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/parsers
git commit -m "feat: inferencia de bote, posiciones y coincidencia de nombres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Utilidades de imagen y detección de cartas por color

**Files:**
- Create: `src/image/rgba.ts`, `src/image/blob.ts`, `src/vision/cards.ts`, `src/vision/fixtureTruth.ts`, `src/test/imageUtils.ts`
- Test: `src/image/rgba.test.ts`, `src/vision/cards.test.ts`

**Interfaces:**
- Consumes: `Suit`, `SizeClass`, `Rank` (Task 2); `fixtureBytes`, `HAND_PNG` (Task 1).
- Produces:
  - `interface RGBA { width: number; height: number; data: Uint8Array | Uint8ClampedArray }` (4 canales)
  - `interface Rect { x: number; y: number; w: number; h: number }`
  - `decodePng(bytes: Uint8Array): RGBA`
  - `encodePng(img: RGBA): Uint8Array`
  - `pixel(img: RGBA, x: number, y: number): [number, number, number]`
  - `binarize(img: RGBA, rect: Rect, isInk: (r: number, g: number, b: number) => boolean, scale?: number): RGBA`
  - `toBlob(bytes: Uint8Array, mime: string): Blob`
  - `interface CardBlob { suit: Suit; x: number; y: number; w: number; h: number; sizeClass: SizeClass }`
  - `classifyPixel(r: number, g: number, b: number): Suit | null`
  - `detectCards(img: RGBA, maxY: number): CardBlob[]`
  - `FIXTURE_HEADER_TOP = 841`, `FIXTURE_TRUTH: { x: number; y: number; rank: Rank; suit: Suit }[]`
  - `resizeNearest(img: RGBA, factor: number): RGBA`, `addNoise(img: RGBA, amp: number, seed?: number): RGBA`

- [ ] **Step 1: Escribir los tests que fallan**

`src/image/rgba.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { binarize, decodePng, encodePng, pixel } from './rgba';
import { fixtureBytes, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';

describe('rgba', () => {
  it('decodifica los fixtures a RGBA', () => {
    const hand = decodePng(fixtureBytes(HAND_PNG));
    expect([hand.width, hand.height, hand.data.length]).toEqual([1280, 2295, 1280 * 2295 * 4]);
    expect(pixel(hand, 640, 400)).toEqual([139, 25, 25]);
    const sum = decodePng(fixtureBytes(SUMMARY_PNG));
    expect([sum.width, sum.height]).toEqual([469, 363]);
  });
  it('codifica y vuelve a decodificar sin pérdidas', () => {
    const img = { width: 2, height: 1, data: new Uint8Array([1, 2, 3, 255, 250, 251, 252, 255]) };
    expect(decodePng(encodePng(img))).toEqual(img);
  });
  it('binariza: tinta a negro, resto a blanco, con escala', () => {
    const img = { width: 2, height: 1, data: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]) };
    const out = binarize(img, { x: 0, y: 0, w: 2, h: 1 }, (r) => r > 128, 2);
    expect([out.width, out.height]).toEqual([4, 2]);
    expect(pixel(out, 0, 0)).toEqual([0, 0, 0]);
    expect(pixel(out, 3, 1)).toEqual([255, 255, 255]);
  });
});
```

`src/vision/cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { classifyPixel, detectCards } from './cards';
import { decodePng } from '../image/rgba';
import { fixtureBytes, HAND_PNG } from '../test/fixtures';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from './fixtureTruth';
import { resizeNearest } from '../test/imageUtils';

const img = decodePng(fixtureBytes(HAND_PNG));

describe('classifyPixel', () => {
  it('reconoce los 4 colores de carta y descarta fondos y glifos', () => {
    expect(classifyPixel(4, 121, 43)).toBe('c');
    expect(classifyPixel(19, 85, 169)).toBe('d');
    expect(classifyPixel(139, 25, 25)).toBe('h');
    expect(classifyPixel(28, 28, 28)).toBe('s');
    expect(classifyPixel(86, 54, 30)).toBeNull();
    expect(classifyPixel(233, 225, 209)).toBeNull();
    expect(classifyPixel(38, 40, 54)).toBeNull();
  });
});

describe('detectCards', () => {
  it('encuentra las 11 cartas grandes del fixture con su palo', () => {
    const cards = detectCards(img, FIXTURE_HEADER_TOP);
    expect(cards).toHaveLength(11);
    for (const t of FIXTURE_TRUTH) {
      const c = cards.find((k) => Math.abs(k.x - t.x) <= 8 && Math.abs(k.y - t.y) <= 8);
      expect(c, `carta en ${t.x},${t.y}`).toBeDefined();
      expect(c!.suit).toBe(t.suit);
    }
    const board = cards.filter((c) => c.sizeClass === 'board').sort((a, b) => a.x - b.x);
    expect(board.map((c) => c.suit)).toEqual(['c', 'd', 'h', 'c', 'd']);
    expect(cards.filter((c) => c.sizeClass === 'hole')).toHaveLength(6);
  });
  it('sigue funcionando con la captura reescalada a 0.75', () => {
    const small = resizeNearest(img, 0.75);
    const cards = detectCards(small, Math.round(FIXTURE_HEADER_TOP * 0.75));
    expect(cards).toHaveLength(11);
    expect(cards.filter((c) => c.sizeClass === 'board')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/image src/vision`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar**

`src/image/rgba.ts`:
```ts
import { decode, encode } from 'fast-png';

export interface RGBA { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export interface Rect { x: number; y: number; w: number; h: number }

export function decodePng(bytes: Uint8Array): RGBA {
  const p = decode(bytes);
  if (p.depth !== 8) throw new Error(`PNG de ${p.depth} bits no soportado`);
  if (p.palette) throw new Error('PNG con paleta no soportado');
  const c = p.channels;
  const src = p.data as Uint8Array;
  if (c === 4) return { width: p.width, height: p.height, data: src };
  const n = p.width * p.height;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = src[i * c];
    data[i * 4] = r;
    data[i * 4 + 1] = c >= 3 ? src[i * c + 1] : r;
    data[i * 4 + 2] = c >= 3 ? src[i * c + 2] : r;
    data[i * 4 + 3] = c === 2 ? src[i * c + 1] : 255;
  }
  return { width: p.width, height: p.height, data };
}

export function encodePng(img: RGBA): Uint8Array {
  return encode({ width: img.width, height: img.height, data: img.data, channels: 4, depth: 8 });
}

export function pixel(img: RGBA, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function binarize(
  img: RGBA,
  rect: Rect,
  isInk: (r: number, g: number, b: number) => boolean,
  scale = 1,
): RGBA {
  const width = rect.w * scale;
  const height = rect.h * scale;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(img, rect.x + Math.floor(x / scale), rect.y + Math.floor(y / scale));
      const v = isInk(r, g, b) ? 0 : 255;
      const o = (y * width + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}
```

`src/image/blob.ts`:
```ts
export function toBlob(bytes: Uint8Array, mime: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime });
}
```

`src/vision/cards.ts`:
```ts
import type { SizeClass, Suit } from '../domain/types';
import type { RGBA } from '../image/rgba';

export interface CardBlob { suit: Suit; x: number; y: number; w: number; h: number; sizeClass: SizeClass }

const SUIT_CODES: Suit[] = ['s', 'h', 'd', 'c'];

// Baraja de 4 colores de WPT (spec §10a).
export function classifyPixel(r: number, g: number, b: number): Suit | null {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 45 && mx - mn < 12) return 's';
  if (mx - mn < 60) return null;
  if (r > 110 && g < 70 && b < 70) return 'h';
  if (g > r && g > b && g > 90) return 'c';
  if (b > r && b > g && b > 120) return 'd';
  return null;
}

export function detectCards(img: RGBA, maxY: number): CardBlob[] {
  const W = img.width;
  const H = Math.min(img.height, Math.max(0, Math.floor(maxY)));
  const s = W / 1280;
  const cls = new Int8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const suit = classifyPixel(img.data[p * 4], img.data[p * 4 + 1], img.data[p * 4 + 2]);
    cls[p] = suit ? SUIT_CODES.indexOf(suit) + 1 : 0;
  }
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const out: CardBlob[] = [];
  for (let start = 0; start < W * H; start++) {
    const c = cls[start];
    if (!c || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let n = 0;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (top > 0) {
      const q = stack[--top];
      n++;
      const qx = q % W;
      const qy = (q - qx) / W;
      if (qx < x0) x0 = qx;
      if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy;
      if (qy > y1) y1 = qy;
      const neigh = [qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1, qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1];
      for (const nq of neigh) {
        if (nq >= 0 && !seen[nq] && cls[nq] === c) {
          seen[nq] = 1;
          stack[top++] = nq;
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const ratio = h / w;
    if (w >= 25 * s && h >= 35 * s && ratio > 1.1 && ratio < 1.9 && n / (w * h) > 0.45 && h <= 0.15 * W) {
      out.push({ suit: SUIT_CODES[c - 1], x: x0, y: y0, w, h, sizeClass: h / W >= 0.09 ? 'board' : 'hole' });
    }
  }
  return out;
}
```

`src/vision/fixtureTruth.ts`:
```ts
import type { Rank, Suit } from '../domain/types';

// Verdad del fixture hand-1323539300829384704.png (coordenadas de la prueba de OCR, ±8 px).
export const FIXTURE_HEADER_TOP = 841;

export const FIXTURE_TRUTH: { x: number; y: number; rank: Rank; suit: Suit }[] = [
  { x: 77, y: 307, rank: 'K', suit: 's' },
  { x: 124, y: 306, rank: 'Q', suit: 's' },
  { x: 392, y: 330, rank: '5', suit: 'c' },
  { x: 493, y: 330, rank: 'Q', suit: 'd' },
  { x: 596, y: 332, rank: '8', suit: 'h' },
  { x: 695, y: 330, rank: '4', suit: 'c' },
  { x: 796, y: 330, rank: '3', suit: 'd' },
  { x: 237, y: 494, rank: 'A', suit: 'h' },
  { x: 283, y: 491, rank: 'Q', suit: 'c' },
  { x: 576, y: 588, rank: 'A', suit: 'd' },
  { x: 623, y: 587, rank: '8', suit: 'c' },
];
```

`src/test/imageUtils.ts`:
```ts
import type { RGBA } from '../image/rgba';

export function resizeNearest(img: RGBA, factor: number): RGBA {
  const width = Math.round(img.width * factor);
  const height = Math.round(img.height * factor);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / factor));
      const sy = Math.min(img.height - 1, Math.floor(y / factor));
      const si = (sy * img.width + sx) * 4;
      data.set(img.data.subarray(si, si + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function addNoise(img: RGBA, amp: number, seed = 42): RGBA {
  let state = seed;
  const rand = () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const data = new Uint8Array(img.data);
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) continue;
    data[i] = Math.max(0, Math.min(255, data[i] + Math.round((rand() * 2 - 1) * amp)));
  }
  return { width: img.width, height: img.height, data };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/image src/vision`
Expected: PASS. Si falla el conteo de cartas, **no ajustes los umbrales a ciegas**: imprime los blobs candidatos (clase, bbox y relleno) y compáralos con `FIXTURE_TRUTH`, siguiendo superpowers:systematic-debugging.

- [ ] **Step 5: Commit**

```bash
git add src/image src/vision src/test/imageUtils.ts
git commit -m "feat(vision): decodificación PNG y detección de cartas por color

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Plantillas de rango (glifos) y semillas

**Files:**
- Create: `src/vision/glyph.ts`, `scripts/make-seed-templates.ts`, `src/vision/seedTemplates.json` (generado), `src/vision/seeds.ts`
- Test: `src/vision/glyph.test.ts`

**Interfaces:**
- Consumes: `RGBA`, `pixel` (Task 5); `CardBlob`, `detectCards`, `FIXTURE_TRUTH`, `FIXTURE_HEADER_TOP` (Task 5).
- Produces:
  - `GLYPH_W = 16`, `GLYPH_H = 24`, `RANK_MATCH_MAX = 0.15`
  - `type Glyph = Uint8Array` (valores 0/1, largo 384)
  - `interface RankTemplate { rank: Rank; sizeClass: SizeClass; glyph: Glyph }`
  - `extractGlyph(img: RGBA, card: CardBlob): Glyph | null`
  - `glyphDistance(a: Glyph, b: Glyph): number`
  - `matchRank(g: Glyph, sizeClass: SizeClass, templates: RankTemplate[]): { rank: Rank; distance: number } | null`
  - `glyphToString(g: Glyph): string`, `glyphFromString(s: string): Glyph`
  - `loadSeedTemplates(): RankTemplate[]`

- [ ] **Step 1: Escribir el test que falla**

`src/vision/glyph.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, HAND_PNG } from '../test/fixtures';
import { detectCards } from './cards';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from './fixtureTruth';
import { extractGlyph, glyphFromString, glyphToString, matchRank, type RankTemplate } from './glyph';
import { loadSeedTemplates } from './seeds';

const img = decodePng(fixtureBytes(HAND_PNG));
const cards = detectCards(img, FIXTURE_HEADER_TOP);
const labeled = FIXTURE_TRUTH.map((t) => {
  const card = cards.find((c) => Math.abs(c.x - t.x) <= 8 && Math.abs(c.y - t.y) <= 8)!;
  return { ...t, card, glyph: extractGlyph(img, card)! };
});

describe('glyph', () => {
  it('extrae un glifo de 16x24 por carta', () => {
    for (const l of labeled) expect(l.glyph).toHaveLength(384);
  });
  it('serializa ida y vuelta', () => {
    const g = labeled[0].glyph;
    expect(glyphFromString(glyphToString(g))).toEqual(g);
  });
  it('leave-one-out: acierta los rangos repetidos y no inventa los únicos', () => {
    for (const l of labeled) {
      const others: RankTemplate[] = labeled
        .filter((o) => o !== l)
        .map((o) => ({ rank: o.rank, sizeClass: o.card.sizeClass, glyph: o.glyph }));
      const hasTwin = others.some((o) => o.rank === l.rank && o.sizeClass === l.card.sizeClass);
      const m = matchRank(l.glyph, l.card.sizeClass, others);
      if (hasTwin) expect(m?.rank, `${l.rank} en ${l.x},${l.y}`).toBe(l.rank);
      else expect(m, `${l.rank} en ${l.x},${l.y}`).toBeNull();
    }
  });
  it('las semillas reconocen todas las cartas del fixture', () => {
    const seeds = loadSeedTemplates();
    for (const l of labeled) expect(matchRank(l.glyph, l.card.sizeClass, seeds)?.rank).toBe(l.rank);
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npx vitest run src/vision/glyph.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar `src/vision/glyph.ts`**

```ts
import type { Rank, SizeClass } from '../domain/types';
import { pixel, type RGBA } from '../image/rgba';
import type { CardBlob } from './cards';

export const GLYPH_W = 16;
export const GLYPH_H = 24;
export const RANK_MATCH_MAX = 0.15;

export type Glyph = Uint8Array;
export interface RankTemplate { rank: Rank; sizeClass: SizeClass; glyph: Glyph }

interface Comp { x0: number; y0: number; x1: number; y1: number }

// Recorta la esquina superior izquierda (rango), toma los trazos claros como tinta,
// descarta componentes pequeños (restos del palo, antialias) y normaliza a 16x24.
export function extractGlyph(img: RGBA, card: CardBlob): Glyph | null {
  const cw = Math.min(card.w, Math.round(card.h * 0.62));
  const ch = Math.round(card.h * 0.5);
  const ink = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const [r, g, b] = pixel(img, card.x + x, card.y + y);
      ink[y * cw + x] = Math.min(r, g, b) > 150 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(cw * ch);
  const comps: Comp[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const c: Comp = { x0: cw, y0: ch, x1: 0, y1: 0 };
    while (stack.length) {
      const q = stack.pop()!;
      const qx = q % cw;
      const qy = (q - qx) / cw;
      c.x0 = Math.min(c.x0, qx); c.x1 = Math.max(c.x1, qx);
      c.y0 = Math.min(c.y0, qy); c.y1 = Math.max(c.y1, qy);
      const neigh = [qx > 0 ? q - 1 : -1, qx < cw - 1 ? q + 1 : -1, qy > 0 ? q - cw : -1, qy < ch - 1 ? q + cw : -1];
      for (const nq of neigh) {
        if (nq >= 0 && ink[nq] && !seen[nq]) {
          seen[nq] = 1;
          stack.push(nq);
        }
      }
    }
    comps.push(c);
  }
  if (comps.length === 0) return null;
  const maxH = Math.max(...comps.map((c) => c.y1 - c.y0));
  const keep = comps.filter((c) => c.y1 - c.y0 >= maxH * 0.6);
  const bx0 = Math.min(...keep.map((c) => c.x0));
  const bx1 = Math.max(...keep.map((c) => c.x1));
  const by0 = Math.min(...keep.map((c) => c.y0));
  const by1 = Math.max(...keep.map((c) => c.y1));
  const g = new Uint8Array(GLYPH_W * GLYPH_H);
  for (let y = 0; y < GLYPH_H; y++) {
    for (let x = 0; x < GLYPH_W; x++) {
      const sx = bx0 + Math.floor(((x + 0.5) * (bx1 - bx0 + 1)) / GLYPH_W);
      const sy = by0 + Math.floor(((y + 0.5) * (by1 - by0 + 1)) / GLYPH_H);
      g[y * GLYPH_W + x] = ink[sy * cw + sx];
    }
  }
  return g;
}

export function glyphDistance(a: Glyph, b: Glyph): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d / a.length;
}

export function matchRank(g: Glyph, sizeClass: SizeClass, templates: RankTemplate[]): { rank: Rank; distance: number } | null {
  let best: { rank: Rank; distance: number } | null = null;
  for (const t of templates) {
    if (t.sizeClass !== sizeClass) continue;
    const distance = glyphDistance(g, t.glyph);
    if (!best || distance < best.distance) best = { rank: t.rank, distance };
  }
  return best && best.distance <= RANK_MATCH_MAX ? best : null;
}

export function glyphToString(g: Glyph): string {
  return Array.from(g).join('');
}

export function glyphFromString(s: string): Glyph {
  return Uint8Array.from(s, (ch) => (ch === '1' ? 1 : 0));
}
```

- [ ] **Step 4: Crear y ejecutar el generador de semillas `scripts/make-seed-templates.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { decodePng } from '../src/image/rgba';
import { detectCards } from '../src/vision/cards';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from '../src/vision/fixtureTruth';
import { extractGlyph, glyphToString } from '../src/vision/glyph';
import { fixtureBytes, HAND_PNG } from '../src/test/fixtures';

const img = decodePng(fixtureBytes(HAND_PNG));
const cards = detectCards(img, FIXTURE_HEADER_TOP);
const seen = new Set<string>();
const seeds: { rank: string; sizeClass: string; glyph: string }[] = [];
for (const t of FIXTURE_TRUTH) {
  const card = cards.find((c) => Math.abs(c.x - t.x) <= 8 && Math.abs(c.y - t.y) <= 8);
  if (!card) throw new Error(`Carta no encontrada en ${t.x},${t.y}`);
  const key = `${t.rank}-${card.sizeClass}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const g = extractGlyph(img, card);
  if (!g) throw new Error(`Sin glifo en ${t.x},${t.y}`);
  seeds.push({ rank: t.rank, sizeClass: card.sizeClass, glyph: glyphToString(g) });
}
writeFileSync('src/vision/seedTemplates.json', JSON.stringify(seeds, null, 1) + '\n');
console.log(`Semillas escritas: ${seeds.map((s) => `${s.rank}/${s.sizeClass}`).join(', ')}`);
```

Run: `npx tsx scripts/make-seed-templates.ts`
Expected: `Semillas escritas: K/hole, Q/hole, 5/board, Q/board, 8/board, 4/board, 3/board, A/hole, 8/hole`

- [ ] **Step 5: Crear `src/vision/seeds.ts`**

```ts
import type { Rank, SizeClass } from '../domain/types';
import { glyphFromString, type RankTemplate } from './glyph';
import seeds from './seedTemplates.json';

export function loadSeedTemplates(): RankTemplate[] {
  return (seeds as unknown as { rank: Rank; sizeClass: SizeClass; glyph: string }[]).map((s) => ({
    rank: s.rank,
    sizeClass: s.sizeClass,
    glyph: glyphFromString(s.glyph),
  }));
}
```

- [ ] **Step 6: Ejecutar los tests**

Run: `npx vitest run src/vision`
Expected: PASS. Según la prueba de OCR, las distancias dentro de la misma clase son ≤ 0.091 entre rangos iguales y ≥ 0.19 entre distintos.

- [ ] **Step 7: Commit**

```bash
git add src/vision scripts/make-seed-templates.ts
git commit -m "feat(vision): reconocimiento de rango por plantillas y semillas del fixture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Detección de filas y layout de la mano

**Files:**
- Create: `src/ocr/types.ts`, `src/vision/rows.ts`, `src/parsers/handLayout.ts`
- Test: `src/vision/rows.test.ts`, `src/parsers/handLayout.test.ts`

**Interfaces:**
- Consumes: `RGBA`, `Rect`, `pixel`, `detectCards`, `extractGlyph`, `matchRank`, `glyphToString`, `RankTemplate`, `loadSeedTemplates`.
- Produces:
  - `interface OcrWord { text: string; conf: number; x0: number; y0: number; x1: number; y1: number }`
  - `interface RowBox { y0: number; y1: number }`
  - `detectRows(img: RGBA, rect: Rect): RowBox[]`
  - `LAYOUT_COLUMNS = ['blinds', 'preflop', 'flop', 'turn', 'river'] as const`, `type LayoutColumn`
  - `interface LayoutCard extends CardBlob { rank: Rank | null; glyph: string | null }`
  - `interface HandLayout { width; height; headerTop; headerBottom; columns: Record<LayoutColumn, { rect: Rect; rows: RowBox[] }>; cards: LayoutCard[] }`
  - `findHeader(full: OcrWord[]): { top: number; bottom: number } | null`
  - `columnRect(width: number, height: number, col: LayoutColumn, top: number): Rect`
  - `buildHandLayout(img: RGBA, full: OcrWord[], templates: RankTemplate[]): HandLayout | null`

- [ ] **Step 1: Escribir los tests que fallan**

`src/vision/rows.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, HAND_PNG } from '../test/fixtures';
import { addNoise, resizeNearest } from '../test/imageUtils';
import { columnRect, LAYOUT_COLUMNS } from '../parsers/handLayout';
import { detectRows } from './rows';

const img = decodePng(fixtureBytes(HAND_PNG));
const EXPECTED = { blinds: 4, preflop: 8, flop: 9, turn: 3, river: 8 };

function counts(image: typeof img, top: number) {
  return Object.fromEntries(
    LAYOUT_COLUMNS.map((col) => [col, detectRows(image, columnRect(image.width, image.height, col, top)).length]),
  );
}

describe('detectRows', () => {
  it('cuenta las filas de cada columna del fixture', () => {
    expect(counts(img, 864)).toEqual(EXPECTED);
  });
  it('ubica la fila de RacsoSM en PRE-FLOP (tercera fila)', () => {
    const rows = detectRows(img, columnRect(img.width, img.height, 'preflop', 864));
    expect(rows[2].y0).toBeLessThanOrEqual(1193);
    expect(rows[2].y1).toBeGreaterThanOrEqual(1210);
  });
  it('tolera ruido de color tipo JPEG (±2)', () => {
    expect(counts(addNoise(img, 2), 864)).toEqual(EXPECTED);
  });
  it('escala con la resolución (×0.75)', () => {
    const small = resizeNearest(img, 0.75);
    expect(counts(small, Math.round(864 * 0.75))).toEqual(EXPECTED);
  });
});
```

`src/parsers/handLayout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, HAND_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import type { OcrWord } from '../ocr/types';
import { buildHandLayout, columnRect, findHeader } from './handLayout';

const w = (text: string, x0: number, y0: number, x1: number, y1: number): OcrWord => ({ text, conf: 95, x0, y0, x1, y1 });
const HEADERS = [w('PRE-FLOP', 332, 841, 418, 860), w('FLOP', 610, 841, 652, 860), w('TURN', 861, 841, 910, 860), w('RIVER', 1113, 841, 1166, 860)];

describe('handLayout', () => {
  it('encuentra la cabecera de columnas', () => {
    expect(findHeader(HEADERS)).toEqual({ top: 841, bottom: 864 });
    expect(findHeader([w('FLOP', 0, 0, 1, 1)])).toBeNull();
  });
  it('divide el ancho en 5 columnas', () => {
    expect(columnRect(1280, 2295, 'river', 864)).toEqual({ x: 1024, y: 864, w: 256, h: 1431 });
    expect(columnRect(1280, 2295, 'blinds', 864)).toEqual({ x: 0, y: 864, w: 256, h: 1431 });
  });
  it('construye el layout con cartas reconocidas y filas', () => {
    const img = decodePng(fixtureBytes(HAND_PNG));
    const layout = buildHandLayout(img, HEADERS, loadSeedTemplates())!;
    expect(layout.headerTop).toBe(841);
    expect(layout.columns.river.rows).toHaveLength(8);
    expect(layout.cards).toHaveLength(11);
    expect(layout.cards.every((c) => c.rank !== null && c.glyph !== null)).toBe(true);
  });
  it('devuelve null sin cabecera', () => {
    const img = decodePng(fixtureBytes(HAND_PNG));
    expect(buildHandLayout(img, [], loadSeedTemplates())).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/vision/rows.test.ts src/parsers/handLayout.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar**

`src/ocr/types.ts`:
```ts
export interface OcrWord { text: string; conf: number; x0: number; y0: number; x1: number; y1: number }
```

`src/vision/rows.ts`:
```ts
import { pixel, type RGBA, type Rect } from '../image/rgba';

export interface RowBox { y0: number; y1: number }

function modeColor(img: RGBA, x: number, y0: number, y1: number): [number, number, number] {
  const freq = new Map<string, number>();
  for (let y = y0; y < y1; y++) {
    const key = pixel(img, x, y).join(',');
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const [best] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  return best.split(',').map(Number) as [number, number, number];
}

// Las filas son recuadros (≈38,40,54) sobre el fondo de la columna (≈31,33,46).
// Una línea es "hueco" si ≥97% de las muestras están a ≤4 del color de fondo.
export function detectRows(img: RGBA, rect: Rect): RowBox[] {
  const s = img.width / 1280;
  const y0 = Math.max(0, rect.y);
  const y1 = Math.min(img.height, rect.y + rect.h);
  const bg = modeColor(img, rect.x + Math.round(5 * s), y0, y1);
  const xs: number[] = [];
  for (let x = Math.round(rect.x + rect.w * 0.1); x < rect.x + rect.w * 0.9; x += 6) xs.push(x);
  const minH = 60 * s;
  const rows: RowBox[] = [];
  let start = -1;
  for (let y = y0; y < y1; y++) {
    let near = 0;
    for (const x of xs) {
      const [r, g, b] = pixel(img, x, y);
      if (Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) <= 4) near++;
    }
    const gap = near / xs.length >= 0.97;
    if (!gap && start < 0) start = y;
    if (gap && start >= 0) {
      if (y - start >= minH) rows.push({ y0: start, y1: y - 1 });
      start = -1;
    }
  }
  if (start >= 0 && y1 - start >= minH) rows.push({ y0: start, y1: y1 - 1 });
  return rows;
}
```

`src/parsers/handLayout.ts`:
```ts
import type { Rank } from '../domain/types';
import type { RGBA, Rect } from '../image/rgba';
import type { OcrWord } from '../ocr/types';
import { detectCards, type CardBlob } from '../vision/cards';
import { extractGlyph, glyphToString, matchRank, type RankTemplate } from '../vision/glyph';
import { detectRows, type RowBox } from '../vision/rows';

export const LAYOUT_COLUMNS = ['blinds', 'preflop', 'flop', 'turn', 'river'] as const;
export type LayoutColumn = (typeof LAYOUT_COLUMNS)[number];

export interface LayoutCard extends CardBlob { rank: Rank | null; glyph: string | null }

export interface HandLayout {
  width: number;
  height: number;
  headerTop: number;
  headerBottom: number;
  columns: Record<LayoutColumn, { rect: Rect; rows: RowBox[] }>;
  cards: LayoutCard[];
}

export function findHeader(full: OcrWord[]): { top: number; bottom: number } | null {
  const hs = full.filter((w) => /^(PRE-?FLOP|FLOP|TURN|RIVER)$/i.test(w.text));
  if (hs.length < 2) return null;
  return { top: Math.min(...hs.map((w) => w.y0)), bottom: Math.max(...hs.map((w) => w.y1)) + 4 };
}

export function columnRect(width: number, height: number, col: LayoutColumn, top: number): Rect {
  const i = LAYOUT_COLUMNS.indexOf(col);
  const x0 = Math.round((i * width) / 5);
  const x1 = Math.round(((i + 1) * width) / 5);
  return { x: x0, y: top, w: x1 - x0, h: height - top };
}

export function buildHandLayout(img: RGBA, full: OcrWord[], templates: RankTemplate[]): HandLayout | null {
  const header = findHeader(full);
  if (!header) return null;
  const cards = detectCards(img, header.top).map((c): LayoutCard => {
    const g = extractGlyph(img, c);
    return { ...c, rank: g ? (matchRank(g, c.sizeClass, templates)?.rank ?? null) : null, glyph: g ? glyphToString(g) : null };
  });
  const columns = Object.fromEntries(
    LAYOUT_COLUMNS.map((col) => {
      const rect = columnRect(img.width, img.height, col, header.bottom);
      return [col, { rect, rows: detectRows(img, rect) }];
    }),
  ) as HandLayout['columns'];
  return { width: img.width, height: img.height, headerTop: header.top, headerBottom: header.bottom, columns, cards };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/vision src/parsers`
Expected: PASS. Los conteos esperados salen de la prueba: blinds 4, preflop 8, flop 9, turn 3, river 8.

- [ ] **Step 5: Commit**

```bash
git add src/ocr/types.ts src/vision/rows.ts src/vision/rows.test.ts src/parsers/handLayout.ts src/parsers/handLayout.test.ts
git commit -m "feat(vision): detección de filas por columna y layout de la mano

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Motor OCR, pasada por columnas y fixtures OCR congelados

**Files:**
- Create: `src/ocr/engine.ts`, `src/ocr/columns.ts`, `src/ocr/nodePaths.ts`, `scripts/dump-ocr.ts`
- Generate: `tests/fixtures/session-summary-01.ocr.json`, `tests/fixtures/hand-1323539300829384704.ocr.json`
- Test: `src/ocr/engine.ocr.test.ts` (lento; se ejecuta con `npm run test:ocr`)

**Interfaces:**
- Consumes: `OcrWord`, `HandLayout`, `LAYOUT_COLUMNS`, `LayoutColumn`, `binarize`, `encodePng`, `decodePng`, `buildHandLayout`, `loadSeedTemplates`, `toBlob`.
- Produces:
  - `type OcrMode = 'block' | 'sparse'`
  - `interface OcrEngine { recognize(image: Uint8Array, mode: OcrMode): Promise<OcrWord[]>; terminate(): Promise<void> }`
  - `interface OcrEnginePaths { workerPath?: string; corePath?: string; langPath?: string; cacheMethod?: string }`
  - `createOcrEngine(paths?: OcrEnginePaths): Promise<OcrEngine>`
  - `COLUMN_SCALE = 2`
  - `ocrColumns(engine: OcrEngine, img: RGBA, layout: HandLayout): Promise<Record<LayoutColumn, OcrWord[]>>`
  - `nodeOcrPaths(): OcrEnginePaths`
  - Fixtures: `{ full: OcrWord[] }` para el resumen y `{ full: OcrWord[]; columns: Record<LayoutColumn, OcrWord[]> }` para la mano

- [ ] **Step 1: Escribir el test de integración (lento) que falla**

`src/ocr/engine.ocr.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { buildHandLayout } from '../parsers/handLayout';
import { fixtureBytes, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { ocrColumns } from './columns';
import { createOcrEngine, type OcrEngine } from './engine';
import { nodeOcrPaths } from './nodePaths';

let engine: OcrEngine;
beforeAll(async () => { engine = await createOcrEngine(nodeOcrPaths()); });
afterAll(async () => { await engine.terminate(); });

describe('OCR real sobre los fixtures', () => {
  it('lee el resumen', async () => {
    const text = (await engine.recognize(fixtureBytes(SUMMARY_PNG), 'block')).map((w) => w.text).join(' ');
    expect(text).toContain('-CN¥13.00');
    expect(text).toMatch(/18\s+hands/);
    expect(text).toContain('00:02:13');
  });
  it('lee cabecera, héroe y porcentajes de la mano', async () => {
    const full = await engine.recognize(fixtureBytes(HAND_PNG), 'block');
    const texts = full.map((w) => w.text);
    expect(texts).toContain('1323539300829384704');
    expect(texts).toContain('RacsoSM');
    expect(texts).toContain('13%');
    expect(texts).toContain('87%');
    const img = decodePng(fixtureBytes(HAND_PNG));
    const layout = buildHandLayout(img, full, loadSeedTemplates())!;
    const cols = await ocrColumns(engine, img, layout);
    const river = cols.river.map((w) => w.text).join(' ');
    expect(river).toMatch(/\+¥\s?191\.10/);
    expect(river).toMatch(/-¥\s?28\.00/);
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npm run test:ocr`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar**

`src/ocr/engine.ts`:
```ts
import { createWorker, OEM, PSM, type Page } from 'tesseract.js';
import { toBlob } from '../image/blob';
import type { OcrWord } from './types';

export type OcrMode = 'block' | 'sparse';

export interface OcrEngine {
  recognize(image: Uint8Array, mode: OcrMode): Promise<OcrWord[]>;
  terminate(): Promise<void>;
}

export interface OcrEnginePaths { workerPath?: string; corePath?: string; langPath?: string; cacheMethod?: string }

export function pageWords(page: Page): OcrWord[] {
  const out: OcrWord[] = [];
  for (const b of page.blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        for (const w of l.words) {
          if (!w.text.trim()) continue;
          out.push({ text: w.text, conf: Math.round(w.confidence), x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
        }
      }
    }
  }
  return out;
}

export async function createOcrEngine(paths: OcrEnginePaths = {}): Promise<OcrEngine> {
  const worker = await createWorker('eng', OEM.LSTM_ONLY, paths);
  return {
    async recognize(image, mode) {
      // SINGLE_BLOCK es el modo por defecto de tesseract.js y el que usó la prueba (spec §10a).
      await worker.setParameters({ tessedit_pageseg_mode: mode === 'sparse' ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK });
      const input =
        typeof window === 'undefined'
          ? (globalThis as unknown as { Buffer: { from(b: Uint8Array): Buffer } }).Buffer.from(image)
          : toBlob(image, 'image/png');
      const { data } = await worker.recognize(input, {}, { blocks: true });
      return pageWords(data);
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
```

`src/ocr/columns.ts`:
```ts
import { binarize, encodePng, type RGBA } from '../image/rgba';
import { LAYOUT_COLUMNS, type HandLayout, type LayoutColumn } from '../parsers/handLayout';
import type { OcrEngine } from './engine';
import type { OcrWord } from './types';

export const COLUMN_SCALE = 2;
const lightText = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b > 140;

// Segunda pasada (spec §10a): cada columna recortada, binarizada, ×2 y en modo sparse.
// Devuelve las palabras en coordenadas de la imagen original.
export async function ocrColumns(engine: OcrEngine, img: RGBA, layout: HandLayout): Promise<Record<LayoutColumn, OcrWord[]>> {
  const out = {} as Record<LayoutColumn, OcrWord[]>;
  for (const col of LAYOUT_COLUMNS) {
    const rect = layout.columns[col].rect;
    const png = encodePng(binarize(img, rect, lightText, COLUMN_SCALE));
    const words = await engine.recognize(png, 'sparse');
    out[col] = words.map((w) => ({
      ...w,
      x0: Math.round(rect.x + w.x0 / COLUMN_SCALE),
      y0: Math.round(rect.y + w.y0 / COLUMN_SCALE),
      x1: Math.round(rect.x + w.x1 / COLUMN_SCALE),
      y1: Math.round(rect.y + w.y1 / COLUMN_SCALE),
    }));
  }
  return out;
}
```

`src/ocr/nodePaths.ts`:
```ts
import { resolve } from 'node:path';
import type { OcrEnginePaths } from './engine';

// Solo para Node (scripts y tests): datos de idioma locales, sin red ni caché.
export function nodeOcrPaths(): OcrEnginePaths {
  return { langPath: resolve(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'), cacheMethod: 'none' };
}
```

`scripts/dump-ocr.ts`:
```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng } from '../src/image/rgba';
import { ocrColumns } from '../src/ocr/columns';
import { createOcrEngine } from '../src/ocr/engine';
import { nodeOcrPaths } from '../src/ocr/nodePaths';
import { buildHandLayout } from '../src/parsers/handLayout';
import { FIXTURES_DIR, fixtureBytes, HAND_PNG, SUMMARY_PNG } from '../src/test/fixtures';
import { loadSeedTemplates } from '../src/vision/seeds';

const engine = await createOcrEngine(nodeOcrPaths());
const write = (name: string, data: unknown) => writeFileSync(resolve(FIXTURES_DIR, name), JSON.stringify(data, null, 1) + '\n');

write('session-summary-01.ocr.json', { full: await engine.recognize(fixtureBytes(SUMMARY_PNG), 'block') });

const handBytes = fixtureBytes(HAND_PNG);
const full = await engine.recognize(handBytes, 'block');
const img = decodePng(handBytes);
const layout = buildHandLayout(img, full, loadSeedTemplates());
if (!layout) throw new Error('No se encontró la cabecera de columnas en la mano');
write('hand-1323539300829384704.ocr.json', { full, columns: await ocrColumns(engine, img, layout) });

await engine.terminate();
console.log('Fixtures OCR generados');
```

- [ ] **Step 4: Ejecutar el test de OCR y generar los fixtures**

Run: `npm run test:ocr`
Expected: PASS (2 tests, unos 30–90 s).

Run: `npx tsx scripts/dump-ocr.ts`
Expected: `Fixtures OCR generados`. Dentro de `hand-1323539300829384704.ocr.json`, `full` contiene `RacsoSM`, `13%`, `87%`, `7%`, `93%`, `STR` y `2026-09-25`, y `columns.river` contiene `191.10` y `28.00`.

- [ ] **Step 5: Verificar typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/ocr scripts/dump-ocr.ts tests/fixtures/*.ocr.json
git commit -m "feat(ocr): motor Tesseract, pasada por columnas y fixtures OCR congelados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Detección de tipo y parser del resumen

**Files:**
- Create: `src/parsers/words.ts`, `src/parsers/money.ts`, `src/parsers/detect.ts`, `src/parsers/summary.ts`
- Test: `src/parsers/words.test.ts`, `src/parsers/detect.test.ts`, `src/parsers/summary.test.ts`

**Interfaces:**
- Consumes: `OcrWord`; fixture `session-summary-01.ocr.json`.
- Produces:
  - `readingOrder(words: OcrWord[]): OcrWord[]`
  - `SIGN` (clase regex de signos), `isNegativeSign(s: string | undefined): boolean`
  - `detectKind(words: OcrWord[]): 'summary' | 'hand' | 'unknown'`
  - `type SummaryField = 'resultCny' | 'hands' | 'durationSec'`
  - `interface SummaryDraft { resultCny: number | null; hands: number | null; durationSec: number | null; uncertain: SummaryField[] }`
  - `parseSummary(words: OcrWord[]): SummaryDraft`
  - `emptySummaryDraft(): SummaryDraft`

- [ ] **Step 1: Escribir los tests que fallan**

`src/parsers/words.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { OcrWord } from '../ocr/types';
import { readingOrder } from './words';

const w = (text: string, x0: number, y0: number, h = 20): OcrWord => ({ text, conf: 90, x0, y0, x1: x0 + 30, y1: y0 + h });

describe('readingOrder', () => {
  it('ordena por líneas y dentro de la línea por x, tolerando desalineación', () => {
    const out = readingOrder([w('28.00', 1138, 1365), w('-¥', 1108, 1366), w('RacsoSM', 1051, 1268)]);
    expect(out.map((x) => x.text)).toEqual(['RacsoSM', '-¥', '28.00']);
  });
});
```

`src/parsers/detect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { OcrWord } from '../ocr/types';
import { fixtureJson } from '../test/fixtures';
import { detectKind } from './detect';

const w = (text: string): OcrWord => ({ text, conf: 90, x0: 0, y0: 0, x1: 1, y1: 1 });

describe('detectKind', () => {
  it('clasifica los fixtures', () => {
    expect(detectKind(fixtureJson<{ full: OcrWord[] }>('session-summary-01.ocr.json').full)).toBe('summary');
    expect(detectKind(fixtureJson<{ full: OcrWord[] }>('hand-1323539300829384704.ocr.json').full)).toBe('hand');
  });
  it('devuelve unknown para otras imágenes', () => {
    expect(detectKind([w('Lobby'), w('Cash')])).toBe('unknown');
    expect(detectKind([w('MY'), w('STATS')])).toBe('summary');
    expect(detectKind([w('HAND'), w('ID')])).toBe('hand');
  });
});
```

`src/parsers/summary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { OcrWord } from '../ocr/types';
import { fixtureJson } from '../test/fixtures';
import { emptySummaryDraft, parseSummary } from './summary';

let y = 0;
const w = (text: string, conf = 95): OcrWord => ({ text, conf, x0: 0, y0: (y += 40), x1: 50, y1: y + 20 });

describe('parseSummary', () => {
  it('lee el fixture real', () => {
    const d = parseSummary(fixtureJson<{ full: OcrWord[] }>('session-summary-01.ocr.json').full);
    expect(d).toEqual({ resultCny: -13, hands: 18, durationSec: 133, uncertain: [] });
  });
  it('acepta positivo, sin signo, miles y guion tipográfico', () => {
    expect(parseSummary([w('+CN¥1,234.50'), w('Total:'), w('1,250'), w('hands,'), w('Duration:'), w('01:30:00')])).toMatchObject({ resultCny: 1234.5, hands: 1250, durationSec: 5400 });
    expect(parseSummary([w('CN¥5.00')]).resultCny).toBe(5);
    expect(parseSummary([w('—CN¥3.00')]).resultCny).toBe(-3);
    expect(parseSummary([w('-CN'), w('Y13.00')]).resultCny).toBe(-13);
  });
  it('marca inciertos los campos ausentes o de baja confianza', () => {
    const d = parseSummary([w('-CN¥13.00', 40), w('18'), w('hands')]);
    expect(d.resultCny).toBe(-13);
    expect(d.durationSec).toBeNull();
    expect([...d.uncertain].sort()).toEqual(['durationSec', 'resultCny']);
  });
  it('borrador vacío con todo incierto', () => {
    expect(emptySummaryDraft()).toEqual({ resultCny: null, hands: null, durationSec: null, uncertain: ['resultCny', 'hands', 'durationSec'] });
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/parsers`
Expected: FAIL por import no resuelto en los tres archivos nuevos.

- [ ] **Step 3: Implementar**

`src/parsers/words.ts`:
```ts
import type { OcrWord } from '../ocr/types';

export function readingOrder(words: OcrWord[]): OcrWord[] {
  const sorted = [...words].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const lines: OcrWord[][] = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2;
    const h = Math.max(1, w.y1 - w.y0);
    const line = lines[lines.length - 1];
    if (line) {
      const lc = (line[0].y0 + line[0].y1) / 2;
      if (Math.abs(cy - lc) <= h * 0.6) {
        line.push(w);
        continue;
      }
    }
    lines.push([w]);
  }
  return lines.flatMap((l) => l.sort((a, b) => a.x0 - b.x0));
}
```

`src/parsers/money.ts`:
```ts
// Signos que el OCR puede devolver: +, guion, en dash, em dash y signo menos.
export const SIGN = '[+\\-–—−]';

export function isNegativeSign(s: string | undefined): boolean {
  return s !== undefined && /[-–—−]/.test(s);
}
```

`src/parsers/detect.ts`:
```ts
import type { OcrWord } from '../ocr/types';

export function detectKind(words: OcrWord[]): 'summary' | 'hand' | 'unknown' {
  const text = words.map((w) => w.text).join(' ').toLowerCase();
  if (/my\s*stats/.test(text)) return 'summary';
  if (/hand\s*id/.test(text)) return 'hand';
  return 'unknown';
}
```

`src/parsers/summary.ts`:
```ts
import type { OcrWord } from '../ocr/types';
import { isNegativeSign, SIGN } from './money';
import { readingOrder } from './words';

export type SummaryField = 'resultCny' | 'hands' | 'durationSec';
export interface SummaryDraft { resultCny: number | null; hands: number | null; durationSec: number | null; uncertain: SummaryField[] }

const RESULT = new RegExp(`(${SIGN})?\\s*CN\\s*[¥Y]\\s*(\\d[\\d,]*\\.\\d{2})`, 'i');
const HANDS = /(\d[\d,]*)\s*hands/i;
const DURATION = /(\d{1,3}):(\d{2}):(\d{2})/;
const MIN_CONF = 60;

export function emptySummaryDraft(): SummaryDraft {
  return { resultCny: null, hands: null, durationSec: null, uncertain: ['resultCny', 'hands', 'durationSec'] };
}

function lowConf(words: OcrWord[], token: string): boolean {
  return words.some((w) => w.text.includes(token) && w.conf < MIN_CONF);
}

export function parseSummary(words: OcrWord[]): SummaryDraft {
  const ordered = readingOrder(words);
  const text = ordered.map((w) => w.text).join(' ');
  const uncertain: SummaryField[] = [];

  let resultCny: number | null = null;
  const r = RESULT.exec(text);
  if (r) {
    const v = Number(r[2].replace(/,/g, ''));
    resultCny = isNegativeSign(r[1]) ? -v : v;
    if (lowConf(ordered, r[2])) uncertain.push('resultCny');
  } else uncertain.push('resultCny');

  let hands: number | null = null;
  const h = HANDS.exec(text);
  if (h) {
    hands = Number(h[1].replace(/,/g, ''));
    if (lowConf(ordered, h[1])) uncertain.push('hands');
  } else uncertain.push('hands');

  let durationSec: number | null = null;
  const d = DURATION.exec(text);
  if (d) {
    durationSec = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
    if (lowConf(ordered, d[0])) uncertain.push('durationSec');
  } else uncertain.push('durationSec');

  return { resultCny, hands, durationSec, uncertain };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/parsers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parsers
git commit -m "feat(parsers): detección de tipo y parser del resumen My stats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Parser de la mano

**Files:**
- Create: `src/parsers/hand.ts`
- Test: `src/parsers/hand.test.ts`

**Interfaces:**
- Consumes: `OcrWord`, `HandLayout`, `LayoutCard`, `LayoutColumn`, `RowBox`, `buildHandLayout`, `loadSeedTemplates`, `inferPot`, `positionFromPreflopIndex`, `nameMatches`, `readingOrder`, `SIGN`, `isNegativeSign`.
- Produces:
  - `interface PartialCard { rank: Rank | null; suit: Suit | null }`
  - `type HandField = 'handId' | 'playedAt' | 'heroPosition' | 'heroCards' | 'board' | 'heroResultCny' | 'allin'`
  - `interface GlyphRef { slot: 'hero' | 'board'; index: number; sizeClass: SizeClass; glyph: string; guessed: Rank | null }`
  - `interface AllinDraft { street: Street | null; heroEquity: number | null; potContested: number | null; heroInvested: number | null }`
  - `interface HandDraft { handId: string | null; playedAt: number | null; heroPosition: Position | null; heroCards: PartialCard[]; board: PartialCard[]; heroResultCny: number | null; kind: 'allin' | 'study'; allin: AllinDraft | null; uncertain: HandField[]; glyphs: GlyphRef[] }`
  - `interface HandOcr { full: OcrWord[]; columns: Record<LayoutColumn, OcrWord[]> }`
  - `parseHand(ocr: HandOcr, layout: HandLayout, heroName: string): HandDraft`
  - `emptyHandDraft(): HandDraft`
  - `findHandId(full: OcrWord[]): string | null`, `findPlayedAt(full: OcrWord[]): number | null`, `parseMoneyText(text: string): number | null`

- [ ] **Step 1: Escribir el test que falla**

`src/parsers/hand.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, fixtureJson, HAND_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { buildHandLayout } from './handLayout';
import { emptyHandDraft, parseHand, parseMoneyText, type HandOcr } from './hand';

const ocr = fixtureJson<HandOcr>('hand-1323539300829384704.ocr.json');
const layout = buildHandLayout(decodePng(fixtureBytes(HAND_PNG)), ocr.full, loadSeedTemplates())!;
const BOARD = [
  { rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }, { rank: '4', suit: 'c' }, { rank: '3', suit: 'd' },
];

describe('parseMoneyText', () => {
  it('lee importes con signo separado y guion tipográfico', () => {
    expect(parseMoneyText('RacsoSM = HH -¥ 28.00')).toBe(-28);
    expect(parseMoneyText('+¥ 191.10')).toBe(191.1);
    expect(parseMoneyText('¥0.00')).toBe(0);
    expect(parseMoneyText('—¥1,156.10')).toBe(-1156.1);
    expect(parseMoneyText('Fold')).toBeNull();
  });
});

describe('parseHand sobre el fixture real', () => {
  it('RacsoSM (HJ, foldea en el flop): mano de estudio', () => {
    const d = parseHand(ocr, layout, 'RacsoSM');
    expect(d.handId).toBe('1323539300829384704');
    expect(d.playedAt).toBe(new Date(2026, 8, 25, 11, 0, 47).getTime());
    expect(d.heroPosition).toBe('HJ');
    expect(d.heroCards).toEqual([{ rank: 'A', suit: 'd' }, { rank: '8', suit: 'c' }]);
    expect(d.board).toEqual(BOARD);
    expect(d.heroResultCny).toBe(-28);
    expect(d.kind).toBe('study');
    expect(d.allin).toBeNull();
    expect(d.uncertain).toEqual([]);
    expect(d.glyphs.filter((g) => g.slot === 'hero')).toHaveLength(2);
    expect(d.glyphs.filter((g) => g.slot === 'board')).toHaveLength(5);
  });

  it('HiTeR2504 (BTN, all-in en el flop con 13%)', () => {
    const d = parseHand(ocr, layout, 'HiTeR2504');
    expect(d.heroPosition).toBe('BTN');
    expect(d.heroCards).toEqual([{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }]);
    expect(d.heroResultCny).toBe(-156.1);
    expect(d.kind).toBe('allin');
    expect(d.allin).toEqual({ street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 });
    expect(d.uncertain).not.toContain('allin');
  });

  it('héroe inexistente: borrador sin crash, con campos inciertos', () => {
    const d = parseHand(ocr, layout, 'NoExiste99');
    expect(d.handId).toBe('1323539300829384704');
    expect(d.heroCards).toEqual([{ rank: null, suit: null }, { rank: null, suit: null }]);
    expect(d.heroPosition).toBeNull();
    expect(d.heroResultCny).toBeNull();
    expect(d.kind).toBe('study');
    expect(d.uncertain).toEqual(expect.arrayContaining(['heroCards', 'heroPosition', 'heroResultCny']));
  });
});

describe('emptyHandDraft', () => {
  it('marca todo como incierto', () => {
    expect(emptyHandDraft().uncertain).toEqual(['handId', 'playedAt', 'heroPosition', 'heroCards', 'heroResultCny']);
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npx vitest run src/parsers/hand.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar `src/parsers/hand.ts`**

```ts
import { inferPot } from '../domain/allin';
import { positionFromPreflopIndex } from '../domain/positions';
import type { Position, Rank, SizeClass, Street, Suit } from '../domain/types';
import type { Rect } from '../image/rgba';
import type { OcrWord } from '../ocr/types';
import type { RowBox } from '../vision/rows';
import type { HandLayout, LayoutCard, LayoutColumn } from './handLayout';
import { isNegativeSign, SIGN } from './money';
import { nameMatches } from './names';
import { readingOrder } from './words';

export interface PartialCard { rank: Rank | null; suit: Suit | null }
export type HandField = 'handId' | 'playedAt' | 'heroPosition' | 'heroCards' | 'board' | 'heroResultCny' | 'allin';
export interface GlyphRef { slot: 'hero' | 'board'; index: number; sizeClass: SizeClass; glyph: string; guessed: Rank | null }
export interface AllinDraft { street: Street | null; heroEquity: number | null; potContested: number | null; heroInvested: number | null }
export interface HandDraft {
  handId: string | null;
  playedAt: number | null;
  heroPosition: Position | null;
  heroCards: PartialCard[];
  board: PartialCard[];
  heroResultCny: number | null;
  kind: 'allin' | 'study';
  allin: AllinDraft | null;
  uncertain: HandField[];
  glyphs: GlyphRef[];
}
export interface HandOcr { full: OcrWord[]; columns: Record<LayoutColumn, OcrWord[]> }

const MONEY = new RegExp(`(${SIGN})?\\s*[¥Y]\\s*(\\d[\\d,]*\\.\\d{2})`);
const PCT = /^(\d{1,3})%$/;
const MIN_PCT_CONF = 60;
const MIN_MONEY_CONF = 50;
const EMPTY_CARD: PartialCard = { rank: null, suit: null };

export function emptyHandDraft(): HandDraft {
  return {
    handId: null, playedAt: null, heroPosition: null,
    heroCards: [{ ...EMPTY_CARD }, { ...EMPTY_CARD }], board: [], heroResultCny: null,
    kind: 'study', allin: null,
    uncertain: ['handId', 'playedAt', 'heroPosition', 'heroCards', 'heroResultCny'], glyphs: [],
  };
}

export function findHandId(full: OcrWord[]): string | null {
  const i = full.findIndex((w) => /^ID$/i.test(w.text));
  if (i >= 0 && full[i + 1] && /^\d{10,}$/.test(full[i + 1].text)) return full[i + 1].text;
  return full.find((w) => /^\d{15,}$/.test(w.text))?.text ?? null;
}

export function findPlayedAt(full: OcrWord[]): number | null {
  for (let i = 0; i < full.length - 1; i++) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(full[i].text);
    const t = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(full[i + 1].text);
    if (d && t) return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], +t[3]).getTime();
  }
  return null;
}

export function parseMoneyText(text: string): number | null {
  const m = MONEY.exec(text);
  if (!m) return null;
  const v = Number(m[2].replace(/,/g, ''));
  return isNegativeSign(m[1]) ? -v : v;
}

const cx = (w: OcrWord) => (w.x0 + w.x1) / 2;
const cy = (w: OcrWord) => (w.y0 + w.y1) / 2;
const inRect = (w: OcrWord, r: Rect) => cx(w) >= r.x && cx(w) < r.x + r.w && cy(w) >= r.y && cy(w) < r.y + r.h;
const inRow = (w: OcrWord, row: RowBox) => cy(w) >= row.y0 && cy(w) <= row.y1;

// Palabras de una columna según ambas pasadas (la completa y la de columna).
function columnWords(ocr: HandOcr, layout: HandLayout, col: LayoutColumn): OcrWord[] {
  const rect = layout.columns[col].rect;
  return [...ocr.full.filter((w) => inRect(w, rect)), ...ocr.columns[col]];
}

function heroRowIndex(words: OcrWord[], rows: RowBox[], heroName: string): number {
  return rows.findIndex((row) => words.some((w) => inRow(w, row) && nameMatches(w.text, heroName)));
}

function rowMoney(words: OcrWord[]): { value: number | null; conf: number } {
  const ordered = readingOrder(words);
  const value = parseMoneyText(ordered.map((w) => w.text).join(' '));
  const moneyWords = ordered.filter((w) => /[¥Y.]/.test(w.text));
  return { value, conf: moneyWords.length ? Math.min(...moneyWords.map((w) => w.conf)) : 0 };
}

// Porcentajes: primero la pasada completa (más fiable, spec §10a), después la de columna.
function rowPercent(ocr: HandOcr, layout: HandLayout, col: LayoutColumn, row: RowBox): number | null {
  const rect = layout.columns[col].rect;
  const pick = (ws: OcrWord[]) => {
    for (const w of ws) {
      if (!inRect(w, rect) || !inRow(w, row) || w.conf < MIN_PCT_CONF) continue;
      const m = PCT.exec(w.text);
      if (m && Number(m[1]) <= 100) return Number(m[1]) / 100;
    }
    return null;
  };
  return pick(ocr.full) ?? pick(ocr.columns[col]);
}

function isAboveName(card: LayoutCard, name: OcrWord, s: number): boolean {
  const ccx = card.x + card.w / 2;
  const bottom = card.y + card.h;
  return ccx >= name.x0 - 80 * s && ccx <= name.x1 + 80 * s && bottom >= name.y0 - 60 * s && bottom <= name.y0 + 20 * s;
}

function derivePosition(ocr: HandOcr, layout: HandLayout, heroName: string, nPlayers: number): Position | null {
  const blinds = layout.columns.blinds;
  const bw = columnWords(ocr, layout, 'blinds');
  const straddle = bw.some((w) => /^STR$/i.test(w.text));
  for (const row of blinds.rows) {
    const ws = bw.filter((w) => inRow(w, row));
    if (!ws.some((w) => nameMatches(w.text, heroName))) continue;
    if (ws.some((w) => /^SB$/i.test(w.text))) return 'SB';
    if (ws.some((w) => /^BB$/i.test(w.text))) return 'BB';
    if (ws.some((w) => /^STR$/i.test(w.text))) return 'UTG';
  }
  const pf = layout.columns.preflop;
  const idx = heroRowIndex(columnWords(ocr, layout, 'preflop'), pf.rows, heroName);
  return idx < 0 ? null : positionFromPreflopIndex(idx, nPlayers, straddle);
}

export function parseHand(ocr: HandOcr, layout: HandLayout, heroName: string): HandDraft {
  const uncertain = new Set<HandField>();
  const glyphs: GlyphRef[] = [];
  const s = layout.width / 1280;

  const handId = findHandId(ocr.full);
  if (!handId) uncertain.add('handId');
  const playedAt = findPlayedAt(ocr.full);
  if (playedAt === null) uncertain.add('playedAt');

  const toPartial = (slot: GlyphRef['slot']) => (c: LayoutCard, index: number): PartialCard => {
    if (c.glyph) glyphs.push({ slot, index, sizeClass: c.sizeClass, glyph: c.glyph, guessed: c.rank });
    return { rank: c.rank, suit: c.suit };
  };

  const board = layout.cards.filter((c) => c.sizeClass === 'board').sort((a, b) => a.x - b.x).slice(0, 5).map(toPartial('board'));
  if (board.some((c) => c.rank === null)) uncertain.add('board');

  const nameWord = ocr.full.find((w) => w.y1 < layout.headerTop && nameMatches(w.text, heroName));
  const heroBlobs = nameWord
    ? layout.cards.filter((c) => c.sizeClass === 'hole' && isAboveName(c, nameWord, s)).sort((a, b) => a.x - b.x).slice(0, 2)
    : [];
  const heroCards = heroBlobs.length === 2 ? heroBlobs.map(toPartial('hero')) : [{ ...EMPTY_CARD }, { ...EMPTY_CARD }];
  if (heroCards.some((c) => c.rank === null || c.suit === null)) uncertain.add('heroCards');

  const river = layout.columns.river;
  const riverMoney = river.rows.map((row) => rowMoney(ocr.columns.river.filter((w) => inRow(w, row))));
  const heroRiver = heroRowIndex(columnWords(ocr, layout, 'river'), river.rows, heroName);
  const heroMoney = heroRiver >= 0 ? riverMoney[heroRiver] : null;
  const heroResultCny = heroMoney?.value ?? null;
  if (heroResultCny === null || (heroMoney && heroMoney.conf < MIN_MONEY_CONF)) uncertain.add('heroResultCny');

  const heroPosition = derivePosition(ocr, layout, heroName, river.rows.length);
  if (!heroPosition) uncertain.add('heroPosition');

  let allin: AllinDraft | null = null;
  for (const street of ['preflop', 'flop', 'turn'] as const) {
    const col = layout.columns[street];
    const pcts = col.rows.map((row) => rowPercent(ocr, layout, street, row));
    const equityPlayers = pcts.filter((p) => p !== null).length;
    if (equityPlayers === 0) continue;
    const words = columnWords(ocr, layout, street);
    const idx = col.rows.findIndex((row, i) => pcts[i] !== null && words.some((w) => inRow(w, row) && nameMatches(w.text, heroName)));
    if (idx >= 0) {
      const heroEquity = pcts[idx];
      if (heroResultCny === null) {
        allin = { street, heroEquity, potContested: null, heroInvested: null };
        uncertain.add('allin');
      } else {
        const others = riverMoney
          .filter((_, i) => i !== heroRiver)
          .map((m) => m.value)
          .filter((v): v is number => v !== null);
        const inf = inferPot(heroResultCny, others, equityPlayers);
        allin = { street, heroEquity, potContested: inf.potContested, heroInvested: inf.heroInvested };
        if (inf.ambiguous) uncertain.add('allin');
      }
    }
    break;
  }

  return { handId, playedAt, heroPosition, heroCards, board, heroResultCny, kind: allin ? 'allin' : 'study', allin, uncertain: [...uncertain], glyphs };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/parsers`
Expected: PASS. Si falla una expectativa del fixture, inspecciona las palabras del `.ocr.json` que caen en la fila afectada (por ejemplo, las de `columns.river` entre `y0` e `y1` de la fila del héroe). El fixture es la verdad del OCR; no cambies la expectativa sin entender la causa (superpowers:systematic-debugging).

- [ ] **Step 5: Commit**

```bash
git add src/parsers/hand.ts src/parsers/hand.test.ts
git commit -m "feat(parsers): parser de la mano descargada (cartas, posición, resultado y all-in)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Base de datos local (Dexie) y repositorio

**Files:**
- Create: `src/db/db.ts`, `src/db/repo.ts`
- Test: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: tipos de dominio, `DEFAULT_SETTINGS`, `playingDay`, `loadSeedTemplates`, `glyphFromString`, `RankTemplate`.
- Produces:
  - `interface SettingsRow extends Settings { key: 'main' }`
  - `interface StoredTemplate { id: string; rank: Rank; sizeClass: SizeClass; glyph: string }`
  - `class PtDb extends Dexie` con las tablas `settings`, `chunks`, `hands`, `images` y `rankTemplates`; `new PtDb(name?)`
  - `type ChunkInput = Omit<SessionChunk, 'id' | 'createdAt' | 'imageId'>`, `type ImageInput = Omit<StoredImage, 'id'>`
  - `class DuplicateHandError extends Error { existingId: string }`
  - `getSettings(db): Promise<Settings>`, `saveSettings(db, s: Settings): Promise<void>`
  - `addChunk(db, chunk: ChunkInput, image: ImageInput): Promise<SessionChunk>`
  - `updateChunk(db, id: string, patch: Partial<ChunkInput>): Promise<void>`, `deleteChunk(db, id: string): Promise<void>`
  - `findSimilarChunk(db, c: Pick<SessionChunk, 'startedAt' | 'resultCny' | 'hands' | 'durationSec'>, cutoffHour: number): Promise<SessionChunk | undefined>`
  - `addHand(db, values: HandValues, image: ImageInput): Promise<Hand>` (lanza `DuplicateHandError`)
  - `updateHand(db, id: string, values: HandValues): Promise<void>` (lanza `DuplicateHandError`), `deleteHand(db, id: string): Promise<void>`
  - `findHandByHandId(db, handId: string): Promise<Hand | undefined>`
  - `addTemplates(db, ts: Omit<StoredTemplate, 'id'>[]): Promise<void>`, `loadTemplates(db): Promise<RankTemplate[]>`

- [ ] **Step 1: Escribir el test que falla**

`src/db/repo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type HandValues } from '../domain/types';
import { PtDb } from './db';
import {
  addChunk, addHand, addTemplates, deleteChunk, DuplicateHandError, findHandByHandId, findSimilarChunk,
  getSettings, loadTemplates, saveSettings, updateHand,
} from './repo';

const newDb = () => new PtDb(`test-${crypto.randomUUID()}`);
const IMG = { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png', width: 1, height: 1 };
const CHUNK = { startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes };
const HAND: HandValues = {
  handId: '1323539300829384704', playedAt: new Date(2026, 8, 25, 11, 0, 47).getTime(), heroPosition: 'HJ',
  heroCards: [{ rank: 'A', suit: 'd' }, { rank: '8', suit: 'c' }], board: [], heroResultCny: -28, kind: 'study', tags: [],
};

describe('repo', () => {
  it('devuelve los ajustes por defecto y los guarda', async () => {
    const db = newDb();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(db, { ...DEFAULT_SETTINGS, heroName: 'Otro' });
    expect((await getSettings(db)).heroName).toBe('Otro');
  });

  it('guarda un tramo con su imagen y lo borra junto con ella', async () => {
    const db = newDb();
    const c = await addChunk(db, CHUNK, IMG);
    expect(await db.images.get(c.imageId)).toMatchObject({ mime: 'image/png' });
    await deleteChunk(db, c.id);
    expect(await db.chunks.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
  });

  it('detecta un tramo igual el mismo día de juego', async () => {
    const db = newDb();
    await addChunk(db, CHUNK, IMG);
    expect(await findSimilarChunk(db, { ...CHUNK, startedAt: CHUNK.startedAt + 3_600_000 }, 6)).toBeDefined();
    expect(await findSimilarChunk(db, { ...CHUNK, hands: 19 }, 6)).toBeUndefined();
  });

  it('bloquea manos duplicadas por handId', async () => {
    const db = newDb();
    const h = await addHand(db, HAND, IMG);
    expect((await findHandByHandId(db, HAND.handId))?.id).toBe(h.id);
    await expect(addHand(db, HAND, IMG)).rejects.toBeInstanceOf(DuplicateHandError);
    const other = await addHand(db, { ...HAND, handId: '999' }, IMG);
    await expect(updateHand(db, other.id, { ...HAND })).rejects.toBeInstanceOf(DuplicateHandError);
    await updateHand(db, other.id, { ...HAND, handId: '999', note: 'revisar' });
    expect((await db.hands.get(other.id))?.note).toBe('revisar');
  });

  it('combina semillas y plantillas aprendidas', async () => {
    const db = newDb();
    const before = (await loadTemplates(db)).length;
    await addTemplates(db, [{ rank: 'J', sizeClass: 'board', glyph: '0'.repeat(384) }]);
    const all = await loadTemplates(db);
    expect(all).toHaveLength(before + 1);
    expect(all.at(-1)).toMatchObject({ rank: 'J', sizeClass: 'board' });
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npx vitest run src/db`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar**

`src/db/db.ts`:
```ts
import Dexie, { type Table } from 'dexie';
import type { Hand, Rank, SessionChunk, Settings, SizeClass, StoredImage } from '../domain/types';

export interface SettingsRow extends Settings { key: 'main' }
export interface StoredTemplate { id: string; rank: Rank; sizeClass: SizeClass; glyph: string }

export class PtDb extends Dexie {
  settings!: Table<SettingsRow, string>;
  chunks!: Table<SessionChunk, string>;
  hands!: Table<Hand, string>;
  images!: Table<StoredImage, string>;
  rankTemplates!: Table<StoredTemplate, string>;

  constructor(name = 'poker-tracker-os') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      chunks: 'id, startedAt',
      hands: 'id, &handId, playedAt, kind',
      images: 'id',
      rankTemplates: 'id, sizeClass',
    });
  }
}
```

`src/db/repo.ts`:
```ts
import { playingDay } from '../domain/stats';
import { DEFAULT_SETTINGS, type Hand, type HandValues, type SessionChunk, type Settings, type StoredImage } from '../domain/types';
import { glyphFromString, type RankTemplate } from '../vision/glyph';
import { loadSeedTemplates } from '../vision/seeds';
import type { PtDb, StoredTemplate } from './db';

export type ChunkInput = Omit<SessionChunk, 'id' | 'createdAt' | 'imageId'>;
export type ImageInput = Omit<StoredImage, 'id'>;

export class DuplicateHandError extends Error {
  existingId: string;
  constructor(existingId: string) {
    super('Esta mano ya está guardada');
    this.existingId = existingId;
  }
}

const newId = () => crypto.randomUUID();

export async function getSettings(db: PtDb): Promise<Settings> {
  const row = await db.settings.get('main');
  if (!row) return DEFAULT_SETTINGS;
  return { heroName: row.heroName, stakes: row.stakes, currency: row.currency, dayCutoffHour: row.dayCutoffHour, lastBackupAt: row.lastBackupAt };
}

export async function saveSettings(db: PtDb, s: Settings): Promise<void> {
  await db.settings.put({ ...s, key: 'main' });
}

export async function addChunk(db: PtDb, chunk: ChunkInput, image: ImageInput): Promise<SessionChunk> {
  const imageId = newId();
  const saved: SessionChunk = { ...chunk, id: newId(), imageId, createdAt: Date.now() };
  await db.transaction('rw', db.chunks, db.images, async () => {
    await db.images.add({ ...image, id: imageId });
    await db.chunks.add(saved);
  });
  return saved;
}

export async function updateChunk(db: PtDb, id: string, patch: Partial<ChunkInput>): Promise<void> {
  await db.chunks.update(id, patch);
}

export async function deleteChunk(db: PtDb, id: string): Promise<void> {
  await db.transaction('rw', db.chunks, db.images, async () => {
    const c = await db.chunks.get(id);
    if (!c) return;
    await db.chunks.delete(id);
    await db.images.delete(c.imageId);
  });
}

export async function findSimilarChunk(
  db: PtDb,
  c: Pick<SessionChunk, 'startedAt' | 'resultCny' | 'hands' | 'durationSec'>,
  cutoffHour: number,
): Promise<SessionChunk | undefined> {
  const day = playingDay(c.startedAt, cutoffHour);
  const all = await db.chunks.toArray();
  return all.find(
    (x) => playingDay(x.startedAt, cutoffHour) === day && x.resultCny === c.resultCny && x.hands === c.hands && x.durationSec === c.durationSec,
  );
}

export async function findHandByHandId(db: PtDb, handId: string): Promise<Hand | undefined> {
  return db.hands.where('handId').equals(handId).first();
}

export async function addHand(db: PtDb, values: HandValues, image: ImageInput): Promise<Hand> {
  const imageId = newId();
  const saved: Hand = { ...values, id: newId(), imageId, createdAt: Date.now() };
  await db.transaction('rw', db.hands, db.images, async () => {
    const existing = await findHandByHandId(db, values.handId);
    if (existing) throw new DuplicateHandError(existing.id);
    await db.images.add({ ...image, id: imageId });
    await db.hands.add(saved);
  });
  return saved;
}

export async function updateHand(db: PtDb, id: string, values: HandValues): Promise<void> {
  await db.transaction('rw', db.hands, async () => {
    const current = await db.hands.get(id);
    if (!current) return;
    const clash = await findHandByHandId(db, values.handId);
    if (clash && clash.id !== id) throw new DuplicateHandError(clash.id);
    await db.hands.put({ ...current, ...values, allin: values.allin });
  });
}

export async function deleteHand(db: PtDb, id: string): Promise<void> {
  await db.transaction('rw', db.hands, db.images, async () => {
    const h = await db.hands.get(id);
    if (!h) return;
    await db.hands.delete(id);
    await db.images.delete(h.imageId);
  });
}

export async function addTemplates(db: PtDb, ts: Omit<StoredTemplate, 'id'>[]): Promise<void> {
  if (ts.length) await db.rankTemplates.bulkAdd(ts.map((t) => ({ ...t, id: newId() })));
}

export async function loadTemplates(db: PtDb): Promise<RankTemplate[]> {
  const stored = await db.rankTemplates.toArray();
  return [...loadSeedTemplates(), ...stored.map((t) => ({ rank: t.rank, sizeClass: t.sizeClass, glyph: glyphFromString(t.glyph) }))];
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db
git commit -m "feat(db): esquema Dexie y repositorio con duplicados y plantillas aprendidas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Copia de seguridad (exportar e importar)

**Files:**
- Create: `src/db/backup.ts`
- Test: `src/db/backup.test.ts`

**Interfaces:**
- Consumes: `PtDb`, `SettingsRow`, `StoredTemplate`, tipos de dominio.
- Produces:
  - `BACKUP_SCHEMA_VERSION = 1`
  - `class BackupError extends Error`
  - `exportBackup(db: PtDb, now?: number): Promise<Uint8Array>` (zip con `data.json` e `images/<id>`)
  - `importBackup(db: PtDb, bytes: Uint8Array, mode: 'replace' | 'merge'): Promise<{ chunks: number; hands: number }>`

- [ ] **Step 1: Escribir el test que falla**

`src/db/backup.test.ts`:
```ts
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type HandValues } from '../domain/types';
import { BackupError, exportBackup, importBackup } from './backup';
import { PtDb } from './db';
import { addChunk, addHand, addTemplates, saveSettings } from './repo';

const newDb = () => new PtDb(`test-${crypto.randomUUID()}`);
const IMG = { bytes: new Uint8Array([9, 8, 7]), mime: 'image/png', width: 1, height: 1 };
const HAND: HandValues = {
  handId: 'H1', playedAt: 1, heroPosition: 'BTN', heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [],
  heroResultCny: -156.1, kind: 'allin', allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 }, tags: ['cooler'],
};

async function seeded() {
  const db = newDb();
  await saveSettings(db, { ...DEFAULT_SETTINGS, heroName: 'RacsoSM', lastBackupAt: 5 });
  await addChunk(db, { startedAt: 10, resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes }, IMG);
  await addHand(db, HAND, IMG);
  await addTemplates(db, [{ rank: 'J', sizeClass: 'hole', glyph: '1'.repeat(384) }]);
  return db;
}

describe('backup', () => {
  it('exporta e importa (reemplazar) con resultado idéntico', async () => {
    const src = await seeded();
    const zip = await exportBackup(src, 123);
    expect(Object.keys(unzipSync(zip))).toContain('data.json');
    const dst = newDb();
    await addChunk(dst, { startedAt: 99, resultCny: 1, hands: 1, durationSec: 1, stakes: DEFAULT_SETTINGS.stakes }, IMG);
    expect(await importBackup(dst, zip, 'replace')).toEqual({ chunks: 1, hands: 1 });
    expect(await dst.chunks.toArray()).toEqual(await src.chunks.toArray());
    expect(await dst.hands.toArray()).toEqual(await src.hands.toArray());
    expect(await dst.images.toArray()).toEqual(await src.images.toArray());
    expect(await dst.rankTemplates.toArray()).toEqual(await src.rankTemplates.toArray());
    expect((await dst.settings.get('main'))?.heroName).toBe('RacsoSM');
  });

  it('fusiona sin duplicar manos por handId', async () => {
    const src = await seeded();
    const zip = await exportBackup(src);
    const dst = newDb();
    await addHand(dst, HAND, IMG);
    expect(await importBackup(dst, zip, 'merge')).toEqual({ chunks: 1, hands: 0 });
    expect(await dst.hands.count()).toBe(1);
    expect(await dst.chunks.count()).toBe(1);
  });

  it('rechaza archivos corruptos sin tocar los datos', async () => {
    const dst = await seeded();
    await expect(importBackup(dst, new Uint8Array([1, 2, 3]), 'replace')).rejects.toBeInstanceOf(BackupError);
    await expect(importBackup(dst, zipSync({ 'data.json': strToU8('{"schemaVersion":99}') }), 'replace')).rejects.toBeInstanceOf(BackupError);
    expect(await dst.chunks.count()).toBe(1);
  });

  it('rechaza copias con imágenes faltantes', async () => {
    const src = await seeded();
    const entries = unzipSync(await exportBackup(src));
    const broken = Object.fromEntries(Object.entries(entries).filter(([k]) => !k.startsWith('images/')));
    await expect(importBackup(newDb(), zipSync(broken), 'replace')).rejects.toThrow(/Falta la imagen/);
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npx vitest run src/db/backup.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar `src/db/backup.ts`**

```ts
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type { Hand, SessionChunk, StoredImage } from '../domain/types';
import type { PtDb, StoredTemplate } from './db';
import { getSettings } from './repo';

export const BACKUP_SCHEMA_VERSION = 1;

export class BackupError extends Error {}

const rankZ = z.enum(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
const cardZ = z.object({ rank: rankZ, suit: z.enum(['s', 'h', 'd', 'c']) });
const stakesZ = z.object({ sb: z.number(), bb: z.number().positive(), straddle: z.number(), gameType: z.literal('fast') });
const settingsZ = z.object({
  heroName: z.string(), stakes: stakesZ, currency: z.literal('CNY'),
  dayCutoffHour: z.number().int().min(0).max(23), lastBackupAt: z.number().nullable(),
});
const chunkZ = z.object({
  id: z.string(), startedAt: z.number(), resultCny: z.number(), hands: z.number().int().nonnegative(),
  durationSec: z.number().int().nonnegative(), stakes: stakesZ, imageId: z.string(), note: z.string().optional(), createdAt: z.number(),
});
const handZ = z.object({
  id: z.string(), handId: z.string(), playedAt: z.number(),
  heroPosition: z.enum(['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  heroCards: z.tuple([cardZ, cardZ]), board: z.array(cardZ).max(5), heroResultCny: z.number(),
  kind: z.enum(['allin', 'study']),
  allin: z.object({ street: z.enum(['preflop', 'flop', 'turn']), heroEquity: z.number().min(0).max(1), potContested: z.number(), heroInvested: z.number() }).optional(),
  tags: z.array(z.string()), note: z.string().optional(), imageId: z.string(), createdAt: z.number(),
});
const imageMetaZ = z.object({ id: z.string(), mime: z.string(), width: z.number(), height: z.number(), file: z.string() });
const templateZ = z.object({ id: z.string(), rank: rankZ, sizeClass: z.enum(['board', 'hole']), glyph: z.string().regex(/^[01]{384}$/) });
const backupZ = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION), exportedAt: z.number(), settings: settingsZ,
  chunks: z.array(chunkZ), hands: z.array(handZ), images: z.array(imageMetaZ), rankTemplates: z.array(templateZ),
});

export async function exportBackup(db: PtDb, now = Date.now()): Promise<Uint8Array> {
  const [settings, chunks, hands, images, rankTemplates] = await Promise.all([
    getSettings(db), db.chunks.toArray(), db.hands.toArray(), db.images.toArray(), db.rankTemplates.toArray(),
  ]);
  const files: Record<string, Uint8Array> = {};
  const imagesMeta = images.map((img) => {
    const file = `images/${img.id}`;
    files[file] = img.bytes;
    return { id: img.id, mime: img.mime, width: img.width, height: img.height, file };
  });
  const data = { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now, settings, chunks, hands, images: imagesMeta, rankTemplates };
  files['data.json'] = strToU8(JSON.stringify(data));
  return zipSync(files, { level: 0 });
}

export async function importBackup(db: PtDb, bytes: Uint8Array, mode: 'replace' | 'merge'): Promise<{ chunks: number; hands: number }> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupError('El archivo no es una copia válida (zip dañado).');
  }
  const raw = entries['data.json'];
  if (!raw) throw new BackupError('La copia no contiene data.json.');
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new BackupError('data.json está dañado.');
  }
  const parsed = backupZ.safeParse(json);
  if (!parsed.success) throw new BackupError('La copia no tiene el formato esperado.');
  const data = parsed.data;
  for (const m of data.images) if (!entries[m.file]) throw new BackupError(`Falta la imagen ${m.file} en la copia.`);
  const imageIds = new Set(data.images.map((i) => i.id));
  for (const item of [...data.chunks, ...data.hands]) {
    if (!imageIds.has(item.imageId)) throw new BackupError(`Falta la imagen ${item.imageId} en la copia.`);
  }

  const images: StoredImage[] = data.images.map((m) => ({ id: m.id, mime: m.mime, width: m.width, height: m.height, bytes: entries[m.file].slice() }));
  const chunks = data.chunks as SessionChunk[];
  const hands = data.hands as Hand[];
  const templates = data.rankTemplates as StoredTemplate[];
  let counts = { chunks: 0, hands: 0 };

  await db.transaction('rw', [db.settings, db.chunks, db.hands, db.images, db.rankTemplates], async () => {
    if (mode === 'replace') {
      await Promise.all([db.settings.clear(), db.chunks.clear(), db.hands.clear(), db.images.clear(), db.rankTemplates.clear()]);
      await db.settings.put({ ...data.settings, key: 'main' });
      await db.images.bulkAdd(images);
      await db.chunks.bulkAdd(chunks);
      await db.hands.bulkAdd(hands);
      await db.rankTemplates.bulkAdd(templates);
      counts = { chunks: chunks.length, hands: hands.length };
      return;
    }
    const chunkIds = new Set(await db.chunks.toCollection().primaryKeys());
    const handIds = new Set((await db.hands.toArray()).flatMap((h) => [h.id, h.handId]));
    const newChunks = chunks.filter((c) => !chunkIds.has(c.id));
    const newHands = hands.filter((h) => !handIds.has(h.id) && !handIds.has(h.handId));
    const needed = new Set([...newChunks, ...newHands].map((x) => x.imageId));
    const existingImages = new Set(await db.images.toCollection().primaryKeys());
    const templateIds = new Set(await db.rankTemplates.toCollection().primaryKeys());
    await db.images.bulkAdd(images.filter((i) => needed.has(i.id) && !existingImages.has(i.id)));
    await db.chunks.bulkAdd(newChunks);
    await db.hands.bulkAdd(newHands);
    await db.rankTemplates.bulkAdd(templates.filter((t) => !templateIds.has(t.id)));
    counts = { chunks: newChunks.length, hands: newHands.length };
  });
  return counts;
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run src/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/backup.ts src/db/backup.test.ts
git commit -m "feat(db): exportar e importar copia de seguridad con validación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Flujo de importación (análisis de una captura)

**Files:**
- Create: `src/import/pipeline.ts`, `src/import/decodeImage.ts`, `src/import/learn.ts`, `src/import/shared.ts`, `src/ocr/loader.ts`
- Test: `src/import/pipeline.test.ts`, `src/import/learn.test.ts`, `src/ocr/loader.test.ts`

**Interfaces:**
- Consumes: `OcrEngine`, `createOcrEngine`, `ocrColumns`, `detectKind`, `parseSummary`, `emptySummaryDraft`, `buildHandLayout`, `parseHand`, `emptyHandDraft`, `decodePng`, `RankTemplate`, `StoredTemplate`, `HandDraft`, `HandValues`, `SHARED_CACHE`.
- Produces:
  - `interface IncomingFile { bytes: Uint8Array; mime: string; lastModified: number; name: string }`
  - `type Analysis = { kind: 'summary'; draft: SummaryDraft; image: RGBA } | { kind: 'hand'; draft: HandDraft; image: RGBA } | { kind: 'unknown'; image: RGBA }`
  - `interface AnalyzeDeps { engine: OcrEngine; decode: (f: IncomingFile) => Promise<RGBA>; templates: RankTemplate[]; heroName: string }`
  - `analyzeFile(file: IncomingFile, deps: AnalyzeDeps): Promise<Analysis>`
  - `decodeImageFile(f: IncomingFile): Promise<RGBA>` (solo navegador)
  - `templatesToLearn(draft: HandDraft, values: HandValues): Omit<StoredTemplate, 'id'>[]`
  - `takeSharedFiles(): Promise<IncomingFile[]>` (solo navegador)
  - `class OcrUnavailableError extends Error`
  - `createEngineLoader(factory: () => Promise<OcrEngine>): () => Promise<OcrEngine>`
  - `getBrowserEngine(): Promise<OcrEngine>`

- [ ] **Step 1: Escribir los tests que fallan**

`src/import/pipeline.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import type { OcrEngine, OcrMode } from '../ocr/engine';
import type { OcrWord } from '../ocr/types';
import { LAYOUT_COLUMNS } from '../parsers/handLayout';
import type { HandOcr } from '../parsers/hand';
import { fixtureBytes, fixtureJson, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { analyzeFile, type IncomingFile } from './pipeline';

// Motor falso: devuelve las salidas OCR congeladas en el orden en que el pipeline las pide.
function fakeEngine(full: OcrWord[], columns?: HandOcr['columns']): OcrEngine & { calls: OcrMode[] } {
  const calls: OcrMode[] = [];
  let col = 0;
  return {
    calls,
    async recognize(_img, mode) {
      calls.push(mode);
      if (mode === 'block') return full;
      return columns ? columns[LAYOUT_COLUMNS[col++]] : [];
    },
    async terminate() {},
  };
}

const file = (name: string): IncomingFile => ({ bytes: fixtureBytes(name), mime: 'image/png', lastModified: 1, name });
const deps = (engine: OcrEngine) => ({ engine, decode: async (f: IncomingFile) => decodePng(f.bytes), templates: loadSeedTemplates(), heroName: 'RacsoSM' });

describe('analyzeFile', () => {
  it('resumen: una sola pasada y borrador listo', async () => {
    const engine = fakeEngine(fixtureJson<{ full: OcrWord[] }>('session-summary-01.ocr.json').full);
    const a = await analyzeFile(file(SUMMARY_PNG), deps(engine));
    expect(a.kind).toBe('summary');
    if (a.kind === 'summary') expect(a.draft).toMatchObject({ resultCny: -13, hands: 18, durationSec: 133 });
    expect(engine.calls).toEqual(['block']);
  });
  it('mano: pasada completa + 5 columnas', async () => {
    const ocr = fixtureJson<HandOcr>('hand-1323539300829384704.ocr.json');
    const engine = fakeEngine(ocr.full, ocr.columns);
    const a = await analyzeFile(file(HAND_PNG), deps(engine));
    expect(a.kind).toBe('hand');
    if (a.kind === 'hand') expect(a.draft).toMatchObject({ handId: '1323539300829384704', heroPosition: 'HJ', heroResultCny: -28 });
    expect(engine.calls).toEqual(['block', 'sparse', 'sparse', 'sparse', 'sparse', 'sparse']);
  });
  it('imagen desconocida', async () => {
    const engine = fakeEngine([{ text: 'Lobby', conf: 90, x0: 0, y0: 0, x1: 1, y1: 1 }]);
    expect((await analyzeFile(file(SUMMARY_PNG), deps(engine))).kind).toBe('unknown');
  });
  it('mano sin cabecera de columnas: borrador vacío en vez de error', async () => {
    const engine = fakeEngine([{ text: 'HAND', conf: 90, x0: 0, y0: 0, x1: 1, y1: 1 }, { text: 'ID', conf: 90, x0: 2, y0: 0, x1: 3, y1: 1 }]);
    const a = await analyzeFile(file(HAND_PNG), deps(engine));
    expect(a.kind).toBe('hand');
    if (a.kind === 'hand') expect(a.draft.handId).toBeNull();
  });
});
```

`src/import/learn.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { HandValues } from '../domain/types';
import { emptyHandDraft, type HandDraft } from '../parsers/hand';
import { templatesToLearn } from './learn';

const G = '0'.repeat(384);

describe('templatesToLearn', () => {
  it('aprende solo los rangos desconocidos o corregidos', () => {
    const draft: HandDraft = {
      ...emptyHandDraft(),
      board: [{ rank: '5', suit: 'c' }, { rank: null, suit: 'd' }],
      glyphs: [
        { slot: 'board', index: 0, sizeClass: 'board', glyph: G, guessed: '5' },
        { slot: 'board', index: 1, sizeClass: 'board', glyph: G, guessed: null },
        { slot: 'hero', index: 0, sizeClass: 'hole', glyph: G, guessed: 'A' },
        { slot: 'hero', index: 1, sizeClass: 'hole', glyph: G, guessed: '8' },
      ],
    };
    const values = {
      heroCards: [{ rank: 'A', suit: 'd' }, { rank: '9', suit: 'c' }],
      board: [{ rank: '5', suit: 'c' }, { rank: 'J', suit: 'd' }],
    } as unknown as HandValues;
    expect(templatesToLearn(draft, values)).toEqual([
      { rank: 'J', sizeClass: 'board', glyph: G },
      { rank: '9', sizeClass: 'hole', glyph: G },
    ]);
  });
  it('no aprende del tablero si el usuario cambió su número de cartas', () => {
    const draft: HandDraft = { ...emptyHandDraft(), board: [{ rank: null, suit: 'c' }], glyphs: [{ slot: 'board', index: 0, sizeClass: 'board', glyph: G, guessed: null }] };
    const values = { heroCards: [], board: [] } as unknown as HandValues;
    expect(templatesToLearn(draft, values)).toEqual([]);
  });
});
```

`src/ocr/loader.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { OcrEngine } from './engine';
import { createEngineLoader, OcrUnavailableError } from './loader';

const engine: OcrEngine = { recognize: async () => [], terminate: async () => {} };

describe('createEngineLoader', () => {
  it('traduce el fallo a un mensaje claro y reintenta en la siguiente llamada', async () => {
    let attempts = 0;
    const get = createEngineLoader(async () => {
      attempts++;
      if (attempts === 1) throw new Error('network');
      return engine;
    });
    await expect(get()).rejects.toBeInstanceOf(OcrUnavailableError);
    await expect(get()).resolves.toBe(engine);
    await expect(get()).resolves.toBe(engine);
    expect(attempts).toBe(2);
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/import src/ocr/loader.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar**

`src/import/pipeline.ts`:
```ts
import type { RGBA } from '../image/rgba';
import { ocrColumns } from '../ocr/columns';
import type { OcrEngine } from '../ocr/engine';
import { detectKind } from '../parsers/detect';
import { emptyHandDraft, parseHand, type HandDraft } from '../parsers/hand';
import { buildHandLayout } from '../parsers/handLayout';
import { parseSummary, type SummaryDraft } from '../parsers/summary';
import type { RankTemplate } from '../vision/glyph';

export interface IncomingFile { bytes: Uint8Array; mime: string; lastModified: number; name: string }

export type Analysis =
  | { kind: 'summary'; draft: SummaryDraft; image: RGBA }
  | { kind: 'hand'; draft: HandDraft; image: RGBA }
  | { kind: 'unknown'; image: RGBA };

export interface AnalyzeDeps {
  engine: OcrEngine;
  decode: (f: IncomingFile) => Promise<RGBA>;
  templates: RankTemplate[];
  heroName: string;
}

export async function analyzeFile(file: IncomingFile, deps: AnalyzeDeps): Promise<Analysis> {
  const image = await deps.decode(file);
  const full = await deps.engine.recognize(file.bytes, 'block');
  const kind = detectKind(full);
  if (kind === 'summary') return { kind, draft: parseSummary(full), image };
  if (kind === 'unknown') return { kind, image };
  const layout = buildHandLayout(image, full, deps.templates);
  if (!layout) return { kind: 'hand', draft: emptyHandDraft(), image };
  const columns = await ocrColumns(deps.engine, image, layout);
  return { kind: 'hand', draft: parseHand({ full, columns }, layout, deps.heroName), image };
}
```

`src/import/decodeImage.ts`:
```ts
import { toBlob } from '../image/blob';
import type { RGBA } from '../image/rgba';
import type { IncomingFile } from './pipeline';

// Solo navegador. Sin conversión de color para no alterar los umbrales de visión.
export async function decodeImageFile(f: IncomingFile): Promise<RGBA> {
  const bmp = await createImageBitmap(toBlob(f.bytes, f.mime), { colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo leer la imagen');
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return { width: d.width, height: d.height, data: d.data };
}
```

`src/import/learn.ts`:
```ts
import type { StoredTemplate } from '../db/db';
import type { HandValues } from '../domain/types';
import type { HandDraft } from '../parsers/hand';

// Guarda como plantilla cada glifo cuyo rango el usuario completó o corrigió.
export function templatesToLearn(draft: HandDraft, values: HandValues): Omit<StoredTemplate, 'id'>[] {
  const out: Omit<StoredTemplate, 'id'>[] = [];
  for (const g of draft.glyphs) {
    const final =
      g.slot === 'hero' ? values.heroCards[g.index] : values.board.length === draft.board.length ? values.board[g.index] : undefined;
    if (final && final.rank !== g.guessed) out.push({ rank: final.rank, sizeClass: g.sizeClass, glyph: g.glyph });
  }
  return out;
}
```

`src/import/shared.ts`:
```ts
import { SHARED_CACHE } from '../sharedCache';
import type { IncomingFile } from './pipeline';

// Lee y vacía las imágenes que el service worker guardó al recibir "Compartir".
export async function takeSharedFiles(): Promise<IncomingFile[]> {
  if (!('caches' in window)) return [];
  const cache = await caches.open(SHARED_CACHE);
  const out: IncomingFile[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (res) {
      const blob = await res.blob();
      out.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime: blob.type || res.headers.get('content-type') || 'image/png',
        lastModified: Number(res.headers.get('x-last-modified')) || Date.now(),
        name: req.url,
      });
    }
    await cache.delete(req);
  }
  return out;
}
```

`src/ocr/loader.ts`:
```ts
import { createOcrEngine, type OcrEngine } from './engine';

export class OcrUnavailableError extends Error {
  constructor() {
    super('No se pudo cargar el lector de capturas. Conéctate a internet una vez para descargarlo.');
  }
}

export function createEngineLoader(factory: () => Promise<OcrEngine>): () => Promise<OcrEngine> {
  let pending: Promise<OcrEngine> | null = null;
  return () => {
    pending ??= factory().catch((e: unknown) => {
      pending = null;
      console.error(e);
      throw new OcrUnavailableError();
    });
    return pending;
  };
}

export const getBrowserEngine = createEngineLoader(() =>
  createOcrEngine({ workerPath: '/tesseract/worker.min.js', corePath: '/tesseract/core', langPath: '/tesseract/lang' }),
);
```

- [ ] **Step 4: Ejecutar los tests y el typecheck**

Run: `npx vitest run src/import src/ocr/loader.test.ts && npm run typecheck`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/import src/ocr/loader.ts src/ocr/loader.test.ts
git commit -m "feat(import): pipeline de análisis, aprendizaje de plantillas y carga del motor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Estructura de la app, estilos y Ajustes

**Files:**
- Create: `src/db/context.tsx`, `src/ui/hooks.ts`, `src/ui/format.ts`, `src/ui/storage.ts`, `src/ui/download.ts`, `src/ui/BottomNav.tsx`, `src/ui/Fab.tsx`, `src/ui/pages/Placeholder.tsx`, `src/ui/pages/SettingsPage.tsx`
- Modify: `src/ui/App.tsx` (reemplazo completo), `src/main.tsx`, `src/styles.css` (reemplazo completo)
- Test: `src/ui/App.test.tsx` (reemplazo), `src/ui/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `PtDb`, `getSettings`, `saveSettings`, `exportBackup`, `importBackup`, `BackupError`, `dayKey`, `toBlob`.
- Produces:
  - `DbProvider({ db?, children })`, `useDb(): PtDb`
  - `useSettings(): Settings | undefined`
  - `useObjectUrl(bytes?: Uint8Array, mime?: string): string | undefined`, `useStoredImageUrl(imageId?: string): string | undefined`
  - `signClass(n: number | null): '' | 'pos' | 'neg'`
  - `requestPersistence(): Promise<boolean>`, `isPersisted(): Promise<boolean | null>`
  - `saveFile(bytes: Uint8Array, name: string, mime: string): void`
  - `App` con las rutas `/dias`, `/dias/:day`, `/graficas`, `/manos`, `/manos/:id`, `/subir` y `/ajustes`

- [ ] **Step 1: Escribir los tests que fallan**

`src/ui/App.test.tsx` (reemplaza el de la Task 1):
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PtDb } from '../db/db';
import { DbProvider } from '../db/context';
import { App } from './App';

describe('App', () => {
  it('muestra la navegación inferior con las 4 pestañas', () => {
    render(<DbProvider db={new PtDb(`t-${crypto.randomUUID()}`)}><App /></DbProvider>);
    for (const label of ['Días', 'Gráficas', 'Manos', 'Ajustes']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Subir capturas' })).toBeInTheDocument();
  });
});
```

`src/ui/pages/SettingsPage.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PtDb } from '../../db/db';
import { DbProvider } from '../../db/context';
import { getSettings } from '../../db/repo';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('guarda el nombre en mesa y la hora de corte', async () => {
    const db = new PtDb(`t-${crypto.randomUUID()}`);
    render(<DbProvider db={db}><MemoryRouter><SettingsPage /></MemoryRouter></DbProvider>);
    const name = await screen.findByLabelText('Nombre en la mesa');
    expect(name).toHaveValue('RacsoSM');
    await userEvent.clear(name);
    await userEvent.type(name, 'OscarOS');
    const cutoff = screen.getByLabelText('Hora de corte del día');
    await userEvent.clear(cutoff);
    await userEvent.type(cutoff, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    await waitFor(async () => {
      const s = await getSettings(db);
      expect(s.heroName).toBe('OscarOS');
      expect(s.dayCutoffHour).toBe(5);
    });
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/ui`
Expected: FAIL (`DbProvider` y `SettingsPage` no existen).

- [ ] **Step 3: Implementar la infraestructura de UI**

`src/db/context.tsx`:
```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PtDb } from './db';

const DbContext = createContext<PtDb | null>(null);
let defaultDb: PtDb | null = null;

export function DbProvider({ db, children }: { db?: PtDb; children: ReactNode }) {
  const value = useMemo(() => db ?? (defaultDb ??= new PtDb()), [db]);
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): PtDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('Falta DbProvider');
  return db;
}
```

`src/ui/hooks.ts`:
```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useDb } from '../db/context';
import { getSettings } from '../db/repo';
import type { Settings } from '../domain/types';
import { toBlob } from '../image/blob';

export function useSettings(): Settings | undefined {
  const db = useDb();
  return useLiveQuery(() => getSettings(db), [db]);
}

export function useObjectUrl(bytes?: Uint8Array, mime?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!bytes) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(toBlob(bytes, mime ?? 'image/png'));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, mime]);
  return url;
}

export function useStoredImageUrl(imageId?: string): string | undefined {
  const db = useDb();
  const img = useLiveQuery(() => (imageId ? db.images.get(imageId) : undefined), [db, imageId]);
  return useObjectUrl(img?.bytes, img?.mime);
}
```

`src/ui/format.ts`:
```ts
export function signClass(n: number | null): '' | 'pos' | 'neg' {
  if (n === null || n === 0) return '';
  return n > 0 ? 'pos' : 'neg';
}
```

`src/ui/storage.ts`:
```ts
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function isPersisted(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}
```

`src/ui/download.ts`:
```ts
import { toBlob } from '../image/blob';

export function saveFile(bytes: Uint8Array, name: string, mime: string): void {
  const url = URL.createObjectURL(toBlob(bytes, mime));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

`src/ui/BottomNav.tsx`:
```tsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/dias', label: 'Días', icon: '📅' },
  { to: '/graficas', label: 'Gráficas', icon: '📈' },
  { to: '/manos', label: 'Manos', icon: '🃏' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} aria-label={t.label} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

`src/ui/Fab.tsx`:
```tsx
import { Link } from 'react-router-dom';

export function Fab() {
  return (
    <Link to="/subir" className="fab" aria-label="Subir capturas">
      +
    </Link>
  );
}
```

`src/ui/pages/Placeholder.tsx` (lo sustituyen las Tasks 16–19):
```tsx
export function Placeholder({ title }: { title: string }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="muted">Próximamente.</p>
    </section>
  );
}
```

`src/ui/App.tsx`:
```tsx
import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Fab } from './Fab';
import { Placeholder } from './pages/Placeholder';
import { SettingsPage } from './pages/SettingsPage';
import { requestPersistence } from './storage';

export function App() {
  useEffect(() => {
    void requestPersistence();
  }, []);
  return (
    <HashRouter>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dias" replace />} />
            <Route path="/dias" element={<Placeholder title="Días" />} />
            <Route path="/dias/:day" element={<Placeholder title="Día" />} />
            <Route path="/graficas" element={<Placeholder title="Gráficas" />} />
            <Route path="/manos" element={<Placeholder title="Manos" />} />
            <Route path="/manos/:id" element={<Placeholder title="Mano" />} />
            <Route path="/subir" element={<Placeholder title="Subir" />} />
            <Route path="/ajustes" element={<SettingsPage />} />
          </Routes>
        </main>
        <Fab />
        <BottomNav />
      </div>
    </HashRouter>
  );
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DbProvider } from './db/context';
import { App } from './ui/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      <App />
    </DbProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Implementar `src/ui/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { BackupError, exportBackup, importBackup } from '../../db/backup';
import { useDb } from '../../db/context';
import { saveSettings } from '../../db/repo';
import { parseDecimal } from '../../domain/format';
import { dayKey } from '../../domain/stats';
import type { Settings } from '../../domain/types';
import { saveFile } from '../download';
import { useSettings } from '../hooks';
import { isPersisted } from '../storage';

function SettingsForm({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [heroName, setHeroName] = useState(settings.heroName);
  const [sb, setSb] = useState(String(settings.stakes.sb));
  const [bb, setBb] = useState(String(settings.stakes.bb));
  const [straddle, setStraddle] = useState(String(settings.stakes.straddle));
  const [cutoff, setCutoff] = useState(String(settings.dayCutoffHour));
  const nums = { sb: parseDecimal(sb), bb: parseDecimal(bb), straddle: parseDecimal(straddle), cutoff: parseDecimal(cutoff) };
  const valid =
    heroName.trim() !== '' && nums.sb !== null && nums.bb !== null && nums.bb > 0 && nums.straddle !== null &&
    nums.cutoff !== null && Number.isInteger(nums.cutoff) && nums.cutoff <= 23;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void onSave({
          ...settings,
          heroName: heroName.trim(),
          stakes: { ...settings.stakes, sb: nums.sb!, bb: nums.bb!, straddle: nums.straddle! },
          dayCutoffHour: nums.cutoff!,
        });
      }}
    >
      <label className="field">
        <span>Nombre en la mesa</span>
        <input value={heroName} onChange={(e) => setHeroName(e.target.value)} autoComplete="off" />
      </label>
      <div className="row3">
        <label className="field"><span>SB ¥</span><input inputMode="decimal" value={sb} onChange={(e) => setSb(e.target.value)} /></label>
        <label className="field"><span>BB ¥</span><input inputMode="decimal" value={bb} onChange={(e) => setBb(e.target.value)} /></label>
        <label className="field"><span>Straddle ¥</span><input inputMode="decimal" value={straddle} onChange={(e) => setStraddle(e.target.value)} /></label>
      </div>
      <label className="field">
        <span>Hora de corte del día</span>
        <input inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
      </label>
      <button type="submit" className="btn primary" disabled={!valid}>Guardar ajustes</button>
    </form>
  );
}

export function SettingsPage() {
  const db = useDb();
  const settings = useSettings();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    void isPersisted().then(setPersisted);
  }, []);

  if (!settings) return <p className="muted page">Cargando…</p>;

  async function onExport() {
    const bytes = await exportBackup(db);
    saveFile(bytes, `poker-tracker-os-backup-${dayKey(new Date())}.zip`, 'application/zip');
    await saveSettings(db, { ...settings!, lastBackupAt: Date.now() });
    setMessage('Copia exportada. Guárdala en Drive o en otro lugar seguro.');
  }

  async function onImport(file: File) {
    if (mode === 'replace' && !window.confirm('Esto borrará todos tus datos actuales y los reemplazará por la copia. ¿Continuar?')) return;
    try {
      const r = await importBackup(db, new Uint8Array(await file.arrayBuffer()), mode);
      setMessage(`Importados ${r.chunks} tramos y ${r.hands} manos.`);
    } catch (e) {
      setMessage(e instanceof BackupError ? e.message : 'Error inesperado al importar la copia.');
    }
  }

  return (
    <section className="page">
      <h1>Ajustes</h1>
      {message && <p className="notice" role="status">{message}</p>}
      <SettingsForm key={JSON.stringify(settings)} settings={settings} onSave={async (s) => { await saveSettings(db, s); setMessage('Ajustes guardados.'); }} />

      <h2>Copia de seguridad</h2>
      <p className="muted">
        Última copia: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('es-MX') : 'nunca'}
      </p>
      <button type="button" className="btn primary" onClick={() => void onExport()}>Exportar copia</button>
      <fieldset className="field">
        <legend>Al importar</legend>
        <label><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Fusionar con lo actual</label>
        <label><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Reemplazar todo</label>
      </fieldset>
      <label className="btn">
        Importar copia…
        <input
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onImport(f);
          }}
        />
      </label>

      <h2>Almacenamiento</h2>
      {persisted === false ? (
        <p className="warning">
          El navegador no garantizó el almacenamiento permanente: Android podría borrar tus datos si se queda sin espacio. Exporta copias con frecuencia.
        </p>
      ) : (
        <p className="muted">{persisted ? 'Almacenamiento permanente concedido.' : 'Estado de almacenamiento desconocido.'}</p>
      )}
      <p className="muted small">Poker Tracker-os v{__APP_VERSION__}</p>
    </section>
  );
}
```

Añade la constante de versión a `vite.config.ts` (dentro de `defineConfig`, junto a `plugins`):
```ts
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
```
y crea `src/vite-env.d.ts`:
```ts
declare const __APP_VERSION__: string;
```

- [ ] **Step 5: Reemplazar `src/styles.css`**

```css
:root {
  --bg: #0f1115;
  --surface: #181b22;
  --surface-2: #20242d;
  --border: #2c313c;
  --text: #e8eaf0;
  --muted: #9aa1ae;
  --accent: #3b82f6;
  --pos: #22c55e;
  --neg: #ef4444;
  --flag: #facc15;
  --grid: #2c313c;
  --club: #0a7a2b;
  --diamond: #1455a9;
  --heart: #8b1919;
  --spade: #1c1c1c;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 15px; }
a { color: inherit; }
h1 { font-size: 1.4rem; margin: 0 0 12px; }
h2 { font-size: 1.1rem; margin: 24px 0 8px; }
.app-main { padding: 16px 16px 96px; max-width: 900px; margin: 0 auto; }
.page { display: flex; flex-direction: column; gap: 12px; }
.muted { color: var(--muted); }
.small { font-size: 0.8rem; }
.pos { color: var(--pos); }
.neg { color: var(--neg); }
.notice { background: var(--surface-2); border-left: 3px solid var(--accent); padding: 8px 12px; border-radius: 6px; }
.warning { background: #3a2f0b; border-left: 3px solid var(--flag); padding: 8px 12px; border-radius: 6px; }

.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: var(--surface); border-top: 1px solid var(--border); padding-bottom: env(safe-area-inset-bottom); z-index: 10; }
.bottom-nav a { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 8px 0; text-decoration: none; color: var(--muted); font-size: 0.75rem; gap: 2px; }
.bottom-nav a.active { color: var(--text); }
.fab { position: fixed; right: 16px; bottom: calc(72px + env(safe-area-inset-bottom)); width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 2rem; text-decoration: none; box-shadow: 0 4px 12px #0008; z-index: 11; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font: inherit; cursor: pointer; min-height: 44px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.danger { border-color: var(--neg); color: var(--neg); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

.form { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; border: 0; padding: 0; margin: 0; }
.field > span, .field legend { font-size: 0.8rem; color: var(--muted); }
.field input, .field select, .field textarea { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px; font: inherit; min-height: 44px; width: 100%; }
.field.flag input, .field.flag select, .flag.card-chip { border-color: var(--flag); box-shadow: 0 0 0 1px var(--flag); }
.row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.money { display: flex; gap: 6px; }
.money .sign { width: 44px; flex: none; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); font-size: 1.2rem; color: var(--text); }
.money .sign.neg { color: var(--neg); }
.money .sign.pos { color: var(--pos); }

.card-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.card-chip { min-width: 44px; height: 56px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: #fff; font-weight: 700; font-size: 1.05rem; cursor: pointer; }
.card-chip.s, .suit.s { background: var(--spade); }
.card-chip.h, .suit.h { background: var(--heart); }
.card-chip.d, .suit.d { background: var(--diamond); }
.card-chip.c, .suit.c { background: var(--club); }
.card-mini { display: inline-block; padding: 2px 4px; border-radius: 4px; color: #fff; font-weight: 700; font-size: 0.85rem; margin-right: 2px; }
.picker-pop { margin-top: 6px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.picker-row { display: flex; flex-wrap: wrap; gap: 4px; }
.picker-row button { min-width: 40px; min-height: 40px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font: inherit; font-weight: 700; }
.picker-row button[aria-pressed='true'] { outline: 2px solid var(--accent); }

.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.days-table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; white-space: nowrap; }
.days-table th, .days-table td { padding: 8px 10px; text-align: right; border-bottom: 1px solid var(--border); }
.days-table th { color: var(--muted); font-weight: 600; font-size: 0.8rem; background: var(--surface); }
.days-table .sticky { position: sticky; left: 0; text-align: left; background: var(--surface); }
.days-table tfoot td { font-weight: 700; background: var(--surface-2); }
.days-table tfoot .sticky { background: var(--surface-2); }

.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
.stat-card .label { font-size: 0.75rem; color: var(--muted); }
.stat-card .value { font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; }

.list { display: flex; flex-direction: column; gap: 6px; }
.list-item, .hand-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; text-decoration: none; }
.hand-row .grow, .list-item .grow { flex: 1; min-width: 0; }
.kind { font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: var(--surface-2); }
.kind.allin { color: var(--flag); }
.thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; background: var(--surface-2); }

.shot { width: 100%; border-radius: 8px; border: 1px solid var(--border); }
.zoom-wrap { overflow: auto; max-height: 70vh; border-radius: 8px; }
.zoom-wrap img { width: 100%; }
.zoom-wrap.zoomed img { width: 250%; max-width: none; }
.filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
```

- [ ] **Step 6: Ejecutar tests y typecheck**

Run: `npx vitest run src/ui && npm run typecheck`
Expected: PASS y sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add src vite.config.ts
git commit -m "feat(ui): estructura de la app, navegación, estilos y Ajustes con copia de seguridad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Componentes de formulario (cartas, cifras, resumen y mano)

**Files:**
- Create: `src/ui/components/CardPicker.tsx`, `src/ui/components/CardChip.tsx`, `src/ui/components/fields.tsx`, `src/ui/components/SummaryForm.tsx`, `src/ui/components/HandForm.tsx`, `src/ui/components/handValidation.ts`
- Test: `src/ui/components/handValidation.test.ts`, `src/ui/components/forms.test.tsx`

**Interfaces:**
- Consumes: `PartialCard`, `AllinDraft`, `HandField`, `SummaryField`, `RANKS`, `SUITS`, `SUIT_SYMBOL`, `SUIT_NAME`, `formatCard`, `POSITIONS`, `STREETS`, `parseDecimal`, `toLocalInput`, `fromLocalInput`, `allinEv`, `fmtCny`.
- Produces:
  - `CardPicker({ value: PartialCard; onChange(c: PartialCard): void; label: string; flagged?: boolean })`
  - `CardChip({ card: Card })`
  - Campos:
    - `NumberField({ label; value: number | null; onChange; flagged?; integer? })`
    - `MoneyField({ label; value: number | null; onChange; flagged? })`
    - `DurationField({ value: number | null; onChange; flagged? })`
    - `DateTimeField({ label; value: number | null; onChange; flagged? })`
  - `interface SummaryFormInitial { startedAt: number | null; resultCny: number | null; hands: number | null; durationSec: number | null; note?: string }`
  - `interface SummaryValues { startedAt: number; resultCny: number; hands: number; durationSec: number; note?: string }`
  - `SummaryForm({ initial; uncertain?: readonly string[]; onSave(v: SummaryValues): void | Promise<void>; onCancel(): void; cancelLabel?: string })`
  - `interface HandFormState { handId: string; playedAt: number | null; heroPosition: Position | null; heroCards: PartialCard[]; board: PartialCard[]; heroResultCny: number | null; kind: 'allin' | 'study'; allin: AllinDraft; tags: string; note: string }`
  - `handStateFromDraft(d: HandDraft): HandFormState`, `handStateFromHand(h: Hand): HandFormState`
  - `toHandValues(s: HandFormState): HandValues | null`
  - `HandForm({ initial: HandFormState; uncertain?: readonly string[]; onSave(v: HandValues): void | Promise<void>; onCancel(): void; cancelLabel?: string })`

- [ ] **Step 1: Escribir los tests que fallan**

`src/ui/components/handValidation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { emptyHandDraft } from '../../parsers/hand';
import { handStateFromDraft, toHandValues, type HandFormState } from './handValidation';

const complete: HandFormState = {
  handId: '1323539300829384704', playedAt: 1, heroPosition: 'BTN',
  heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }],
  board: [{ rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }],
  heroResultCny: -156.1, kind: 'allin',
  allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
  tags: ' cooler, flop ,', note: '',
};

describe('toHandValues', () => {
  it('convierte un estado completo', () => {
    expect(toHandValues(complete)).toEqual({
      handId: '1323539300829384704', playedAt: 1, heroPosition: 'BTN',
      heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }],
      board: [{ rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }],
      heroResultCny: -156.1, kind: 'allin',
      allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
      tags: ['cooler', 'flop'], note: undefined,
    });
  });
  it('estudio: descarta los datos de all-in', () => {
    expect(toHandValues({ ...complete, kind: 'study' })?.allin).toBeUndefined();
  });
  it('rechaza estados incompletos', () => {
    expect(toHandValues({ ...complete, handId: ' ' })).toBeNull();
    expect(toHandValues({ ...complete, heroPosition: null })).toBeNull();
    expect(toHandValues({ ...complete, heroCards: [{ rank: 'K', suit: null }, { rank: 'Q', suit: 's' }] })).toBeNull();
    expect(toHandValues({ ...complete, board: [{ rank: null, suit: 'c' }] })).toBeNull();
    expect(toHandValues({ ...complete, heroResultCny: null })).toBeNull();
    expect(toHandValues({ ...complete, allin: { ...complete.allin, heroEquity: null } })).toBeNull();
    expect(toHandValues({ ...complete, allin: { ...complete.allin, heroEquity: 1.2 } })).toBeNull();
  });
  it('rechaza cartas repetidas', () => {
    expect(toHandValues({ ...complete, board: [{ rank: 'K', suit: 's' }] })).toBeNull();
  });
  it('construye el estado desde un borrador vacío', () => {
    const s = handStateFromDraft(emptyHandDraft());
    expect(s.handId).toBe('');
    expect(s.allin).toEqual({ street: null, heroEquity: null, potContested: null, heroInvested: null });
  });
});
```

`src/ui/components/forms.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PartialCard } from '../../parsers/hand';
import { CardPicker } from './CardPicker';
import { SummaryForm } from './SummaryForm';

function PickerHarness({ onChange }: { onChange: (c: PartialCard) => void }) {
  const [v, setV] = useState<PartialCard>({ rank: null, suit: null });
  return <CardPicker label="Carta 1" value={v} onChange={(c) => { setV(c); onChange(c); }} />;
}

describe('CardPicker', () => {
  it('elige rango y palo', async () => {
    const onChange = vi.fn();
    render(<PickerHarness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Carta 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    await userEvent.click(screen.getByRole('button', { name: 'diamantes' }));
    expect(onChange).toHaveBeenLastCalledWith({ rank: 'A', suit: 'd' });
    expect(screen.getByRole('button', { name: 'Carta 1' })).toHaveTextContent('A♦');
  });
});

describe('SummaryForm', () => {
  it('no deja guardar hasta completar los campos y devuelve los valores', async () => {
    const onSave = vi.fn();
    render(
      <SummaryForm
        initial={{ startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: null, durationSec: 133 }}
        uncertain={['hands']}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Manos'), '18');
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: 18, durationSec: 133, note: undefined });
  });
  it('el botón ± cambia el signo del resultado', async () => {
    const onSave = vi.fn();
    render(<SummaryForm initial={{ startedAt: 1, resultCny: 13, hands: 18, durationSec: 133 }} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar signo de Resultado ¥' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave.mock.calls[0][0].resultCny).toBe(-13);
  });
});
```

- [ ] **Step 2: Ejecutarlos para verificar que fallan**

Run: `npx vitest run src/ui/components`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar la validación `src/ui/components/handValidation.ts`**

```ts
import type { Card, Hand, HandValues, Position } from '../../domain/types';
import type { AllinDraft, HandDraft, PartialCard } from '../../parsers/hand';

export interface HandFormState {
  handId: string;
  playedAt: number | null;
  heroPosition: Position | null;
  heroCards: PartialCard[];
  board: PartialCard[];
  heroResultCny: number | null;
  kind: 'allin' | 'study';
  allin: AllinDraft;
  tags: string;
  note: string;
}

const EMPTY_ALLIN: AllinDraft = { street: null, heroEquity: null, potContested: null, heroInvested: null };

export function handStateFromDraft(d: HandDraft): HandFormState {
  return {
    handId: d.handId ?? '', playedAt: d.playedAt, heroPosition: d.heroPosition,
    heroCards: d.heroCards.map((c) => ({ ...c })), board: d.board.map((c) => ({ ...c })),
    heroResultCny: d.heroResultCny, kind: d.kind, allin: d.allin ? { ...d.allin } : { ...EMPTY_ALLIN }, tags: '', note: '',
  };
}

export function handStateFromHand(h: Hand): HandFormState {
  return {
    handId: h.handId, playedAt: h.playedAt, heroPosition: h.heroPosition,
    heroCards: h.heroCards.map((c) => ({ ...c })), board: h.board.map((c) => ({ ...c })),
    heroResultCny: h.heroResultCny, kind: h.kind, allin: h.allin ? { ...h.allin } : { ...EMPTY_ALLIN },
    tags: h.tags.join(', '), note: h.note ?? '',
  };
}

const complete = (c: PartialCard): c is Card => c.rank !== null && c.suit !== null;

export function toHandValues(s: HandFormState): HandValues | null {
  const handId = s.handId.trim();
  if (!handId || s.playedAt === null || s.heroPosition === null || s.heroResultCny === null) return null;
  if (s.heroCards.length !== 2 || !s.heroCards.every(complete) || !s.board.every(complete) || s.board.length > 5) return null;
  const cards = [...s.heroCards, ...s.board] as Card[];
  if (new Set(cards.map((c) => c.rank + c.suit)).size !== cards.length) return null;
  let allin: HandValues['allin'];
  if (s.kind === 'allin') {
    const a = s.allin;
    if (a.street === null || a.heroEquity === null || a.potContested === null || a.heroInvested === null) return null;
    if (a.heroEquity < 0 || a.heroEquity > 1) return null;
    allin = { street: a.street, heroEquity: a.heroEquity, potContested: a.potContested, heroInvested: a.heroInvested };
  }
  return {
    handId, playedAt: s.playedAt, heroPosition: s.heroPosition,
    heroCards: [cards[0], cards[1]], board: cards.slice(2), heroResultCny: s.heroResultCny, kind: s.kind, allin,
    tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean),
    note: s.note.trim() || undefined,
  };
}
```

- [ ] **Step 4: Implementar los componentes**

`src/ui/components/CardChip.tsx`:
```tsx
import { formatCard } from '../../domain/cards';
import type { Card } from '../../domain/types';

export function CardChip({ card }: { card: Card }) {
  return <span className={`card-mini suit ${card.suit}`}>{formatCard(card)}</span>;
}
```

`src/ui/components/CardPicker.tsx`:
```tsx
import { useState } from 'react';
import { RANKS, SUIT_NAME, SUIT_SYMBOL, SUITS } from '../../domain/cards';
import type { PartialCard } from '../../parsers/hand';

export function CardPicker({ value, onChange, label, flagged }: { value: PartialCard; onChange: (c: PartialCard) => void; label: string; flagged?: boolean }) {
  const [open, setOpen] = useState(false);
  const complete = value.rank !== null && value.suit !== null;
  const text = `${value.rank === 'T' ? '10' : (value.rank ?? '?')}${value.suit ? SUIT_SYMBOL[value.suit] : '?'}`;
  return (
    <div className="card-picker">
      <button
        type="button"
        aria-label={label}
        className={`card-chip ${value.suit ?? ''} ${!complete || flagged ? 'flag' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {text}
      </button>
      {open && (
        <div className="picker-pop" role="group" aria-label={`Elegir ${label}`}>
          <div className="picker-row">
            {RANKS.map((r) => (
              <button type="button" key={r} aria-label={r === 'T' ? '10' : r} aria-pressed={value.rank === r} onClick={() => onChange({ ...value, rank: r })}>
                {r === 'T' ? '10' : r}
              </button>
            ))}
          </div>
          <div className="picker-row">
            {SUITS.map((s) => (
              <button type="button" key={s} className={`suit ${s}`} aria-label={SUIT_NAME[s]} aria-pressed={value.suit === s} onClick={() => onChange({ ...value, suit: s })}>
                {SUIT_SYMBOL[s]}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setOpen(false)}>Listo</button>
        </div>
      )}
    </div>
  );
}
```

`src/ui/components/fields.tsx`:
```tsx
import { useState } from 'react';
import { fromLocalInput, parseDecimal, toLocalInput } from '../../domain/format';

const cls = (flagged: boolean | undefined, empty: boolean) => `field ${flagged || empty ? 'flag' : ''}`;

export function NumberField({ label, value, onChange, flagged, integer }: {
  label: string; value: number | null; onChange: (v: number | null) => void; flagged?: boolean; integer?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <label className={cls(flagged, value === null)}>
      <span>{label}</span>
      <input
        aria-label={label}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseDecimal(e.target.value);
          onChange(v !== null && integer && !Number.isInteger(v) ? null : v);
        }}
      />
    </label>
  );
}

export function MoneyField({ label, value, onChange, flagged }: {
  label: string; value: number | null; onChange: (v: number | null) => void; flagged?: boolean;
}) {
  const [neg, setNeg] = useState(value !== null && value < 0);
  const [text, setText] = useState(value === null ? '' : Math.abs(value).toFixed(2));
  const emit = (t: string, n: boolean) => {
    const v = parseDecimal(t);
    onChange(v === null ? null : n ? -v : v);
  };
  return (
    <div className={cls(flagged, value === null)}>
      <span>{label}</span>
      <div className="money">
        <button type="button" className={`sign ${neg ? 'neg' : 'pos'}`} aria-label={`Cambiar signo de ${label}`} onClick={() => { setNeg(!neg); emit(text, !neg); }}>
          {neg ? '−' : '+'}
        </button>
        <input aria-label={label} inputMode="decimal" value={text} onChange={(e) => { setText(e.target.value); emit(e.target.value, neg); }} />
      </div>
    </div>
  );
}

export function DurationField({ value, onChange, flagged }: { value: number | null; onChange: (v: number | null) => void; flagged?: boolean }) {
  const init = value ?? 0;
  const [parts, setParts] = useState(
    value === null ? ['', '', ''] : [Math.floor(init / 3600), Math.floor((init % 3600) / 60), init % 60].map(String),
  );
  const labels = ['Horas', 'Minutos', 'Segundos'];
  const update = (i: number, t: string) => {
    const next = parts.map((p, j) => (j === i ? t : p));
    setParts(next);
    const [h, m, s] = next.map((p) => parseDecimal(p));
    const ok = [h, m, s].every((n) => n !== null && Number.isInteger(n)) && m! < 60 && s! < 60;
    onChange(ok ? h! * 3600 + m! * 60 + s! : null);
  };
  return (
    <div className={cls(flagged, value === null)}>
      <span>Duración (HH:MM:SS)</span>
      <div className="row3">
        {parts.map((p, i) => (
          <input key={labels[i]} aria-label={labels[i]} inputMode="numeric" value={p} onChange={(e) => update(i, e.target.value)} />
        ))}
      </div>
    </div>
  );
}

export function DateTimeField({ label, value, onChange, flagged }: {
  label: string; value: number | null; onChange: (v: number | null) => void; flagged?: boolean;
}) {
  return (
    <label className={cls(flagged, value === null)}>
      <span>{label}</span>
      <input aria-label={label} type="datetime-local" step={1} value={value === null ? '' : toLocalInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />
    </label>
  );
}
```

`src/ui/components/SummaryForm.tsx`:
```tsx
import { useState } from 'react';
import { DateTimeField, DurationField, MoneyField, NumberField } from './fields';

export interface SummaryFormInitial { startedAt: number | null; resultCny: number | null; hands: number | null; durationSec: number | null; note?: string }
export interface SummaryValues { startedAt: number; resultCny: number; hands: number; durationSec: number; note?: string }

export function SummaryForm({ initial, uncertain = [], onSave, onCancel, cancelLabel = 'Descartar' }: {
  initial: SummaryFormInitial;
  uncertain?: readonly string[];
  onSave: (v: SummaryValues) => void | Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [resultCny, setResultCny] = useState(initial.resultCny);
  const [hands, setHands] = useState(initial.hands);
  const [durationSec, setDurationSec] = useState(initial.durationSec);
  const [note, setNote] = useState(initial.note ?? '');
  const flagged = new Set(uncertain);
  const valid = startedAt !== null && resultCny !== null && hands !== null && durationSec !== null;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void onSave({ startedAt: startedAt!, resultCny: resultCny!, hands: hands!, durationSec: durationSec!, note: note.trim() || undefined });
      }}
    >
      <DateTimeField label="Fecha y hora" value={startedAt} onChange={setStartedAt} />
      <MoneyField label="Resultado ¥" value={resultCny} onChange={setResultCny} flagged={flagged.has('resultCny')} />
      <NumberField label="Manos" value={hands} onChange={setHands} integer flagged={flagged.has('hands')} />
      <DurationField value={durationSec} onChange={setDurationSec} flagged={flagged.has('durationSec')} />
      <label className="field">
        <span>Nota (opcional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>
      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!valid}>Guardar</button>
        <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
      </div>
    </form>
  );
}
```

`src/ui/components/HandForm.tsx`:
```tsx
import { useState } from 'react';
import { fmtCny } from '../../domain/format';
import { allinEv } from '../../domain/stats';
import { POSITIONS, STREETS, type HandValues, type Position, type Street } from '../../domain/types';
import type { PartialCard } from '../../parsers/hand';
import { CardPicker } from './CardPicker';
import { DateTimeField, MoneyField, NumberField } from './fields';
import { toHandValues, type HandFormState } from './handValidation';

const STREET_LABEL: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn' };

export function HandForm({ initial, uncertain = [], onSave, onCancel, cancelLabel = 'Descartar' }: {
  initial: HandFormState;
  uncertain?: readonly string[];
  onSave: (v: HandValues) => void | Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [s, setS] = useState<HandFormState>(initial);
  const set = <K extends keyof HandFormState>(k: K, v: HandFormState[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const setAllin = (patch: Partial<HandFormState['allin']>) => setS((prev) => ({ ...prev, allin: { ...prev.allin, ...patch } }));
  const flagged = new Set(uncertain);
  const values = toHandValues(s);
  const setCard = (list: 'heroCards' | 'board', i: number, c: PartialCard) => set(list, s[list].map((x, j) => (j === i ? c : x)));

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (values) void onSave(values); }}>
      <label className={`field ${flagged.has('handId') || !s.handId.trim() ? 'flag' : ''}`}>
        <span>ID de la mano</span>
        <input aria-label="ID de la mano" inputMode="numeric" value={s.handId} onChange={(e) => set('handId', e.target.value)} />
      </label>
      <DateTimeField label="Fecha y hora" value={s.playedAt} onChange={(v) => set('playedAt', v)} flagged={flagged.has('playedAt')} />
      <label className={`field ${flagged.has('heroPosition') || !s.heroPosition ? 'flag' : ''}`}>
        <span>Posición</span>
        <select aria-label="Posición" value={s.heroPosition ?? ''} onChange={(e) => set('heroPosition', (e.target.value || null) as Position | null)}>
          <option value="">—</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <div className="field">
        <span>Tus cartas</span>
        <div className="card-row">
          {s.heroCards.map((c, i) => (
            <CardPicker key={i} label={`Tu carta ${i + 1}`} value={c} flagged={flagged.has('heroCards')} onChange={(v) => setCard('heroCards', i, v)} />
          ))}
        </div>
      </div>
      <div className="field">
        <span>Tablero</span>
        <div className="card-row">
          {s.board.map((c, i) => (
            <CardPicker key={i} label={`Tablero ${i + 1}`} value={c} flagged={flagged.has('board')} onChange={(v) => setCard('board', i, v)} />
          ))}
          {s.board.length < 5 && <button type="button" className="btn" onClick={() => set('board', [...s.board, { rank: null, suit: null }])}>+ carta</button>}
          {s.board.length > 0 && <button type="button" className="btn" onClick={() => set('board', s.board.slice(0, -1))}>− carta</button>}
        </div>
      </div>
      <MoneyField label="Tu resultado ¥" value={s.heroResultCny} onChange={(v) => set('heroResultCny', v)} flagged={flagged.has('heroResultCny')} />
      <fieldset className="field">
        <legend>Tipo</legend>
        <label><input type="radio" checked={s.kind === 'allin'} onChange={() => set('kind', 'allin')} /> All-in propio (cuenta para EV)</label>
        <label><input type="radio" checked={s.kind === 'study'} onChange={() => set('kind', 'study')} /> Estudio</label>
      </fieldset>
      {s.kind === 'allin' && (
        <>
          <label className={`field ${s.allin.street === null ? 'flag' : ''}`}>
            <span>Calle del all-in</span>
            <select aria-label="Calle del all-in" value={s.allin.street ?? ''} onChange={(e) => setAllin({ street: (e.target.value || null) as Street | null })}>
              <option value="">—</option>
              {STREETS.map((st) => <option key={st} value={st}>{STREET_LABEL[st]}</option>)}
            </select>
          </label>
          <NumberField
            label="Tu equity %"
            value={s.allin.heroEquity === null ? null : Math.round(s.allin.heroEquity * 100)}
            onChange={(v) => setAllin({ heroEquity: v === null ? null : v / 100 })}
            integer
          />
          <NumberField label="Bote disputado ¥" value={s.allin.potContested} onChange={(v) => setAllin({ potContested: v })} flagged={flagged.has('allin')} />
          <NumberField label="Lo que pusiste ¥" value={s.allin.heroInvested} onChange={(v) => setAllin({ heroInvested: v })} flagged={flagged.has('allin')} />
          {values?.allin && <p className="muted">EV: {fmtCny(allinEv(values.allin))} · Suerte: {fmtCny(values.heroResultCny - allinEv(values.allin))}</p>}
        </>
      )}
      <label className="field">
        <span>Etiquetas (separadas por comas)</span>
        <input value={s.tags} onChange={(e) => set('tags', e.target.value)} />
      </label>
      <label className="field">
        <span>Notas</span>
        <textarea value={s.note} onChange={(e) => set('note', e.target.value)} rows={3} />
      </label>
      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!values}>Guardar</button>
        <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Ejecutar tests y typecheck**

Run: `npx vitest run src/ui && npm run typecheck`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components
git commit -m "feat(ui): formularios de confirmación (selector de cartas, cifras con signo, resumen y mano)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Pantalla Subir (cola de capturas, confirmación, duplicados y aprendizaje)

**Files:**
- Create: `src/ui/pages/UploadPage.tsx`
- Modify: `src/ui/App.tsx` (ruta `/subir`)

**Interfaces:**
- Consumes: `analyzeFile`, `IncomingFile`, `Analysis`, `decodeImageFile`, `getBrowserEngine`, `takeSharedFiles`, `templatesToLearn`, `loadTemplates`, `addChunk`, `addHand`, `addTemplates`, `findSimilarChunk`, `findHandByHandId`, `DuplicateHandError`, `emptySummaryDraft`, `emptyHandDraft`, `SummaryForm`, `HandForm`, `handStateFromDraft`, `useObjectUrl`, `useSettings`.
- Produces: `UploadPage`.

Esta pantalla es orquestación: la lógica que decide (análisis, validación, duplicados y aprendizaje) ya está cubierta por tests en las Tasks 11–15. Aquí se verifica a mano en el paso 3.

- [ ] **Step 1: Implementar `src/ui/pages/UploadPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { addChunk, addHand, addTemplates, DuplicateHandError, findHandByHandId, findSimilarChunk, loadTemplates } from '../../db/repo';
import type { Hand, HandValues } from '../../domain/types';
import { decodeImageFile } from '../../import/decodeImage';
import { templatesToLearn } from '../../import/learn';
import { analyzeFile, type Analysis, type IncomingFile } from '../../import/pipeline';
import { takeSharedFiles } from '../../import/shared';
import { getBrowserEngine } from '../../ocr/loader';
import { emptyHandDraft } from '../../parsers/hand';
import { emptySummaryDraft } from '../../parsers/summary';
import { HandForm } from '../components/HandForm';
import { handStateFromDraft } from '../components/handValidation';
import { SummaryForm, type SummaryValues } from '../components/SummaryForm';
import { useObjectUrl, useSettings } from '../hooks';

type State =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; analysis: Analysis; duplicate?: Hand };

async function readFiles(list: FileList): Promise<IncomingFile[]> {
  return Promise.all(
    [...list].map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type || 'image/png', lastModified: f.lastModified || Date.now(), name: f.name })),
  );
}

export function UploadPage() {
  const db = useDb();
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [queue, setQueue] = useState<IncomingFile[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<State>({ status: 'idle' });
  const current = queue[index];
  const previewUrl = useObjectUrl(current?.bytes, current?.mime);
  const heroName = settings?.heroName;

  useEffect(() => {
    if (params.get('shared') !== '1') return;
    void takeSharedFiles().then((files) => {
      if (files.length) {
        setQueue(files);
        setIndex(0);
      }
    });
  }, [params]);

  useEffect(() => {
    if (!current || !heroName) return;
    let cancelled = false;
    setState({ status: 'analyzing' });
    (async () => {
      try {
        const engine = await getBrowserEngine();
        const templates = await loadTemplates(db);
        const analysis = await analyzeFile(current, { engine, decode: decodeImageFile, templates, heroName });
        const duplicate = analysis.kind === 'hand' && analysis.draft.handId ? await findHandByHandId(db, analysis.draft.handId) : undefined;
        if (!cancelled) setState({ status: 'ready', analysis, duplicate });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, heroName, db]);

  function next() {
    if (index + 1 < queue.length) setIndex(index + 1);
    else {
      setQueue([]);
      setIndex(0);
      setState({ status: 'idle' });
      navigate('/dias');
    }
  }

  if (!settings) return <p className="muted page">Cargando…</p>;

  if (!current) {
    return (
      <section className="page">
        <h1>Subir capturas</h1>
        <p className="muted">Elige capturas de "My stats" o manos descargadas de WPT. Puedes elegir varias a la vez.</p>
        <label className="btn primary">
          Elegir de la galería
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) void readFiles(e.target.files).then((f) => { setQueue(f); setIndex(0); }); }} />
        </label>
      </section>
    );
  }

  const image = state.status === 'ready' ? state.analysis.image : null;
  const imageInput = () => ({ bytes: current.bytes, mime: current.mime, width: image!.width, height: image!.height });

  async function saveSummary(v: SummaryValues) {
    const similar = await findSimilarChunk(db, v, settings!.dayCutoffHour);
    if (similar && !window.confirm('Ya hay un tramo con el mismo resultado, manos y duración ese día. ¿Guardarlo de todas formas?')) return;
    await addChunk(db, { ...v, stakes: settings!.stakes }, imageInput());
    next();
  }

  async function saveHand(v: HandValues) {
    if (state.status !== 'ready' || state.analysis.kind !== 'hand') return;
    try {
      await addHand(db, v, imageInput());
    } catch (e) {
      if (e instanceof DuplicateHandError) {
        window.alert('Esta mano ya está guardada.');
        return;
      }
      throw e;
    }
    await addTemplates(db, templatesToLearn(state.analysis.draft, v));
    next();
  }

  return (
    <section className="page">
      <h1>Subir capturas</h1>
      <p className="muted">Captura {index + 1} de {queue.length}</p>
      {previewUrl && <img className="shot" src={previewUrl} alt="Captura a confirmar" />}
      {state.status === 'analyzing' && <p role="status">Leyendo captura…</p>}
      {state.status === 'error' && (
        <>
          <p className="warning">{state.message}</p>
          <button type="button" className="btn" onClick={next}>Saltar</button>
        </>
      )}
      {state.status === 'ready' && state.analysis.kind === 'unknown' && (
        <>
          <p className="warning">No reconocí esta captura. ¿Qué es?</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setState({ status: 'ready', analysis: { kind: 'summary', draft: emptySummaryDraft(), image: state.analysis.image } })}>Es un resumen (My stats)</button>
            <button type="button" className="btn" onClick={() => setState({ status: 'ready', analysis: { kind: 'hand', draft: emptyHandDraft(), image: state.analysis.image } })}>Es una mano</button>
            <button type="button" className="btn" onClick={next}>Descartar</button>
          </div>
        </>
      )}
      {state.status === 'ready' && state.analysis.kind === 'summary' && (
        <SummaryForm
          key={index}
          initial={{
            startedAt: current.lastModified,
            resultCny: state.analysis.draft.resultCny,
            hands: state.analysis.draft.hands,
            durationSec: state.analysis.draft.durationSec,
          }}
          uncertain={state.analysis.draft.uncertain}
          onSave={saveSummary}
          onCancel={next}
        />
      )}
      {state.status === 'ready' && state.analysis.kind === 'hand' && state.duplicate && (
        <>
          <p className="warning">Esta mano ya está guardada.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => navigate(`/manos/${state.duplicate!.id}`)}>Ver mano guardada</button>
            <button type="button" className="btn" onClick={next}>Siguiente</button>
          </div>
        </>
      )}
      {state.status === 'ready' && state.analysis.kind === 'hand' && !state.duplicate && (
        <HandForm key={index} initial={handStateFromDraft(state.analysis.draft)} uncertain={state.analysis.draft.uncertain} onSave={saveHand} onCancel={next} />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Conectar la ruta en `src/ui/App.tsx`**

Sustituye `<Route path="/subir" element={<Placeholder title="Subir" />} />` por:
```tsx
            <Route path="/subir" element={<UploadPage />} />
```
y añade `import { UploadPage } from './pages/UploadPage';`.

- [ ] **Step 3: Verificación manual en el navegador**

Run: `npm run dev` y abre la URL que imprime Vite.
1. En "+" elige los dos fixtures de `tests/fixtures/` a la vez.
2. **Captura 1 de 2 (resumen):** el formulario aparece con −13.00, 18 manos y 00:02:13, y la fecha es la del archivo. Guarda.
3. **Captura 2 de 2 (mano):** ID 1323539300829384704, HJ, A♦ 8♣, tablero 5♣ Q♦ 8♥ 4♣ 3♦, −28.00 y tipo Estudio. Guarda. La app vuelve a Días (aún es un placeholder).
4. Vuelve a subir la mano: debe salir "Esta mano ya está guardada".
5. Cambia en Ajustes el nombre a `HiTeR2504` y sube de nuevo la mano (tras borrarla desde DevTools → Application → IndexedDB, o usando otro navegador): debe salir All-in propio, flop, equity 13, bote 347.20, invertido 156.10 y EV −¥110.96. Restaura el nombre a `RacsoSM`.

Expected: todo lo anterior se cumple sin errores en consola.

- [ ] **Step 4: Tests y typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat(ui): pantalla Subir con OCR, confirmación, duplicados y aprendizaje de rangos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Pantalla Días, detalle del día y aviso de copia

**Files:**
- Create: `src/ui/components/PeriodFilter.tsx`, `src/ui/components/DaysTable.tsx`, `src/ui/components/StatCards.tsx`, `src/ui/components/HandRow.tsx`, `src/ui/components/ImageThumb.tsx`, `src/ui/pages/DaysPage.tsx`, `src/ui/pages/DayDetailPage.tsx`
- Modify: `src/ui/App.tsx` (rutas `/dias` y `/dias/:day`)
- Test: `src/ui/components/DaysTable.test.tsx`

**Interfaces:**
- Consumes: `groupByDay`, `aggregate`, `playingDay`, `periodRange`, `inRange`, `Period`, `DayStats`, `Aggregate`, `needsBackupReminder`, `fmtCny`, `fmtDuration`, `fmtNum`, `fmtDay`, `fmtTime`, `signClass`, `updateChunk`, `deleteChunk`, `SummaryForm`, `useStoredImageUrl`.
- Produces:
  - `PeriodFilter({ value: Period; onChange(p: Period): void })`
  - `DaysTable({ days: DayStats[]; total: Aggregate })`
  - `StatCards({ stats: Aggregate })`
  - `HandRow({ hand: Hand })`
  - `ImageThumb({ imageId: string })`
  - `usePeriodData(period: Period)` en `DaysPage.tsx`, que devuelve `{ settings, chunks, hands, allChunks, allHands } | undefined`
  - `DaysPage`, `DayDetailPage`

- [ ] **Step 1: Escribir el test que falla**

`src/ui/components/DaysTable.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { aggregate, type DayStats } from '../../domain/stats';
import { DEFAULT_SETTINGS } from '../../domain/types';
import { DaysTable } from './DaysTable';

const chunk = { id: 'c', startedAt: 0, resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes, imageId: 'i', createdAt: 0 };

describe('DaysTable', () => {
  it('muestra una fila por día y la fila de totales', () => {
    const day: DayStats = { day: '2026-09-25', ...aggregate([chunk], []) };
    render(<MemoryRouter><DaysTable days={[day]} total={aggregate([chunk], [])} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: '25/09/2026' });
    expect(link).toHaveAttribute('href', '/dias/2026-09-25');
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('-¥13.00')).toHaveClass('neg');
    expect(within(rows[1]).getByText('00:02:13')).toBeInTheDocument();
    expect(within(rows[1]).getByText('-36.11')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Total')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npx vitest run src/ui/components/DaysTable.test.tsx`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar los componentes**

`src/ui/components/DaysTable.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { fmtCny, fmtDay, fmtDuration, fmtNum } from '../../domain/format';
import type { Aggregate, DayStats } from '../../domain/stats';
import { signClass } from '../format';

function StatCells({ s }: { s: Aggregate }) {
  return (
    <>
      <td>{s.chunks}</td>
      <td>{s.hands}</td>
      <td>{fmtDuration(s.durationSec)}</td>
      <td className={signClass(s.resultCny)}>{fmtCny(s.resultCny)}</td>
      <td className={signClass(s.cnyPerHour)}>{s.cnyPerHour === null ? '—' : fmtCny(s.cnyPerHour)}</td>
      <td className={signClass(s.bbPer100)}>{fmtNum(s.bbPer100, 2)}</td>
      <td>{s.allins}</td>
      <td className={signClass(s.allins ? s.luckCny : null)}>{s.allins ? fmtCny(s.luckCny) : '—'}</td>
    </>
  );
}

export function DaysTable({ days, total }: { days: DayStats[]; total: Aggregate }) {
  return (
    <div className="table-wrap">
      <table className="days-table">
        <thead>
          <tr>
            <th className="sticky">Fecha</th><th>Tramos</th><th>Manos</th><th>Tiempo</th><th>Resultado</th>
            <th>¥/h</th><th>bb/100</th><th>All-ins</th><th>Real − EV</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td className="sticky"><Link to={`/dias/${d.day}`}>{fmtDay(d.day)}</Link></td>
              <StatCells s={d} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="sticky">Total</td>
            <StatCells s={total} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

`src/ui/components/StatCards.tsx`:
```tsx
import { fmtCny, fmtDuration, fmtNum } from '../../domain/format';
import type { Aggregate } from '../../domain/stats';
import { signClass } from '../format';

export function StatCards({ stats }: { stats: Aggregate }) {
  const cards = [
    { label: 'Resultado', value: fmtCny(stats.resultCny), cls: signClass(stats.resultCny) },
    { label: 'Manos', value: String(stats.hands), cls: '' },
    { label: 'Tiempo', value: fmtDuration(stats.durationSec), cls: '' },
    { label: '¥/h', value: stats.cnyPerHour === null ? '—' : fmtCny(stats.cnyPerHour), cls: signClass(stats.cnyPerHour) },
    { label: 'bb/100', value: fmtNum(stats.bbPer100, 2), cls: signClass(stats.bbPer100) },
    { label: 'Real − EV', value: stats.allins ? fmtCny(stats.luckCny) : '—', cls: signClass(stats.allins ? stats.luckCny : null) },
  ];
  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <div key={c.label} className="stat-card">
          <div className="label">{c.label}</div>
          <div className={`value ${c.cls}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

`src/ui/components/PeriodFilter.tsx`:
```tsx
import type { Period } from '../../domain/stats';

const OPTIONS: { value: Period['kind']; label: string }[] = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
  { value: 'range', label: 'Rango…' },
];

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="filters">
      <label className="field">
        <span>Periodo</span>
        <select
          aria-label="Periodo"
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as Period['kind'];
            onChange(kind === 'range' ? { kind, from: '2026-01-01', to: '2099-12-31' } : { kind });
          }}
        >
          {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {value.kind === 'range' && (
        <>
          <label className="field"><span>Desde</span><input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
          <label className="field"><span>Hasta</span><input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
        </>
      )}
    </div>
  );
}
```

`src/ui/components/ImageThumb.tsx`:
```tsx
import { useStoredImageUrl } from '../hooks';

export function ImageThumb({ imageId }: { imageId: string }) {
  const url = useStoredImageUrl(imageId);
  return url ? <img className="thumb" src={url} alt="" /> : <span className="thumb" />;
}
```

`src/ui/components/HandRow.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { formatCard } from '../../domain/cards';
import { fmtCny } from '../../domain/format';
import type { Hand } from '../../domain/types';
import { signClass } from '../format';
import { CardChip } from './CardChip';

export function HandRow({ hand }: { hand: Hand }) {
  return (
    <Link to={`/manos/${hand.id}`} className="hand-row">
      <span>{hand.heroCards.map((c) => <CardChip key={c.rank + c.suit} card={c} />)}</span>
      <span className="muted">{hand.heroPosition}</span>
      <span className="grow muted small">{hand.board.map(formatCard).join(' ')}</span>
      <span className={signClass(hand.heroResultCny)}>{fmtCny(hand.heroResultCny)}</span>
      <span className={`kind ${hand.kind}`}>{hand.kind === 'allin' ? 'All-in' : 'Estudio'}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Implementar las páginas**

`src/ui/pages/DaysPage.tsx`:
```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDb } from '../../db/context';
import { needsBackupReminder } from '../../domain/backupReminder';
import { aggregate, groupByDay, inRange, periodRange, playingDay, type Period } from '../../domain/stats';
import { DaysTable } from '../components/DaysTable';
import { PeriodFilter } from '../components/PeriodFilter';
import { useSettings } from '../hooks';

export function usePeriodData(period: Period) {
  const db = useDb();
  const settings = useSettings();
  const data = useLiveQuery(async () => ({ chunks: await db.chunks.toArray(), hands: await db.hands.toArray() }), [db]);
  if (!settings || !data) return undefined;
  const cutoff = settings.dayCutoffHour;
  const range = periodRange(period, playingDay(Date.now(), cutoff));
  return {
    settings,
    allChunks: data.chunks,
    allHands: data.hands,
    chunks: data.chunks.filter((c) => inRange(playingDay(c.startedAt, cutoff), range)),
    hands: data.hands.filter((h) => inRange(playingDay(h.playedAt, cutoff), range)),
  };
}

export function DaysPage() {
  const [period, setPeriod] = useState<Period>({ kind: 'month' });
  const d = usePeriodData(period);
  if (!d) return <p className="muted page">Cargando…</p>;
  const days = groupByDay(d.chunks, d.hands, d.settings.dayCutoffHour);
  const showBanner = needsBackupReminder(d.settings, d.allChunks.length + d.allHands.length, Date.now());
  return (
    <section className="page">
      <h1>Días</h1>
      {showBanner && (
        <p className="warning">
          Hace más de 7 días que no exportas una copia de seguridad. <Link to="/ajustes">Exportar ahora</Link>
        </p>
      )}
      <PeriodFilter value={period} onChange={setPeriod} />
      {days.length === 0 ? (
        <p className="muted">No hay datos en este periodo. Pulsa + para subir tus capturas.</p>
      ) : (
        <DaysTable days={days} total={aggregate(d.chunks, d.hands)} />
      )}
    </section>
  );
}
```

`src/ui/pages/DayDetailPage.tsx`:
```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { deleteChunk, updateChunk } from '../../db/repo';
import { fmtCny, fmtDay, fmtDuration, fmtTime } from '../../domain/format';
import { aggregate, playingDay } from '../../domain/stats';
import type { SessionChunk } from '../../domain/types';
import { signClass } from '../format';
import { HandRow } from '../components/HandRow';
import { ImageThumb } from '../components/ImageThumb';
import { StatCards } from '../components/StatCards';
import { SummaryForm } from '../components/SummaryForm';
import { useSettings, useStoredImageUrl } from '../hooks';

function ChunkItem({ chunk }: { chunk: SessionChunk }) {
  const db = useDb();
  const [editing, setEditing] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const url = useStoredImageUrl(showImage ? chunk.imageId : undefined);
  if (editing) {
    return (
      <SummaryForm
        initial={chunk}
        cancelLabel="Cancelar"
        onCancel={() => setEditing(false)}
        onSave={async (v) => { await updateChunk(db, chunk.id, v); setEditing(false); }}
      />
    );
  }
  return (
    <div className="list-item">
      <button type="button" className="btn" aria-label="Ver captura" onClick={() => setShowImage(!showImage)}><ImageThumb imageId={chunk.imageId} /></button>
      <div className="grow">
        <div>{fmtTime(chunk.startedAt)} · <span className={signClass(chunk.resultCny)}>{fmtCny(chunk.resultCny)}</span></div>
        <div className="muted small">{chunk.hands} manos · {fmtDuration(chunk.durationSec)}{chunk.note ? ` · ${chunk.note}` : ''}</div>
        {url && <img className="shot" src={url} alt="Captura del tramo" />}
      </div>
      <button type="button" className="btn" onClick={() => setEditing(true)}>Editar</button>
      <button type="button" className="btn danger" onClick={() => { if (window.confirm('¿Borrar este tramo?')) void deleteChunk(db, chunk.id); }}>Borrar</button>
    </div>
  );
}

export function DayDetailPage() {
  const { day = '' } = useParams();
  const db = useDb();
  const settings = useSettings();
  const data = useLiveQuery(async () => ({ chunks: await db.chunks.toArray(), hands: await db.hands.toArray() }), [db]);
  if (!settings || !data) return <p className="muted page">Cargando…</p>;
  const cutoff = settings.dayCutoffHour;
  const chunks = data.chunks.filter((c) => playingDay(c.startedAt, cutoff) === day).sort((a, b) => a.startedAt - b.startedAt);
  const hands = data.hands.filter((h) => playingDay(h.playedAt, cutoff) === day).sort((a, b) => a.playedAt - b.playedAt);
  return (
    <section className="page">
      <h1>{fmtDay(day)}</h1>
      <StatCards stats={aggregate(chunks, hands)} />
      <h2>Tramos ({chunks.length})</h2>
      <div className="list">{chunks.map((c) => <ChunkItem key={c.id} chunk={c} />)}</div>
      <h2>Manos ({hands.length})</h2>
      <div className="list">{hands.map((h) => <HandRow key={h.id} hand={h} />)}</div>
    </section>
  );
}
```

- [ ] **Step 5: Conectar las rutas en `src/ui/App.tsx`**

Sustituye los placeholders de `/dias` y `/dias/:day`:
```tsx
            <Route path="/dias" element={<DaysPage />} />
            <Route path="/dias/:day" element={<DayDetailPage />} />
```
e importa `DaysPage` y `DayDetailPage` desde `./pages/DaysPage` y `./pages/DayDetailPage`.

- [ ] **Step 6: Tests, typecheck y verificación manual**

Run: `npm test && npm run typecheck`
Expected: PASS.

Run: `npm run dev`. Con los datos de la Task 16, Días muestra la fila 25/09/2026 con 1 tramo, 18 manos, 00:02:13, −¥13.00, −¥351.88, −36.11 y 0 all-ins. El detalle del día muestra el tramo y la mano, y editar el tramo actualiza la tabla.

- [ ] **Step 7: Commit**

```bash
git add src/ui
git commit -m "feat(ui): tabla de días estilo PokerTracker, detalle del día y aviso de copia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Pantalla Gráficas

**Files:**
- Create: `src/ui/pages/ChartsPage.tsx`
- Modify: `src/ui/App.tsx` (ruta `/graficas`)

**Interfaces:**
- Consumes: `usePeriodData`, `PeriodFilter`, `StatCards`, `aggregate`, `groupByDay`, `cumulativeResult`, `allinSeries`, `fmtDay`, `fmtCny`.
- Produces: `ChartsPage`.

Las series ya están testeadas (Task 3). Recharts no renderiza en jsdom sin tamaño, así que esta pantalla se verifica a mano.

- [ ] **Step 1: Implementar `src/ui/pages/ChartsPage.tsx`**

```tsx
import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCny, fmtDay } from '../../domain/format';
import { aggregate, allinSeries, cumulativeResult, groupByDay, type Period } from '../../domain/stats';
import { PeriodFilter } from '../components/PeriodFilter';
import { StatCards } from '../components/StatCards';
import { usePeriodData } from './DaysPage';

const axis = { stroke: 'var(--muted)', fontSize: 12 };
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' };
const money = (v: unknown) => fmtCny(Number(v));

export function ChartsPage() {
  const [period, setPeriod] = useState<Period>({ kind: 'month' });
  const d = usePeriodData(period);
  if (!d) return <p className="muted page">Cargando…</p>;
  const days = groupByDay(d.chunks, d.hands, d.settings.dayCutoffHour);
  const cum = cumulativeResult(days).map((p) => ({ ...p, label: fmtDay(p.day).slice(0, 5) }));
  const ev = allinSeries(d.hands);
  return (
    <section className="page">
      <h1>Gráficas</h1>
      <PeriodFilter value={period} onChange={setPeriod} />
      <StatCards stats={aggregate(d.chunks, d.hands)} />

      <h2>Resultado acumulado</h2>
      {cum.length === 0 ? (
        <p className="muted">Sin tramos en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={cum} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={56} />
            <Tooltip contentStyle={tooltipStyle} formatter={money} />
            <Line type="monotone" dataKey="cum" name="Resultado" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <h2>All-ins: real vs EV</h2>
      {ev.length <= 1 ? (
        <p className="muted">Todavía no hay all-ins registrados en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ev} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
            <XAxis dataKey="n" {...axis} />
            <YAxis {...axis} width={56} />
            <Tooltip contentStyle={tooltipStyle} formatter={money} labelFormatter={(n) => `All-in #${n}`} />
            <Legend />
            <Line type="monotone" dataKey="real" name="Real" stroke="var(--pos)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ev" name="EV" stroke="var(--flag)" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Conectar la ruta en `src/ui/App.tsx`**

```tsx
            <Route path="/graficas" element={<ChartsPage />} />
```
con `import { ChartsPage } from './pages/ChartsPage';`.

- [ ] **Step 3: Typecheck, tests y verificación manual**

Run: `npm test && npm run typecheck`
Expected: PASS.

Run: `npm run dev` y abre Gráficas. Deben verse las tarjetas y la curva de resultado. Si no hay all-ins, aparece el texto "Todavía no hay all-ins…". Con el all-in de HiTeR de la Task 16 (si lo guardaste), aparecen dos líneas: real −156.10 y EV −110.96.

- [ ] **Step 4: Commit**

```bash
git add src/ui
git commit -m "feat(ui): gráficas de resultado acumulado y all-ins real vs EV

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Biblioteca de manos y detalle

**Files:**
- Create: `src/domain/handFilter.ts`, `src/ui/pages/HandsPage.tsx`, `src/ui/pages/HandDetailPage.tsx`
- Modify: `src/ui/App.tsx` (rutas `/manos` y `/manos/:id`)
- Test: `src/domain/handFilter.test.ts`

**Interfaces:**
- Consumes: `Hand`, `Position`, `playingDay`, `inRange`, `periodRange`, `Period`, `HandRow`, `PeriodFilter`, `HandForm`, `handStateFromHand`, `updateHand`, `deleteHand`, `DuplicateHandError`, `allinEv`, `handLuck`, `useStoredImageUrl`.
- Produces:
  - `interface HandFilter { kind: 'all' | 'allin' | 'study'; position: Position | 'all'; tag: string; range: { from: string; to: string } | null }`
  - `filterHands(hands: Hand[], f: HandFilter, cutoffHour: number): Hand[]` (orden descendente por `playedAt`)
  - `allTags(hands: Hand[]): string[]`
  - `HandsPage`, `HandDetailPage`

- [ ] **Step 1: Escribir el test que falla**

`src/domain/handFilter.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Hand } from './types';
import { allTags, filterHands, type HandFilter } from './handFilter';

const h = (p: Partial<Hand>): Hand => ({
  id: crypto.randomUUID(), handId: crypto.randomUUID(), playedAt: new Date(2026, 8, 25, 12).getTime(), heroPosition: 'BTN',
  heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [], heroResultCny: 0, kind: 'study', tags: [],
  imageId: 'i', createdAt: 0, ...p,
});
const ALL: HandFilter = { kind: 'all', position: 'all', tag: 'all', range: null };

describe('filterHands', () => {
  const hands = [
    h({ kind: 'allin', heroPosition: 'BTN', tags: ['cooler'], playedAt: new Date(2026, 8, 25, 12).getTime() }),
    h({ kind: 'study', heroPosition: 'HJ', tags: ['flop'], playedAt: new Date(2026, 8, 26, 2).getTime() }),
    h({ kind: 'study', heroPosition: 'BTN', tags: [], playedAt: new Date(2026, 9, 1, 12).getTime() }),
  ];
  it('filtra por tipo, posición, etiqueta y rango (con día de juego)', () => {
    expect(filterHands(hands, { ...ALL, kind: 'allin' }, 6)).toHaveLength(1);
    expect(filterHands(hands, { ...ALL, position: 'BTN' }, 6)).toHaveLength(2);
    expect(filterHands(hands, { ...ALL, tag: 'flop' }, 6)).toHaveLength(1);
    expect(filterHands(hands, { ...ALL, range: { from: '2026-09-25', to: '2026-09-25' } }, 6)).toHaveLength(2);
  });
  it('ordena de más reciente a más antigua', () => {
    expect(filterHands(hands, ALL, 6).map((x) => x.playedAt)).toEqual([...hands.map((x) => x.playedAt)].sort((a, b) => b - a));
  });
  it('lista etiquetas únicas ordenadas', () => {
    expect(allTags(hands)).toEqual(['cooler', 'flop']);
  });
});
```

- [ ] **Step 2: Ejecutarlo para verificar que falla**

Run: `npx vitest run src/domain/handFilter.test.ts`
Expected: FAIL por import no resuelto.

- [ ] **Step 3: Implementar `src/domain/handFilter.ts`**

```ts
import { inRange, playingDay } from './stats';
import type { Hand, Position } from './types';

export interface HandFilter {
  kind: 'all' | 'allin' | 'study';
  position: Position | 'all';
  tag: string;
  range: { from: string; to: string } | null;
}

export function filterHands(hands: Hand[], f: HandFilter, cutoffHour: number): Hand[] {
  return hands
    .filter((h) => f.kind === 'all' || h.kind === f.kind)
    .filter((h) => f.position === 'all' || h.heroPosition === f.position)
    .filter((h) => f.tag === 'all' || h.tags.includes(f.tag))
    .filter((h) => inRange(playingDay(h.playedAt, cutoffHour), f.range))
    .sort((a, b) => b.playedAt - a.playedAt);
}

export function allTags(hands: Hand[]): string[] {
  return [...new Set(hands.flatMap((h) => h.tags))].sort((a, b) => a.localeCompare(b));
}
```

- [ ] **Step 4: Ejecutar el test**

Run: `npx vitest run src/domain/handFilter.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar las páginas**

`src/ui/pages/HandsPage.tsx`:
```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useDb } from '../../db/context';
import { allTags, filterHands } from '../../domain/handFilter';
import { periodRange, playingDay, type Period } from '../../domain/stats';
import { POSITIONS, type Position } from '../../domain/types';
import { HandRow } from '../components/HandRow';
import { PeriodFilter } from '../components/PeriodFilter';
import { useSettings } from '../hooks';

export function HandsPage() {
  const db = useDb();
  const settings = useSettings();
  const hands = useLiveQuery(() => db.hands.toArray(), [db]);
  const [kind, setKind] = useState<'all' | 'allin' | 'study'>('all');
  const [position, setPosition] = useState<Position | 'all'>('all');
  const [tag, setTag] = useState('all');
  const [period, setPeriod] = useState<Period>({ kind: 'all' });
  if (!settings || !hands) return <p className="muted page">Cargando…</p>;
  const range = periodRange(period, playingDay(Date.now(), settings.dayCutoffHour));
  const list = filterHands(hands, { kind, position, tag, range }, settings.dayCutoffHour);
  return (
    <section className="page">
      <h1>Manos</h1>
      <div className="filters">
        <label className="field">
          <span>Tipo</span>
          <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">Todas</option>
            <option value="allin">All-in propio</option>
            <option value="study">Estudio</option>
          </select>
        </label>
        <label className="field">
          <span>Posición</span>
          <select aria-label="Posición" value={position} onChange={(e) => setPosition(e.target.value as Position | 'all')}>
            <option value="all">Todas</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Etiqueta</span>
          <select aria-label="Etiqueta" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">Todas</option>
            {allTags(hands).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />
      <p className="muted small">{list.length} manos</p>
      <div className="list">{list.map((h) => <HandRow key={h.id} hand={h} />)}</div>
    </section>
  );
}
```

`src/ui/pages/HandDetailPage.tsx`:
```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { deleteHand, DuplicateHandError, updateHand } from '../../db/repo';
import { formatCard } from '../../domain/cards';
import { fmtCny, toLocalInput } from '../../domain/format';
import { allinEv, handLuck } from '../../domain/stats';
import { signClass } from '../format';
import { CardChip } from '../components/CardChip';
import { HandForm } from '../components/HandForm';
import { handStateFromHand } from '../components/handValidation';
import { useStoredImageUrl } from '../hooks';

export function HandDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const hand = useLiveQuery(() => db.hands.get(id), [db, id]);
  const url = useStoredImageUrl(hand?.imageId);
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);
  if (hand === undefined) return <p className="muted page">Cargando…</p>;

  return (
    <section className="page">
      <h1>Mano {hand.handId}</h1>
      {url && (
        <div className={`zoom-wrap ${zoomed ? 'zoomed' : ''}`}>
          <img src={url} alt="Mano descargada" onClick={() => setZoomed(!zoomed)} />
        </div>
      )}
      <p className="muted small">Toca la imagen para hacer zoom.</p>
      {editing ? (
        <HandForm
          initial={handStateFromHand(hand)}
          cancelLabel="Cancelar"
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            try {
              await updateHand(db, hand.id, v);
              setEditing(false);
            } catch (e) {
              if (e instanceof DuplicateHandError) window.alert('Ya existe otra mano con ese ID.');
              else throw e;
            }
          }}
        />
      ) : (
        <>
          <div className="list-item">
            <div className="grow">
              <div>{hand.heroCards.map((c) => <CardChip key={c.rank + c.suit} card={c} />)} · {hand.heroPosition}</div>
              <div className="muted small">Tablero: {hand.board.map(formatCard).join(' ') || '—'}</div>
              <div className="muted small">{toLocalInput(hand.playedAt).replace('T', ' ')}</div>
            </div>
            <span className={signClass(hand.heroResultCny)}>{fmtCny(hand.heroResultCny)}</span>
          </div>
          {hand.kind === 'allin' && hand.allin && (
            <div className="notice">
              All-in en {hand.allin.street} con {Math.round(hand.allin.heroEquity * 100)}% · bote {fmtCny(hand.allin.potContested).replace('+', '')} · pusiste {fmtCny(hand.allin.heroInvested).replace('+', '')}
              <br />EV {fmtCny(allinEv(hand.allin))} · Suerte {fmtCny(handLuck(hand))}
            </div>
          )}
          {hand.tags.length > 0 && <p className="muted">Etiquetas: {hand.tags.join(', ')}</p>}
          {hand.note && <p>{hand.note}</p>}
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setEditing(true)}>Editar</button>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (!window.confirm('¿Borrar esta mano?')) return;
                await deleteHand(db, hand.id);
                navigate('/manos');
              }}
            >
              Borrar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
```

> Nota: `useLiveQuery` devuelve `undefined` mientras carga y también si el id no existe. Si tras borrar la mano la página sigue en "Cargando…", ese caso ya queda cubierto porque `navigate('/manos')` saca al usuario de la página.

- [ ] **Step 6: Conectar las rutas en `src/ui/App.tsx`**

```tsx
            <Route path="/manos" element={<HandsPage />} />
            <Route path="/manos/:id" element={<HandDetailPage />} />
```
con sus imports. Borra `src/ui/pages/Placeholder.tsx` y su import, porque ya no quedan rutas que lo usen.

- [ ] **Step 7: Tests, typecheck y verificación manual**

Run: `npm test && npm run typecheck`
Expected: PASS.

Run: `npm run dev`. Manos lista la mano guardada. El detalle muestra la captura con zoom al tocar. Al editar, añadir la etiqueta "fold flop" y guardar, la etiqueta aparece en el filtro.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat(ui): biblioteca de manos con filtros y detalle editable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: PWA (instalable, offline, Compartir), iconos, despliegue y README

**Files:**
- Create: `scripts/make-icons.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png` (generados), `netlify.toml`, `README.md`
- Modify: `vite.config.ts`, `src/sw.ts` (reemplazo completo), `src/main.tsx`

**Interfaces:**
- Consumes: `SHARED_CACHE`, `encodePng`.
- Produces: manifest con `share_target` (POST `/share-target`, campo `images`), service worker con precache, caché de `/tesseract/` y receptor de "Compartir".

- [ ] **Step 1: Generar los iconos con `scripts/make-icons.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from '../src/image/rgba';

// Ficha de póker: fondo oscuro, anillo verde con marcas blancas y centro verde.
function chip(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy) / c;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      let col: [number, number, number] = [15, 17, 21];
      if (r < 0.86) col = Math.floor(angle * 8) % 2 === 0 && r > 0.66 ? [240, 240, 240] : [10, 122, 43];
      if (r < 0.62) col = [17, 90, 40];
      if (r < 0.58) col = [10, 122, 43];
      const o = (y * size + x) * 4;
      data.set([...col, 255], o);
    }
  }
  return encodePng({ width: size, height: size, data });
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) writeFileSync(`public/icons/icon-${size}.png`, chip(size));
console.log('Iconos generados');
```

Run: `npx tsx scripts/make-icons.ts`
Expected: `Iconos generados` y aparecen los dos PNG en `public/icons/`.

- [ ] **Step 2: Configurar vite-plugin-pwa en `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        globIgnores: ['tesseract/**'],
      },
      manifest: {
        name: 'Poker Tracker-os',
        short_name: 'PT-os',
        description: 'Estadísticas de poker para salas sin trackers, 100% local.',
        lang: 'es',
        start_url: '/#/dias',
        scope: '/',
        display: 'standalone',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'images', accept: ['image/*'] }] },
        },
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.ocr.test.ts', 'node_modules/**'],
    testTimeout: 20000,
  },
});
```

- [ ] **Step 3: Implementar el service worker `src/sw.ts`**

```ts
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { SHARED_CACHE } from './sharedCache';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Worker, core wasm y datos de idioma de Tesseract: se descargan la primera vez y quedan para uso offline.
registerRoute(({ url }) => url.pathname.startsWith('/tesseract/'), new CacheFirst({ cacheName: 'tesseract-assets' }));

// Destino de "Compartir" en Android: guarda las imágenes y abre la pantalla Subir.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const files = form.getAll('images').filter((f): f is File => f instanceof File);
      const cache = await caches.open(SHARED_CACHE);
      await Promise.all(
        files.map((f, i) =>
          cache.put(`/shared/${Date.now()}-${i}`, new Response(f, { headers: { 'content-type': f.type, 'x-last-modified': String(f.lastModified) } })),
        ),
      );
      return Response.redirect('/#/subir?shared=1', 303);
    })(),
  );
});

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

- [ ] **Step 4: Registrar el service worker en `src/main.tsx`**

Añade, después de los imports:
```tsx
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
```

- [ ] **Step 5: Crear `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

- [ ] **Step 6: Crear `README.md` (en español, para el usuario)**

````markdown
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
````

- [ ] **Step 7: Build y verificación de la PWA**

Run: `npm test && npm run build && npm run preview`
Expected:
- Tests en PASS.
- El build genera `dist/sw.js`, `dist/manifest.webmanifest` y `dist/tesseract/`.
- Con `vite preview` abierto en Chrome, en DevTools → Application → Manifest aparecen el nombre, los iconos y "Share target", sin errores.
- En Service Workers, `sw.js` aparece activado.
- Con "Offline" marcado, al recargar la app sigue abriendo.
- Después de haber subido una captura con conexión, subir otra en modo offline sigue funcionando.

- [ ] **Step 8: Commit y push**

```bash
git add -A
git commit -m "feat(pwa): instalable, offline, destino de Compartir, iconos, Netlify y README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 9: Despliegue y prueba en el móvil (con el usuario)**

El despliegue en Netlify lo hace el usuario con su cuenta, siguiendo la sección "Publicar" del README. Después, en su Android:
1. Instala la app.
2. Sube una captura real de "My stats" y una mano descargada.
3. Comprueba que "Compartir → Poker Tracker-os" abre la pantalla Subir con la imagen.

Cualquier captura que el OCR lea mal se añade a `tests/fixtures/` como nuevo caso de test (spec §9).
