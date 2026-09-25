import type { Position } from './types';

// Asientos en orden desde UTG hasta BB, segÃºn el nÃºmero de jugadores.
const SEATS: Record<number, Position[]> = {
  3: ['BTN', 'SB', 'BB'],
  4: ['UTG', 'BTN', 'SB', 'BB'],
  5: ['UTG', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

// Antes de que el hÃ©roe actÃºe por primera vez, cada fila de PRE-FLOP es un jugador distinto,
// asÃ­ que el Ã­ndice de su primera fila es su lugar en el orden de acciÃ³n preflop.
export function positionFromPreflopIndex(index: number, nPlayers: number, straddle: boolean): Position | null {
  const seats = SEATS[nPlayers];
  if (!seats || index < 0 || index >= nPlayers) return null;
  const order = straddle && nPlayers >= 4 ? [...seats.slice(1), seats[0]] : seats;
  return order[index];
}
