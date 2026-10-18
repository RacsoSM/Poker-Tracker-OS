import type { Card, Hand, HandValues, Position } from '../../domain/types';
import type { AllinDraft, HandDraft, PartialCard } from '../../parsers/hand';

/** Etiqueta de las manos guardadas solas con algún dato que el lector no pudo confirmar. */
export const REVIEW_TAG = 'revisar';

export interface HandFormState {
  handId: string;
  playedAt: number | null;
  heroPosition: Position | null;
  heroCards: PartialCard[];
  board: PartialCard[];
  heroResultCny: number | null;
  kind: 'allin' | 'study';
  allin: AllinDraft;
  showdown: boolean;
  tags: string;
  note: string;
}

const EMPTY_ALLIN: AllinDraft = { street: null, heroEquity: null, potContested: null, heroInvested: null };

export function handStateFromDraft(d: HandDraft): HandFormState {
  return {
    handId: d.handId ?? '', playedAt: d.playedAt, heroPosition: d.heroPosition,
    heroCards: d.heroCards.map((c) => ({ ...c })), board: d.board.map((c) => ({ ...c })),
    heroResultCny: d.heroResultCny, kind: d.kind, allin: d.allin ? { ...d.allin } : { ...EMPTY_ALLIN },
    // Sin all-in, solo puede haber showdown si se vio el river.
    showdown: d.kind === 'allin' || d.board.length === 5, tags: '', note: '',
  };
}

export function handStateFromHand(h: Hand): HandFormState {
  return {
    handId: h.handId, playedAt: h.playedAt, heroPosition: h.heroPosition,
    heroCards: h.heroCards.map((c) => ({ ...c })), board: h.board.map((c) => ({ ...c })),
    heroResultCny: h.heroResultCny, kind: h.kind, allin: h.allin ? { ...h.allin } : { ...EMPTY_ALLIN },
    showdown: h.kind === 'allin' || h.showdown === true,
    tags: h.tags.join(', '), note: h.note ?? '',
  };
}

const complete = (c: PartialCard): c is Card => c.rank !== null && c.suit !== null;

export function toHandValues(s: HandFormState): HandValues | null {
  const handId = s.handId.trim();
  if (!handId || s.playedAt === null || s.heroPosition === null || s.heroResultCny === null) return null;
  if (s.heroCards.length !== 2 || !s.heroCards.every(complete) || !s.board.every(complete) || s.board.length > 5) return null;
  const cards = [...s.heroCards, ...s.board] as Card[];
  if (new Set(cards.map((c) => c.rank + c.suit)).size !== cards.length) return null;
  let allin: HandValues['allin'];
  if (s.kind === 'allin') {
    const a = s.allin;
    if (a.street === null || a.heroEquity === null || a.potContested === null || a.heroInvested === null) return null;
    if (a.heroEquity < 0 || a.heroEquity > 1) return null;
    allin = { street: a.street, heroEquity: a.heroEquity, potContested: a.potContested, heroInvested: a.heroInvested };
  }
  return {
    handId, playedAt: s.playedAt, heroPosition: s.heroPosition,
    heroCards: [cards[0], cards[1]], board: cards.slice(2), heroResultCny: s.heroResultCny, kind: s.kind, allin,
    showdown: s.kind === 'allin' || s.showdown,
    tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean),
    note: s.note.trim() || undefined,
  };
}

// Las manos subidas se guardan sin pasar por el formulario si el lector sacó todos los datos.
// Si alguno quedó en duda, se guarda igual con la etiqueta "revisar" para encontrarla luego.
// null: falta algún dato y hay que completarlo a mano.
export function autoHandValues(d: HandDraft): HandValues | null {
  const v = toHandValues(handStateFromDraft(d));
  if (!v) return null;
  return d.uncertain.length ? { ...v, tags: [REVIEW_TAG] } : v;
}
