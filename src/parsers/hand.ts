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
