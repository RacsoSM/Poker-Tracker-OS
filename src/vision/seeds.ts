import type { Rank, SizeClass } from '../domain/types';
import { glyphFromString, type RankTemplate } from './glyph';
import seeds from './seedTemplates.json';

export function loadSeedTemplates(): RankTemplate[] {
  return (seeds as unknown as { rank: Rank; sizeClass: SizeClass; glyph: string }[]).map((s) => ({
    rank: s.rank,
    sizeClass: s.sizeClass,
    glyph: glyphFromString(s.glyph),
  }));
}
