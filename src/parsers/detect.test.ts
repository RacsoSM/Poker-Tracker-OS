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
