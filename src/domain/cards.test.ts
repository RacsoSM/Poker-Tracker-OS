import { describe, expect, it } from 'vitest';
import { formatCard, isRank, parseCard } from './cards';

describe('cards', () => {
  it('parsea y formatea', () => {
    expect(parseCard('Ad')).toEqual({ rank: 'A', suit: 'd' });
    expect(formatCard({ rank: 'T', suit: 's' })).toBe('10♠');
    expect(formatCard({ rank: '8', suit: 'c' })).toBe('8♣');
  });
  it('rechaza cartas inválidas', () => {
    expect(() => parseCard('1x')).toThrow();
    expect(isRank('Z')).toBe(false);
    expect(isRank('Q')).toBe(true);
  });
});
