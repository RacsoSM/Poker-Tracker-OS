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
    expect(findHeader(HEADERS)).toEqual({ top: 841, bottom: 864, mergedBlinds: false });
    expect(findHeader([w('FLOP', 0, 0, 1, 1)])).toBeNull();
  });
  it('detecta la cabecera sin columna de ciegas del móvil', () => {
    // Capturas de móvil: cuatro columnas, PRE-FLOP pegada al borde izquierdo (no cabe otra antes).
    const mobile = [w('Pre-Flop', 41, 463, 108, 481), w('Flop', 195, 463, 228, 481), w('Turn', 330, 464, 365, 477), w('River', 466, 463, 505, 477)];
    expect(findHeader(mobile)?.mergedBlinds).toBe(true);
  });
  it('divide el ancho en 5 columnas, o en 4 si las ciegas van en la de pre-flop', () => {
    expect(columnRect(1280, 2295, 'river', 864)).toEqual({ x: 1024, y: 864, w: 256, h: 1431 });
    expect(columnRect(1280, 2295, 'blinds', 864)).toEqual({ x: 0, y: 864, w: 256, h: 1431 });
    expect(columnRect(560, 1600, 'blinds', 485, true)).toEqual({ x: 0, y: 485, w: 140, h: 1115 });
    expect(columnRect(560, 1600, 'preflop', 485, true)).toEqual({ x: 0, y: 485, w: 140, h: 1115 });
    expect(columnRect(560, 1600, 'river', 485, true)).toEqual({ x: 420, y: 485, w: 140, h: 1115 });
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
