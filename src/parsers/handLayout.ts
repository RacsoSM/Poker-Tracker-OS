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
