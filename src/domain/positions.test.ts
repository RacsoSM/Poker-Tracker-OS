import { describe, expect, it } from 'vitest';
import { positionFromPreflopIndex } from './positions';

describe('positionFromPreflopIndex', () => {
  it('8 jugadores con straddle: el orden empieza en UTG+1', () => {
    expect(positionFromPreflopIndex(0, 8, true)).toBe('UTG+1');
    expect(positionFromPreflopIndex(2, 8, true)).toBe('HJ');
    expect(positionFromPreflopIndex(4, 8, true)).toBe('BTN');
    expect(positionFromPreflopIndex(7, 8, true)).toBe('UTG');
  });
  it('sin straddle el orden empieza en UTG', () => {
    expect(positionFromPreflopIndex(0, 6, false)).toBe('UTG');
    expect(positionFromPreflopIndex(3, 6, false)).toBe('BTN');
  });
  it('devuelve null fuera de rango o con mesas no soportadas', () => {
    expect(positionFromPreflopIndex(8, 8, true)).toBeNull();
    expect(positionFromPreflopIndex(0, 9, true)).toBeNull();
    expect(positionFromPreflopIndex(-1, 8, true)).toBeNull();
  });
});
