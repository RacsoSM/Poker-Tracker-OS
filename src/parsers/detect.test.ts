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
  it('clasifica los fixtures del móvil, con la interfaz en español', () => {
    expect(detectKind(fixtureJson<{ full: OcrWord[] }>('mobile-summary-01.ocr.json').full)).toBe('summary');
    for (const f of ['mobile-hand-01.ocr.json', 'mobile-hand-02.ocr.json']) {
      expect(detectKind(fixtureJson<{ full: OcrWord[] }>(f).full), f).toBe('hand');
    }
  });
  it('reconoce el resumen en español y la mano por su cabecera de calles', () => {
    expect(detectKind([w('Mis'), w('estadisticas')])).toBe('summary');
    expect(detectKind([w('Total:'), w('29'), w('manos,'), w('Duracion'), w('del'), w('juego:')])).toBe('summary');
    // Sin "HAND ID": basta con tres de las cuatro calles, que la app no traduce.
    expect(detectKind([w('Pre-Flop'), w('Flop'), w('Turn'), w('River')])).toBe('hand');
    expect(detectKind([w('Flop'), w('Turn')])).toBe('unknown');
  });
  it('devuelve unknown para otras imágenes', () => {
    expect(detectKind([w('Lobby'), w('Cash')])).toBe('unknown');
    expect(detectKind([w('MY'), w('STATS')])).toBe('summary');
    expect(detectKind([w('HAND'), w('ID')])).toBe('hand');
  });
});
