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
const MAX_BLIND_ROWS = 4;
const PCT = /^(\d{1,3})%$/;
const MIN_PCT_CONF = 60;
const MIN_MONEY_CONF = 50;
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
  const rect = layout.columns[col].rect;
  return [...ocr.full.filter((w) => inRect(w, rect)), ...ocr.columns[col]];
}

function heroRowIndex(words: OcrWord[], rows: RowBox[], heroName: string): number {
  return rows.findIndex((row) => words.some((w) => inRow(w, row) && nameMatches(w.text, heroName)));
}

function rowMoney(words: OcrWord[]): { value: number | null; conf: number } {
  const ordered = readingOrder(words);
  const value = parseMoneyText(ordered.map((w) => w.text).join(' '));
  const moneyWords = ordered.filter((w) => /[¥Y]/.test(w.text) || /^\d[\d.,]*$/.test(w.text));
  return { value, conf: moneyWords.length ? Math.min(...moneyWords.map((w) => w.conf)) : 0 };
}

// La pasada por columna es la buena, pero en el móvil a veces no llega a leer importes que
// la pasada completa sí tiene (y al revés): si una falla, se prueba con la otra.
function riverRowMoney(ocr: HandOcr, layout: HandLayout, row: RowBox): { value: number | null; conf: number } {
  const fromColumn = rowMoney(ocr.columns.river.filter((w) => inRow(w, row)));
  if (fromColumn.value !== null) return fromColumn;
  const rect = layout.columns.river.rect;
  const fromFull = rowMoney(ocr.full.filter((w) => inRect(w, rect) && inRow(w, row)));
  return fromFull.value !== null ? fromFull : fromColumn;
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
function blindRowCount(words: OcrWord[], rows: RowBox[]): number {
  let n = 0;
  while (n < rows.length && n < MAX_BLIND_ROWS) {
    const ws = rows[n] ? words.filter((w) => inRow(w, rows[n])) : [];
    if (n > 0 && (ws.some((w) => ACTION.test(w.text)) || parseMoneyText(readingOrder(ws).map((w) => w.text).join(' ')) === null)) break;
    n++;
  }
  return n;
}

function derivePosition(ocr: HandOcr, layout: HandLayout, heroName: string, nPlayers: number): Position | null {
  const bw = columnWords(ocr, layout, 'blinds');
  const nBlinds = layout.mergedBlinds ? blindRowCount(bw, layout.columns.blinds.rows) : layout.columns.blinds.rows.length;
  const blindRows = layout.columns.blinds.rows.slice(0, nBlinds);
  const straddle = blindRows.some((row) => bw.some((w) => inRow(w, row) && /^STR$/i.test(w.text)));
  for (const row of blindRows) {
    const ws = bw.filter((w) => inRow(w, row));
    if (!ws.some((w) => nameMatches(w.text, heroName))) continue;
    if (ws.some((w) => /^SB$/i.test(w.text))) return 'SB';
    if (ws.some((w) => /^BB$/i.test(w.text))) return 'BB';
    if (ws.some((w) => /^STR$/i.test(w.text))) return 'UTG';
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

  const river = layout.columns.river;
  const riverMoney = river.rows.map((row) => riverRowMoney(ocr, layout, row));
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
      const heroEquity = pcts[idx]!.value;
      if (pcts[idx]!.fromColumn) uncertain.add('allin');
      // El bote se infiere de las filas del héroe, del mayor ganador y de la mayor pérdida:
      // si falta alguna fila de RIVER o esas se leyeron con poca confianza, el bote puede estar mal.
      const known = riverMoney.filter((m) => m.value !== null);
      const maxWin = known.reduce<(typeof known)[number] | null>((a, m) => (m.value! > 0 && (!a || m.value! > a.value!) ? m : a), null);
      const maxLoss = known.reduce<(typeof known)[number] | null>((a, m) => (m.value! < 0 && (!a || m.value! < a.value!) ? m : a), null);
      const used = [heroMoney, maxWin, maxLoss].filter((m) => m !== null);
      if (known.length < riverMoney.length || used.some((m) => m!.conf < MIN_MONEY_CONF)) uncertain.add('allin');
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
