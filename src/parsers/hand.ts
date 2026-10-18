import { inferPot } from '../domain/allin';
import { positionFromPreflopIndex } from '../domain/positions';
import type { Position, Rank, SizeClass, Street, Suit } from '../domain/types';
import type { Rect } from '../image/rgba';
import type { OcrWord } from '../ocr/types';
import type { RowBox } from '../vision/rows';
import type { HandLayout, LayoutCard, LayoutColumn } from './handLayout';
import { AMOUNT, CURRENCY, isNegativeSign, parseAmount, SIGN } from './money';
import { nameMatches } from './names';
import { readingOrder } from './words';

export interface PartialCard { rank: Rank | null; suit: Suit | null }
export type HandField = 'heroPosition' | 'heroCards' | 'board' | 'heroResultCny' | 'allin';
export interface GlyphRef { slot: 'hero' | 'board'; index: number; sizeClass: SizeClass; glyph: string; guessed: Rank | null }
export interface AllinDraft { street: Street | null; heroEquity: number | null; potContested: number | null; heroInvested: number | null }
export interface HandDraft {
  // El identificador y la fecha no se leen de la captura (ver `importedHandDraft`): quien
  // analiza el archivo los pone.
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
export interface HandOcr { full: OcrWord[]; columns: Record<LayoutColumn, OcrWord[]>; table?: OcrWord[] }

const MONEY = new RegExp(`(${SIGN})?\\s*${CURRENCY}\\s*(${AMOUNT})`);
// Verbos de acción en los dos idiomas de la app: marcan dónde acaba el bloque de ciegas
// cuando el móvil funde ciegas y pre-flop en una sola columna.
const ACTION = /^(fold|check|call|bet|raise|all-?in|no|ir|noir|pasar|igualar|apostar|subir)$/i;
// Verbos que delatan una fila de acción en RIVER, con las erratas habituales del OCR ("Tgualar",
// "Nair"). Sin "no" ni "ir" sueltos: el OCR los saca a veces de los dorsos de las cartas.
const RIVER_ACTION = /^(fold|check|call|bet|raise|all-?in|allin|noir|nair|pasar|[it]?gualar|apostar|subir)$/i;
// Las filas de resultado miden todas lo mismo; una fila de acción suele ser más baja (o más alta
// si lleva la etiqueta "All-in").
const RESULT_ROW_TOLERANCE = 0.06;
const MAX_BLIND_ROWS = 4;
// "STR" del straddle; el OCR lee a veces "5TR".
const STR = /^[S5]TR$/i;
const PCT = /^(\d{1,3})%$/;
const MIN_PCT_CONF = 60;
const MIN_MONEY_CONF = 50;
const MAX_RAKE = 0.06;
const EMPTY_CARD: PartialCard = { rank: null, suit: null };

export function emptyHandDraft(): HandDraft {
  return {
    handId: null, playedAt: null, heroPosition: null,
    heroCards: [{ ...EMPTY_CARD }, { ...EMPTY_CARD }], board: [], heroResultCny: null,
    kind: 'study', allin: null,
    uncertain: ['heroPosition', 'heroCards', 'heroResultCny'], glyphs: [],
  };
}

export function parseMoneyText(text: string): number | null {
  const m = MONEY.exec(text);
  if (!m) return null;
  const v = parseAmount(m[2]);
  if (v === null) return null;
  return isNegativeSign(m[1]) ? -v : v;
}

const cx = (w: OcrWord) => (w.x0 + w.x1) / 2;
const cy = (w: OcrWord) => (w.y0 + w.y1) / 2;
const inRect = (w: OcrWord, r: Rect) => cx(w) >= r.x && cx(w) < r.x + r.w && cy(w) >= r.y && cy(w) < r.y + r.h;
const inRow = (w: OcrWord, row: RowBox) => cy(w) >= row.y0 && cy(w) <= row.y1;

// Palabras de una columna según ambas pasadas (la completa y la de columna).
function columnWords(ocr: HandOcr, layout: HandLayout, col: LayoutColumn): OcrWord[] {
  return columnPasses(ocr, layout, col).flat();
}

// Las dos pasadas por separado: mezcladas en una misma fila, sus palabras se intercalan
// ("CN¥ Cy 2 2") y el importe deja de reconocerse.
function columnPasses(ocr: HandOcr, layout: HandLayout, col: LayoutColumn): OcrWord[][] {
  const rect = layout.columns[col].rect;
  return [ocr.full.filter((w) => inRect(w, rect)), ocr.columns[col]];
}

const rowHeight = (row: RowBox) => row.y1 - row.y0;

// La columna RIVER empieza con las acciones del river, si las hubo, y acaba con una fila por
// jugador con su resultado. Esas últimas son el bloque final de filas igual de altas y sin verbo.
function resultRows(ocr: HandOcr, layout: HandLayout): RowBox[] {
  const rows = layout.columns.river.rows;
  const words = columnWords(ocr, layout, 'river');
  let end = rows.length;
  // Una fila cortada por el borde inferior de la captura no es un jugador completo.
  if (end >= 2 && rows[end - 1].y1 >= layout.height - 2 && rowHeight(rows[end - 1]) < rowHeight(rows[end - 2]) * (1 - RESULT_ROW_TOLERANCE)) end--;
  if (end === 0) return [];
  const h = rowHeight(rows[end - 1]);
  let start = end;
  while (start > 0) {
    const row = rows[start - 1];
    if (Math.abs(rowHeight(row) - h) > h * RESULT_ROW_TOLERANCE) break;
    if (words.some((w) => inRow(w, row) && RIVER_ACTION.test(w.text))) break;
    start--;
  }
  return rows.slice(start, end);
}

function heroRowIndex(words: OcrWord[], rows: RowBox[], heroName: string): number {
  return rows.findIndex((row) => words.some((w) => inRow(w, row) && nameMatches(w.text, heroName)));
}

type RowMoney = { value: number | null; conf: number; digitConf: number };

function rowMoney(words: OcrWord[]): RowMoney {
  const ordered = readingOrder(words);
  const value = parseMoneyText(ordered.map((w) => w.text).join(' '));
  const moneyWords = ordered.filter((w) => /[¥Y]/.test(w.text) || /^\d[\d.,]*$/.test(w.text));
  const digitWords = moneyWords.filter((w) => /\d/.test(w.text));
  const minConf = (ws: OcrWord[]) => (ws.length ? Math.min(...ws.map((w) => w.conf)) : 0);
  return { value, conf: minConf(moneyWords), digitConf: minConf(digitWords) };
}

// La pasada por columna es la buena, pero en el móvil a veces no llega a leer importes que
// la pasada completa sí tiene (y al revés): si una falla, se prueba con la otra. Si las dos
// leen el mismo importe, se da por bueno aunque cada una lo leyera con poca confianza.
// Con `loss` (el color del importe, ver `rowIsLoss`) el signo sale del color y no del OCR,
// y la confianza es solo la de las cifras.
function riverRowMoney(ocr: HandOcr, layout: HandLayout, row: RowBox, loss?: boolean): { value: number | null; conf: number } {
  const fromColumn = rowMoney(ocr.columns.river.filter((w) => inRow(w, row)));
  const rect = layout.columns.river.rect;
  const fromFull = rowMoney(ocr.full.filter((w) => inRect(w, rect) && inRow(w, row)));
  const sign = (v: number) => (loss === undefined ? v : loss ? -Math.abs(v) : Math.abs(v));
  const same = (a: number | null, b: number | null) => a !== null && b !== null && sign(a) === sign(b);
  if (same(fromColumn.value, fromFull.value)) return { value: sign(fromColumn.value!), conf: 100 };
  const best = fromColumn.value !== null ? fromColumn : fromFull.value !== null ? fromFull : fromColumn;
  if (best.value === null) return { value: null, conf: best.conf };
  return { value: sign(best.value), conf: loss === undefined ? best.conf : best.digitConf };
}

// Lo que ganan unos lo pierden otros, menos el rake: si todas las filas de resultado cuadran,
// los importes y sus signos están bien leídos aunque el OCR les diera poca confianza (el "-CN¥"
// rosa de las pérdidas casi siempre sale así). Con seguro de all-in no cuadran y siguen en duda.
function riverBalances(money: { value: number | null }[]): boolean {
  if (money.length < 2 || money.some((m) => m.value === null)) return false;
  const gains = money.reduce((a, m) => a + Math.max(0, m.value!), 0);
  const losses = money.reduce((a, m) => a - Math.min(0, m.value!), 0);
  const rake = losses - gains;
  return gains > 0 && rake >= -0.01 && rake <= losses * MAX_RAKE + 0.01;
}

// Porcentajes: primero la pasada completa (más fiable, spec §10a), después la de columna.
// `fromColumn` indica que salió de la pasada por columna, que ya leyó "3%" por "13%".
function rowPercent(ocr: HandOcr, layout: HandLayout, col: LayoutColumn, row: RowBox): { value: number; fromColumn: boolean } | null {
  const rect = layout.columns[col].rect;
  const pick = (ws: OcrWord[]) => {
    for (const w of ws) {
      if (!inRect(w, rect) || !inRow(w, row) || w.conf < MIN_PCT_CONF) continue;
      const m = PCT.exec(w.text);
      if (m && Number(m[1]) <= 100) return Number(m[1]) / 100;
    }
    return null;
  };
  const fromFull = pick(ocr.full);
  if (fromFull !== null) return { value: fromFull, fromColumn: false };
  const fromColumn = pick(ocr.columns[col]);
  return fromColumn === null ? null : { value: fromColumn, fromColumn: true };
}

function isAboveName(card: LayoutCard, name: OcrWord, s: number): boolean {
  const ccx = card.x + card.w / 2;
  const bottom = card.y + card.h;
  return ccx >= name.x0 - 80 * s && ccx <= name.x1 + 80 * s && bottom >= name.y0 - 60 * s && bottom <= name.y0 + 20 * s;
}

// Con ciegas y pre-flop fundidos (móvil), las primeras filas son el bloque de ciegas:
// "Ciegas", la SB, la BB y el straddle si lo hay. Se corta en la primera fila que ya es una
// acción (verbo reconocido o fila sin importe) y, como mucho, tras cuatro filas.
function blindRowCount(passes: OcrWord[][], rows: RowBox[]): number {
  let n = 0;
  while (n < rows.length && n < MAX_BLIND_ROWS) {
    const row = rows[n];
    const inThisRow = passes.map((ws) => ws.filter((w) => inRow(w, row)));
    const hasMoney = inThisRow.some((ws) => parseMoneyText(readingOrder(ws).map((w) => w.text).join(' ')) !== null);
    if (n > 0 && (inThisRow.flat().some((w) => ACTION.test(w.text)) || !hasMoney)) break;
    n++;
  }
  return n;
}

function derivePosition(ocr: HandOcr, layout: HandLayout, heroName: string, nPlayers: number): Position | null {
  const bw = columnWords(ocr, layout, 'blinds');
  const nBlinds = layout.mergedBlinds ? blindRowCount(columnPasses(ocr, layout, 'blinds'), layout.columns.blinds.rows) : layout.columns.blinds.rows.length;
  const blindRows = layout.columns.blinds.rows.slice(0, nBlinds);
  // En el móvil el bloque de ciegas es "Ciegas", SB, BB y, si hay straddle, una cuarta fila:
  // basta con contarlas aunque el OCR no lea bien la etiqueta.
  const straddle =
    (layout.mergedBlinds && nBlinds >= MAX_BLIND_ROWS) || blindRows.some((row) => bw.some((w) => inRow(w, row) && STR.test(w.text)));
  for (const row of blindRows) {
    const ws = bw.filter((w) => inRow(w, row));
    if (!ws.some((w) => nameMatches(w.text, heroName))) continue;
    if (ws.some((w) => /^SB$/i.test(w.text))) return 'SB';
    if (ws.some((w) => /^BB$/i.test(w.text))) return 'BB';
    if (ws.some((w) => STR.test(w.text))) return 'UTG';
  }
  const pfRows = layout.mergedBlinds ? layout.columns.preflop.rows.slice(nBlinds) : layout.columns.preflop.rows;
  const idx = heroRowIndex(columnWords(ocr, layout, 'preflop'), pfRows, heroName);
  return idx < 0 ? null : positionFromPreflopIndex(idx, nPlayers, straddle);
}

export function parseHand(ocr: HandOcr, layout: HandLayout, heroName: string): HandDraft {
  const uncertain = new Set<HandField>();
  const glyphs: GlyphRef[] = [];
  const s = layout.width / 1280;

  const toPartial = (slot: GlyphRef['slot']) => (c: LayoutCard, index: number): PartialCard => {
    if (c.glyph) glyphs.push({ slot, index, sizeClass: c.sizeClass, glyph: c.glyph, guessed: c.rank });
    return { rank: c.rank, suit: c.suit };
  };

  const board = layout.cards.filter((c) => c.sizeClass === 'board').sort((a, b) => a.x - b.x).slice(0, 5).map(toPartial('board'));
  if (board.some((c) => c.rank === null)) uncertain.add('board');

  const nameWord = [...ocr.full, ...(ocr.table ?? [])].find((w) => w.y1 < layout.headerTop && nameMatches(w.text, heroName));
  const heroBlobs = nameWord
    ? layout.cards.filter((c) => c.sizeClass === 'hole' && isAboveName(c, nameWord, s)).sort((a, b) => a.x - b.x).slice(0, 2)
    : [];
  const heroCards = heroBlobs.length === 2 ? heroBlobs.map(toPartial('hero')) : [{ ...EMPTY_CARD }, { ...EMPTY_CARD }];
  if (heroCards.some((c) => c.rank === null || c.suit === null)) uncertain.add('heroCards');

  const results = resultRows(ocr, layout);
  // Si ninguna fila sale en rosa, el color no dice nada (el escritorio no lo usa): manda el OCR.
  const colored = layout.riverLoss.some(Boolean);
  const riverMoney = results.map((row) =>
    riverRowMoney(ocr, layout, row, colored ? layout.riverLoss[layout.columns.river.rows.indexOf(row)] : undefined),
  );
  const heroRiver = heroRowIndex(columnWords(ocr, layout, 'river'), results, heroName);
  const heroMoney = heroRiver >= 0 ? riverMoney[heroRiver] : null;
  const heroResultCny = heroMoney?.value ?? null;
  const balanced = riverBalances(riverMoney);
  if (heroResultCny === null || (heroMoney && heroMoney.conf < MIN_MONEY_CONF && !balanced)) uncertain.add('heroResultCny');

  const heroPosition = derivePosition(ocr, layout, heroName, results.length);
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
      const heroEquity = pcts[idx]!.value;
      if (pcts[idx]!.fromColumn) uncertain.add('allin');
      // El bote se infiere de las filas del héroe, del mayor ganador y de la mayor pérdida:
      // si falta alguna fila de RIVER o esas se leyeron con poca confianza, el bote puede estar mal.
      const known = riverMoney.filter((m) => m.value !== null);
      const maxWin = known.reduce<(typeof known)[number] | null>((a, m) => (m.value! > 0 && (!a || m.value! > a.value!) ? m : a), null);
      const maxLoss = known.reduce<(typeof known)[number] | null>((a, m) => (m.value! < 0 && (!a || m.value! < a.value!) ? m : a), null);
      const used = [heroMoney, maxWin, maxLoss].filter((m) => m !== null);
      if (known.length < riverMoney.length || (used.some((m) => m!.conf < MIN_MONEY_CONF) && !balanced)) uncertain.add('allin');
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

  return { handId: null, playedAt: null, heroPosition, heroCards, board, heroResultCny, kind: allin ? 'allin' : 'study', allin, uncertain: [...uncertain], glyphs };
}
