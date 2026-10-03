import type { Rank } from '../domain/types';
import type { RGBA, Rect } from '../image/rgba';
import type { OcrWord } from '../ocr/types';
import { detectCards, type CardBlob } from '../vision/cards';
import { extractGlyph, glyphToString, matchRank, type RankTemplate } from '../vision/glyph';
import { detectRows, type RowBox } from '../vision/rows';
import { STREET_HEADER } from './detect';

export const LAYOUT_COLUMNS = ['blinds', 'preflop', 'flop', 'turn', 'river'] as const;
export type LayoutColumn = (typeof LAYOUT_COLUMNS)[number];

export interface LayoutCard extends CardBlob { rank: Rank | null; glyph: string | null }

export interface HandLayout {
  width: number;
  height: number;
  headerTop: number;
  headerBottom: number;
  // El móvil junta ciegas y pre-flop en una sola columna: ambas comparten rect y filas.
  mergedBlinds: boolean;
  columns: Record<LayoutColumn, { rect: Rect; rows: RowBox[] }>;
  cards: LayoutCard[];
}

export interface HeaderBand { top: number; bottom: number; mergedBlinds: boolean }

const STREET_ORDER = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

export function findHeader(full: OcrWord[]): HeaderBand | null {
  const hs = full.filter((w) => STREET_HEADER.test(w.text));
  if (hs.length < 2) return null;
  const top = Math.min(...hs.map((w) => w.y0));
  const bottom = Math.max(...hs.map((w) => w.y1)) + 4;

  // El escritorio antepone una columna "BLINDS & ANTE" que no lleva nombre de calle; se
  // deduce de si cabe otra columna a la izquierda de PRE-FLOP con el mismo paso.
  let mergedBlinds = false;
  const centers = new Map<string, number>();
  for (const w of hs) {
    const key = w.text.toUpperCase().replace('-', '');
    if (!centers.has(key)) centers.set(key, (w.x0 + w.x1) / 2);
  }
  const present = STREET_ORDER.map((k, i) => ({ i, x: centers.get(k) })).filter((c) => c.x !== undefined);
  if (present.length >= 2 && centers.has('PREFLOP')) {
    const first = present[0];
    const last = present[present.length - 1];
    const pitch = (last.x! - first.x!) / (last.i - first.i);
    mergedBlinds = pitch > 0 && centers.get('PREFLOP')! < pitch;
  }
  return { top, bottom, mergedBlinds };
}

export function columnCount(mergedBlinds: boolean): number {
  return mergedBlinds ? 4 : 5;
}

export function columnRect(width: number, height: number, col: LayoutColumn, top: number, mergedBlinds = false): Rect {
  const n = columnCount(mergedBlinds);
  const i = Math.max(0, LAYOUT_COLUMNS.indexOf(col) - (mergedBlinds ? 1 : 0));
  const x0 = Math.round((i * width) / n);
  const x1 = Math.round(((i + 1) * width) / n);
  return { x: x0, y: top, w: x1 - x0, h: height - top };
}

export function buildHandLayout(img: RGBA, full: OcrWord[], templates: RankTemplate[]): HandLayout | null {
  const header = findHeader(full);
  if (!header) return null;
  const cards = detectCards(img, header.top).map((c): LayoutCard => {
    const g = extractGlyph(img, c);
    return { ...c, rank: g ? (matchRank(g, c.sizeClass, templates)?.rank ?? null) : null, glyph: g ? glyphToString(g) : null };
  });
  const cache = new Map<string, { rect: Rect; rows: RowBox[] }>();
  const columns = Object.fromEntries(
    LAYOUT_COLUMNS.map((col) => {
      const rect = columnRect(img.width, img.height, col, header.bottom, header.mergedBlinds);
      const key = `${rect.x}`;
      // Con ciegas y pre-flop fundidas no merece la pena detectar dos veces las mismas filas.
      const found = cache.get(key) ?? { rect, rows: detectRows(img, rect) };
      cache.set(key, found);
      return [col, found];
    }),
  ) as HandLayout['columns'];
  return {
    width: img.width,
    height: img.height,
    headerTop: header.top,
    headerBottom: header.bottom,
    mergedBlinds: header.mergedBlinds,
    columns,
    cards,
  };
}
