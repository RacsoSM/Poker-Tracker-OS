import type { StoredTemplate } from '../db/db';
import type { HandValues } from '../domain/types';
import type { HandDraft } from '../parsers/hand';

// Guarda como plantilla cada glifo cuyo rango el usuario completó o corrigió.
export function templatesToLearn(draft: HandDraft, values: HandValues): Omit<StoredTemplate, 'id'>[] {
  const out: Omit<StoredTemplate, 'id'>[] = [];
  for (const g of draft.glyphs) {
    const final =
      g.slot === 'hero' ? values.heroCards[g.index] : values.board.length === draft.board.length ? values.board[g.index] : undefined;
    if (final && final.rank !== g.guessed) out.push({ rank: final.rank, sizeClass: g.sizeClass, glyph: g.glyph });
  }
  return out;
}
