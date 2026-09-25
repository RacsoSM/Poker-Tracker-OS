import { describe, expect, it } from 'vitest';
import type { HandValues } from '../domain/types';
import { emptyHandDraft, type HandDraft } from '../parsers/hand';
import { templatesToLearn } from './learn';

const G = '0'.repeat(384);

describe('templatesToLearn', () => {
  it('aprende solo los rangos desconocidos o corregidos', () => {
    const draft: HandDraft = {
      ...emptyHandDraft(),
      board: [{ rank: '5', suit: 'c' }, { rank: null, suit: 'd' }],
      glyphs: [
        { slot: 'board', index: 0, sizeClass: 'board', glyph: G, guessed: '5' },
        { slot: 'board', index: 1, sizeClass: 'board', glyph: G, guessed: null },
        { slot: 'hero', index: 0, sizeClass: 'hole', glyph: G, guessed: 'A' },
        { slot: 'hero', index: 1, sizeClass: 'hole', glyph: G, guessed: '8' },
      ],
    };
    const values = {
      heroCards: [{ rank: 'A', suit: 'd' }, { rank: '9', suit: 'c' }],
      board: [{ rank: '5', suit: 'c' }, { rank: 'J', suit: 'd' }],
    } as unknown as HandValues;
    expect(templatesToLearn(draft, values)).toEqual([
      { rank: 'J', sizeClass: 'board', glyph: G },
      { rank: '9', sizeClass: 'hole', glyph: G },
    ]);
  });
  it('no aprende del tablero si el usuario cambió su número de cartas', () => {
    const draft: HandDraft = { ...emptyHandDraft(), board: [{ rank: null, suit: 'c' }], glyphs: [{ slot: 'board', index: 0, sizeClass: 'board', glyph: G, guessed: null }] };
    const values = { heroCards: [], board: [] } as unknown as HandValues;
    expect(templatesToLearn(draft, values)).toEqual([]);
  });
});
