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
