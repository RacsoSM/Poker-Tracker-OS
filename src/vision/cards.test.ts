import { describe, expect, it } from 'vitest';
import { classifyPixel, detectCards } from './cards';
import { decodePng } from '../image/rgba';
import { fixtureBytes, HAND_PNG } from '../test/fixtures';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from './fixtureTruth';
import { resizeNearest } from '../test/imageUtils';

const img = decodePng(fixtureBytes(HAND_PNG));

describe('classifyPixel', () => {
  it('reconoce los 4 colores de carta y descarta fondos y glifos', () => {
    expect(classifyPixel(4, 121, 43)).toBe('c');
    expect(classifyPixel(19, 85, 169)).toBe('d');
    expect(classifyPixel(139, 25, 25)).toBe('h');
    expect(classifyPixel(28, 28, 28)).toBe('s');
    expect(classifyPixel(86, 54, 30)).toBeNull();
    expect(classifyPixel(233, 225, 209)).toBeNull();
    expect(classifyPixel(38, 40, 54)).toBeNull();
    // Placa del nombre del asiento: oscura pero azulada; no debe unirse a las picas.
    expect(classifyPixel(33, 33, 41)).toBeNull();
    expect(classifyPixel(40, 39, 37)).toBe('s');
  });
});

describe('detectCards', () => {
  it('encuentra las 11 cartas grandes del fixture con su palo', () => {
    const cards = detectCards(img, FIXTURE_HEADER_TOP);
    expect(cards).toHaveLength(11);
    for (const t of FIXTURE_TRUTH) {
      const c = cards.find((k) => Math.abs(k.x - t.x) <= 8 && Math.abs(k.y - t.y) <= 8);
      expect(c, `carta en ${t.x},${t.y}`).toBeDefined();
      expect(c!.suit).toBe(t.suit);
    }
    const board = cards.filter((c) => c.sizeClass === 'board').sort((a, b) => a.x - b.x);
    expect(board.map((c) => c.suit)).toEqual(['c', 'd', 'h', 'c', 'd']);
    expect(cards.filter((c) => c.sizeClass === 'hole')).toHaveLength(6);
  });
  it('sigue funcionando con la captura reescalada a 0.75', () => {
    const small = resizeNearest(img, 0.75);
    const cards = detectCards(small, Math.round(FIXTURE_HEADER_TOP * 0.75));
    expect(cards).toHaveLength(11);
    expect(cards.filter((c) => c.sizeClass === 'board')).toHaveLength(5);
  });
});
