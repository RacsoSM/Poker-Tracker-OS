import { round2 } from './format';
import type { AllinData, Hand, SessionChunk } from './types';

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function playingDay(t: number, cutoffHour: number): string {
  return dayKey(new Date(t - cutoffHour * HOUR));
}

export function allinEv(a: AllinData): number {
  return round2(a.heroEquity * a.potContested - a.heroInvested);
}

export function handLuck(h: Hand): number {
  return h.kind === 'allin' && h.allin ? round2(h.heroResultCny - allinEv(h.allin)) : 0;
}

export function wentToShowdown(h: Hand): boolean {
  return h.kind === 'allin' || h.showdown === true;
}

export interface Aggregate {
  chunks: number;
  hands: number;
  durationSec: number;
  resultCny: number;
  cnyPerHour: number | null;
  bbPer100: number | null;
  handsPerHour: number | null;
  allins: number;
  luckCny: number;
  showdownHands: number;
  /** Suma del resultado de las manos subidas que llegaron a showdown. */
  showdownCny: number;
}

export interface DayStats extends Aggregate { day: string }

export function aggregate(chunks: SessionChunk[], hands: Hand[]): Aggregate {
  const resultCny = round2(sum(chunks.map((c) => c.resultCny)));
  const handCount = sum(chunks.map((c) => c.hands));
  const durationSec = sum(chunks.map((c) => c.durationSec));
  const resultBb = sum(chunks.map((c) => c.resultCny / c.stakes.bb));
  const hours = durationSec / 3600;
  const allinHands = hands.filter((h) => h.kind === 'allin' && h.allin);
  const showdownHands = hands.filter(wentToShowdown);
  return {
    chunks: chunks.length,
    hands: handCount,
    durationSec,
    resultCny,
    cnyPerHour: hours > 0 ? round2(resultCny / hours) : null,
    bbPer100: handCount > 0 ? round2((resultBb / handCount) * 100) : null,
    handsPerHour: hours > 0 ? round2(handCount / hours) : null,
    allins: allinHands.length,
    luckCny: round2(sum(allinHands.map(handLuck))),
    showdownHands: showdownHands.length,
    showdownCny: round2(sum(showdownHands.map((h) => h.heroResultCny))),
  };
}

export function groupByDay(chunks: SessionChunk[], hands: Hand[], cutoffHour: number): DayStats[] {
  const groups = new Map<string, { chunks: SessionChunk[]; hands: Hand[] }>();
  const get = (day: string) => {
    let g = groups.get(day);
    if (!g) groups.set(day, (g = { chunks: [], hands: [] }));
    return g;
  };
  for (const c of chunks) get(playingDay(c.startedAt, cutoffHour)).chunks.push(c);
  for (const h of hands) get(playingDay(h.playedAt, cutoffHour)).hands.push(h);
  return [...groups.entries()]
    .map(([day, g]) => ({ day, ...aggregate(g.chunks, g.hands) }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export type Period = { kind: 'week' | 'month' | 'year' | 'all' } | { kind: 'range'; from: string; to: string };

export function periodRange(p: Period, today: string): { from: string; to: string } | null {
  if (p.kind === 'all') return null;
  if (p.kind === 'range') return { from: p.from, to: p.to };
  const d = parseDay(today);
  if (p.kind === 'week') {
    const dow = (d.getDay() + 6) % 7;
    return { from: dayKey(addDays(d, -dow)), to: dayKey(addDays(d, 6 - dow)) };
  }
  if (p.kind === 'month') {
    return { from: dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
}

export function inRange(day: string, range: { from: string; to: string } | null): boolean {
  return !range || (day >= range.from && day <= range.to);
}

// cum: lo ganado (línea verde). sd: lo ganado en manos con showdown (azul). nsd: el resto, sin showdown (roja).
// ev: lo ganado quitando la suerte de los all-ins (naranja).
export function cumulativeResult(days: DayStats[]): { day: string; cum: number; sd: number; nsd: number; ev: number }[] {
  let cum = 0;
  let sd = 0;
  let luck = 0;
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => {
      cum = round2(cum + d.resultCny);
      sd = round2(sd + d.showdownCny);
      luck = round2(luck + d.luckCny);
      return { day: d.day, cum, sd, nsd: round2(cum - sd), ev: round2(cum - luck) };
    });
}

export function allinSeries(hands: Hand[]): { n: number; real: number; ev: number }[] {
  const out = [{ n: 0, real: 0, ev: 0 }];
  let real = 0;
  let ev = 0;
  const allins = hands.filter((h) => h.kind === 'allin' && h.allin).sort((a, b) => a.playedAt - b.playedAt);
  allins.forEach((h, i) => {
    real = round2(real + h.heroResultCny);
    ev = round2(ev + allinEv(h.allin!));
    out.push({ n: i + 1, real, ev });
  });
  return out;
}
