import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, HAND_PNG } from '../test/fixtures';
import { detectCards } from './cards';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from './fixtureTruth';
import { extractGlyph, glyphFromString, glyphToString, matchRank, type RankTemplate } from './glyph';
import { loadSeedTemplates } from './seeds';

const img = decodePng(fixtureBytes(HAND_PNG));
const cards = detectCards(img, FIXTURE_HEADER_TOP);
const labeled = FIXTURE_TRUTH.map((t) => {
  const card = cards.find((c) => Math.abs(c.x - t.x) <= 8 && Math.abs(c.y - t.y) <= 8)!;
  return { ...t, card, glyph: extractGlyph(img, card)! };
});

describe('glyph', () => {
  it('extrae un glifo de 16x24 por carta', () => {
    for (const l of labeled) expect(l.glyph).toHaveLength(384);
  });
  it('serializa ida y vuelta', () => {
    const g = labeled[0].glyph;
    expect(glyphFromString(glyphToString(g))).toEqual(g);
  });
  it('leave-one-out: acierta los rangos repetidos y no inventa los únicos', () => {
    for (const l of labeled) {
      const others: RankTemplate[] = labeled
        .filter((o) => o !== l)
        .map((o) => ({ rank: o.rank, sizeClass: o.card.sizeClass, glyph: o.glyph }));
      const hasTwin = others.some((o) => o.rank === l.rank && o.sizeClass === l.card.sizeClass);
      const m = matchRank(l.glyph, l.card.sizeClass, others);
      if (hasTwin) expect(m?.rank, `${l.rank} en ${l.x},${l.y}`).toBe(l.rank);
      else expect(m, `${l.rank} en ${l.x},${l.y}`).toBeNull();
    }
  });
  it('las semillas reconocen todas las cartas del fixture', () => {
    const seeds = loadSeedTemplates();
    for (const l of labeled) expect(matchRank(l.glyph, l.card.sizeClass, seeds)?.rank).toBe(l.rank);
  });
});
