import { describe, expect, it } from 'vitest';
import type { Hand } from './types';
import { allTags, filterHands, type HandFilter } from './handFilter';

const h = (p: Partial<Hand>): Hand => ({
  id: crypto.randomUUID(), handId: crypto.randomUUID(), playedAt: new Date(2026, 8, 25, 12).getTime(), heroPosition: 'BTN',
  heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [], heroResultCny: 0, kind: 'study', tags: [],
  imageId: 'i', createdAt: 0, ...p,
});
const ALL: HandFilter = { kind: 'all', position: 'all', tag: 'all', range: null };

describe('filterHands', () => {
  const hands = [
    h({ kind: 'allin', heroPosition: 'BTN', tags: ['cooler'], playedAt: new Date(2026, 8, 25, 12).getTime() }),
    h({ kind: 'study', heroPosition: 'HJ', tags: ['flop'], playedAt: new Date(2026, 8, 26, 2).getTime() }),
    h({ kind: 'study', heroPosition: 'BTN', tags: [], playedAt: new Date(2026, 9, 1, 12).getTime() }),
  ];
  it('filtra por tipo, posición, etiqueta y rango (con día de juego)', () => {
    expect(filterHands(hands, { ...ALL, kind: 'allin' }, 6)).toHaveLength(1);
    expect(filterHands(hands, { ...ALL, position: 'BTN' }, 6)).toHaveLength(2);
    expect(filterHands(hands, { ...ALL, tag: 'flop' }, 6)).toHaveLength(1);
    expect(filterHands(hands, { ...ALL, range: { from: '2026-09-25', to: '2026-09-25' } }, 6)).toHaveLength(2);
  });
  it('ordena de más reciente a más antigua', () => {
    expect(filterHands(hands, ALL, 6).map((x) => x.playedAt)).toEqual([...hands.map((x) => x.playedAt)].sort((a, b) => b - a));
  });
  it('lista etiquetas únicas ordenadas', () => {
    expect(allTags(hands)).toEqual(['cooler', 'flop']);
  });
});
