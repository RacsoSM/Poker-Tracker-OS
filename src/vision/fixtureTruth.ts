import type { Rank, Suit } from '../domain/types';

// Verdad del fixture hand-1323539300829384704.png (coordenadas de la prueba de OCR, ±8 px).
export const FIXTURE_HEADER_TOP = 841;

export const FIXTURE_TRUTH: { x: number; y: number; rank: Rank; suit: Suit }[] = [
  { x: 77, y: 307, rank: 'K', suit: 's' },
  { x: 124, y: 306, rank: 'Q', suit: 's' },
  { x: 392, y: 330, rank: '5', suit: 'c' },
  { x: 493, y: 330, rank: 'Q', suit: 'd' },
  { x: 596, y: 332, rank: '8', suit: 'h' },
  { x: 695, y: 330, rank: '4', suit: 'c' },
  { x: 796, y: 330, rank: '3', suit: 'd' },
  { x: 237, y: 494, rank: 'A', suit: 'h' },
  { x: 283, y: 491, rank: 'Q', suit: 'c' },
  { x: 576, y: 588, rank: 'A', suit: 'd' },
  { x: 623, y: 587, rank: '8', suit: 'c' },
];
