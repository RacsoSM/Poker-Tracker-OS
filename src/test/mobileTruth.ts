import type { Position, Street } from '../domain/types';

// Verdad de las capturas del móvil 03–21 (leídas a ojo). `result: null` cuando la captura
// viene cortada y no enseña el resultado del héroe; `allin` solo cuando la app muestra equity.
export interface MobileTruth {
  png: string;
  cards: string;
  board: string;
  position: Position | null;
  result: number | null;
  allin?: { street: Street; equity: number };
}

export const MOBILE_TRUTH: MobileTruth[] = [
  { png: 'mobile-hand-03.png', cards: 'QhQc', board: 'JcKd8h6s5h', position: 'SB', result: -158.25, allin: { street: 'preflop', equity: 0.19 } },
  { png: 'mobile-hand-04.png', cards: 'TsTd', board: 'Qh3sQdAhJc', position: 'BTN', result: -185.43, allin: { street: 'flop', equity: 0.07 } },
  { png: 'mobile-hand-05.png', cards: 'Ah4h', board: 'Js9h2cAdAs', position: 'BTN', result: 1.5 },
  { png: 'mobile-hand-06.png', cards: '7s7c', board: 'Qc9d3d6cJd', position: 'SB', result: -123 },
  { png: 'mobile-hand-07.png', cards: '7s6s', board: 'KhKdJd8d8h', position: 'UTG', result: -58 },
  { png: 'mobile-hand-08.png', cards: 'AhQc', board: 'Qh9dTh9c2c', position: 'UTG+1', result: -184 },
  { png: 'mobile-hand-09.png', cards: 'AcJc', board: '8dJd4s7dAs', position: 'HJ', result: 136.51, allin: { street: 'preflop', equity: 0.31 } },
  { png: 'mobile-hand-10.png', cards: 'Ad9h', board: 'JsQdAsTc2c', position: 'SB', result: -153.4, allin: { street: 'preflop', equity: 0.29 } },
  { png: 'mobile-hand-11.png', cards: '5c5d', board: '3sQh8c9d2s', position: 'SB', result: 49 },
  { png: 'mobile-hand-12.png', cards: 'KcJd', board: '5hTd2d6hAc', position: 'UTG', result: -20 },
  { png: 'mobile-hand-13.png', cards: '4h4c', board: 'AsAc7sThKc', position: 'HJ', result: -37 },
  { png: 'mobile-hand-14.png', cards: 'AhAd', board: '5h3c6h2c6c', position: 'UTG', result: -146 },
  { png: 'mobile-hand-15.png', cards: 'KhJd', board: '3d3cJs4h3s', position: 'SB', result: -63 },
  { png: 'mobile-hand-16.png', cards: '5s5h', board: 'As5d3s8c2h', position: 'MP', result: 301.15 },
  { png: 'mobile-hand-17.png', cards: 'KcJs', board: 'AcAs3dAhJh', position: null, result: null },
  { png: 'mobile-hand-18.png', cards: 'KhJs', board: 'QsTh7c5cKc', position: 'BTN', result: -121 },
  { png: 'mobile-hand-19.png', cards: 'JsJd', board: 'Qc7sKdJcQd', position: 'BTN', result: 88 },
  { png: 'mobile-hand-20.png', cards: 'JcJd', board: '8hAc6d9h7h', position: 'BTN', result: -44 },
  { png: 'mobile-hand-21.png', cards: 'AhAc', board: 'KcKh2h8h3c', position: 'MP', result: 33 },
];
