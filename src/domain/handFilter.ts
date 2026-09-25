import { inRange, playingDay } from './stats';
import type { Hand, Position } from './types';

export interface HandFilter {
  kind: 'all' | 'allin' | 'study';
  position: Position | 'all';
  tag: string;
  range: { from: string; to: string } | null;
}

export function filterHands(hands: Hand[], f: HandFilter, cutoffHour: number): Hand[] {
  return hands
    .filter((h) => f.kind === 'all' || h.kind === f.kind)
    .filter((h) => f.position === 'all' || h.heroPosition === f.position)
    .filter((h) => f.tag === 'all' || h.tags.includes(f.tag))
    .filter((h) => inRange(playingDay(h.playedAt, cutoffHour), f.range))
    .sort((a, b) => b.playedAt - a.playedAt);
}

export function allTags(hands: Hand[]): string[] {
  return [...new Set(hands.flatMap((h) => h.tags))].sort((a, b) => a.localeCompare(b));
}
