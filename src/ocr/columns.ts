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
