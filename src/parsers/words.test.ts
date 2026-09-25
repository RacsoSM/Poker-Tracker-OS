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
