import { describe, expect, it } from 'vitest';
import { nameMatches } from './names';

describe('nameMatches', () => {
  it('coincide exacto e ignorando mayÃºsculas y signos', () => {
    expect(nameMatches('RacsoSM', 'RacsoSM')).toBe(true);
    expect(nameMatches('racsosm,', 'RacsoSM')).toBe(true);
  });
  it('tolera un error de OCR en nombres de 5+ caracteres', () => {
    expect(nameMatches('RacsoSN', 'RacsoSM')).toBe(true);
    expect(nameMatches('HiTeR2S04', 'HiTeR2504')).toBe(true);
  });
  it('no coincide con otros nombres ni con nombres vacÃ­os', () => {
    expect(nameMatches('Muck1564', 'RacsoSM')).toBe(false);
    expect(nameMatches('RacsoSM', 'è¶…æ¿€è¿›æµ')).toBe(false);
    expect(nameMatches('SB', 'SA')).toBe(false);
  });
});
