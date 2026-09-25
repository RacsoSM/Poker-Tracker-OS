import type { Card, Hand, HandValues, Position } from '../../domain/types';
import type { AllinDraft, HandDraft, PartialCard } from '../../parsers/hand';

export interface HandFormState {
  handId: string;
  playedAt: number | null;
  heroPosition: Position | null;
  heroCards: PartialCard[];
  board: PartialCard[];
  heroResultCny: number | null;
  kind: 'allin' | 'study';
  allin: AllinDraft;
  tags: string;
  note: string;
}

const EMPTY_ALLIN: AllinDraft = { street: null, heroEquity: null, potContested: null, heroInvested: null };

export function handStateFromDraft(d: HandDraft): HandFormState {
  return {
    handId: d.handId ?? '', playedAt: d.playedAt, heroPosition: d.heroPosition,
    heroCards: d.heroCards.map((c) => ({ ...c })), board: d.board.map((c) => ({ ...c })),
    heroResultCny: d.heroResultCny, kind: d.kind, allin: d.allin ? { ...d.allin } : { ...EMPTY_ALLIN }, tags: '', note: '',
  };
}

export function handStateFromHand(h: Hand): HandFormState {
  return {
    handId: h.handId, playedAt: h.playedAt, heroPosition: h.heroPosition,
    heroCards: h.heroCards.map((c) => ({ ...c })), board: h.board.map((c) => ({ ...c })),
    heroResultCny: h.heroResultCny, kind: h.kind, allin: h.allin ? { ...h.allin } : { ...EMPTY_ALLIN },
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
    tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean),
    note: s.note.trim() || undefined,
  };
}
