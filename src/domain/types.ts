export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = 's' | 'h' | 'd' | 'c';
export interface Card { rank: Rank; suit: Suit }
export type Position = 'UTG' | 'UTG+1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Street = 'preflop' | 'flop' | 'turn';
export type SizeClass = 'board' | 'hole';

export interface Stakes { sb: number; bb: number; straddle: number; gameType: 'fast' }

export type DisplayCurrency = 'CNY' | 'USD';

export interface Settings {
  heroName: string;
  stakes: Stakes;
  /** Moneda en que se guardan los importes: siempre la de la sala. */
  currency: 'CNY';
  /** Moneda en que se muestran resultados y estadísticas (los formularios siguen en CNY). */
  displayCurrency: DisplayCurrency;
  /** Yuanes por dólar para mostrar en USD. */
  cnyPerUsd: number;
  dayCutoffHour: number;
  lastBackupAt: number | null;
}

export interface SessionChunk {
  id: string;
  startedAt: number;
  resultCny: number;
  hands: number;
  durationSec: number;
  stakes: Stakes;
  /** Ausente en las sesiones agregadas a mano (no tienen captura). */
  imageId?: string;
  note?: string;
  createdAt: number;
}

export interface AllinData { street: Street; heroEquity: number; potContested: number; heroInvested: number }

export interface Hand {
  id: string;
  handId: string;
  playedAt: number;
  heroPosition: Position;
  heroCards: [Card, Card];
  board: Card[];
  heroResultCny: number;
  kind: 'allin' | 'study';
  allin?: AllinData;
  /** Llegó a showdown. Los all-ins siempre cuentan como showdown; ausente en manos guardadas antes de existir el campo. */
  showdown?: boolean;
  tags: string[];
  note?: string;
  /** Ausente en las manos agregadas a mano (no tienen captura). */
  imageId?: string;
  createdAt: number;
}

export type HandValues = Omit<Hand, 'id' | 'createdAt' | 'imageId'>;

export interface StoredImage { id: string; bytes: Uint8Array; mime: string; width: number; height: number }

export const DEFAULT_SETTINGS: Settings = {
  heroName: 'RacsoSM',
  stakes: { sb: 1, bb: 2, straddle: 4, gameType: 'fast' },
  currency: 'CNY',
  displayCurrency: 'CNY',
  // Cambio medio USD/CNY a mediados de octubre de 2026 (≈6.69); se puede ajustar en Ajustes.
  cnyPerUsd: 6.69,
  dayCutoffHour: 6,
  lastBackupAt: null,
};

export const POSITIONS: Position[] = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const STREETS: Street[] = ['preflop', 'flop', 'turn'];
