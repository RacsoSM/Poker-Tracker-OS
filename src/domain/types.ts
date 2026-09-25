export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = 's' | 'h' | 'd' | 'c';
export interface Card { rank: Rank; suit: Suit }
export type Position = 'UTG' | 'UTG+1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Street = 'preflop' | 'flop' | 'turn';
export type SizeClass = 'board' | 'hole';

export interface Stakes { sb: number; bb: number; straddle: number; gameType: 'fast' }

export interface Settings {
  heroName: string;
  stakes: Stakes;
  currency: 'CNY';
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
  imageId: string;
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
  tags: string[];
  note?: string;
  imageId: string;
  createdAt: number;
}

export type HandValues = Omit<Hand, 'id' | 'createdAt' | 'imageId'>;

export interface StoredImage { id: string; bytes: Uint8Array; mime: string; width: number; height: number }

export const DEFAULT_SETTINGS: Settings = {
  heroName: 'RacsoSM',
  stakes: { sb: 1, bb: 2, straddle: 4, gameType: 'fast' },
  currency: 'CNY',
  dayCutoffHour: 6,
  lastBackupAt: null,
};

export const POSITIONS: Position[] = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const STREETS: Street[] = ['preflop', 'flop', 'turn'];
