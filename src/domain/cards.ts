import type { Card, Rank, Suit } from './types';

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_NAME: Record<Suit, string> = { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' };

export function isRank(x: string): x is Rank {
  return (RANKS as string[]).includes(x);
}

export function formatCard(c: Card): string {
  return `${c.rank === 'T' ? '10' : c.rank}${SUIT_SYMBOL[c.suit]}`;
}

export function parseCard(s: string): Card {
  const rank = s[0];
  const suit = s[1];
  if (s.length !== 2 || !isRank(rank) || !(SUITS as string[]).includes(suit)) throw new Error(`Carta inválida: ${s}`);
  return { rank, suit: suit as Suit };
}
