import { describe, expect, it } from 'vitest';
import type { Hand, SessionChunk } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  aggregate, allinEv, allinSeries, cumulativeResult, groupByDay, handLuck, inRange, periodRange, playingDay,
} from './stats';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

function chunk(p: Partial<SessionChunk>): SessionChunk {
  return {
    id: crypto.randomUUID(), startedAt: at(2026, 9, 25, 12), resultCny: -13, hands: 18, durationSec: 133,
    stakes: DEFAULT_SETTINGS.stakes, imageId: 'img', createdAt: 0, ...p,
  };
}

function hand(p: Partial<Hand>): Hand {
  return {
    id: crypto.randomUUID(), handId: crypto.randomUUID(), playedAt: at(2026, 9, 25, 11), heroPosition: 'BTN',
    heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [], heroResultCny: -156.1,
    kind: 'allin', allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
    tags: [], imageId: 'img', createdAt: 0, ...p,
  };
}

describe('playingDay', () => {
  it('asigna la madrugada al día anterior con corte a las 6', () => {
    expect(playingDay(at(2026, 9, 26, 1, 30), 6)).toBe('2026-09-25');
    expect(playingDay(at(2026, 9, 26, 5, 59), 6)).toBe('2026-09-25');
    expect(playingDay(at(2026, 9, 26, 6, 0), 6)).toBe('2026-09-26');
    expect(playingDay(at(2026, 9, 26, 1, 30), 0)).toBe('2026-09-26');
  });
});

describe('EV de all-in', () => {
  it('calcula EV y suerte del ejemplo de la spec', () => {
    expect(allinEv({ street: 'flop', heroEquity: 0.87, potContested: 347.2, heroInvested: 156.1 })).toBe(145.96);
    expect(handLuck(hand({ heroResultCny: 191.1, allin: { street: 'flop', heroEquity: 0.87, potContested: 347.2, heroInvested: 156.1 } }))).toBe(45.14);
    expect(handLuck(hand({}))).toBe(-45.14);
    expect(handLuck(hand({ kind: 'study', allin: undefined }))).toBe(0);
  });
});

describe('aggregate', () => {
  it('calcula métricas del tramo de prueba', () => {
    const a = aggregate([chunk({})], []);
    expect(a).toMatchObject({ chunks: 1, hands: 18, durationSec: 133, resultCny: -13, allins: 0, luckCny: 0 });
    expect(a.cnyPerHour).toBe(-351.88);
    expect(a.bbPer100).toBe(-36.11);
    expect(a.handsPerHour).toBe(487.22);
  });
  it('devuelve null en tasas sin tiempo ni manos', () => {
    const a = aggregate([], []);
    expect(a.cnyPerHour).toBeNull();
    expect(a.bbPer100).toBeNull();
    expect(a.handsPerHour).toBeNull();
  });
  it('suma la suerte de los all-ins y no suma manos al resultado', () => {
    const a = aggregate([chunk({ resultCny: 50 })], [hand({}), hand({ kind: 'study', allin: undefined, heroResultCny: -28 })]);
    expect(a.resultCny).toBe(50);
    expect(a.allins).toBe(1);
    expect(a.luckCny).toBe(-45.14);
  });
  it('suma el resultado de las manos con showdown (all-ins y marcadas)', () => {
    const a = aggregate([], [
      hand({}),
      hand({ kind: 'study', allin: undefined, heroResultCny: 40, showdown: true }),
      hand({ kind: 'study', allin: undefined, heroResultCny: -28 }),
    ]);
    expect(a.showdownHands).toBe(2);
    expect(a.showdownCny).toBe(-116.1);
  });
});

describe('groupByDay', () => {
  it('agrupa tramos y manos por día de juego, descendente', () => {
    const days = groupByDay(
      [chunk({ startedAt: at(2026, 9, 25, 20), resultCny: 10 }), chunk({ startedAt: at(2026, 9, 26, 2), resultCny: 5 }), chunk({ startedAt: at(2026, 9, 26, 12), resultCny: -3 })],
      [hand({ playedAt: at(2026, 9, 26, 3) })],
      6,
    );
    expect(days.map((d) => d.day)).toEqual(['2026-09-26', '2026-09-25']);
    expect(days[1]).toMatchObject({ chunks: 2, resultCny: 15, allins: 1 });
    expect(days[0]).toMatchObject({ chunks: 1, resultCny: -3, allins: 0 });
  });
});

describe('periodos', () => {
  it('calcula semana ISO, mes y año', () => {
    expect(periodRange({ kind: 'week' }, '2026-09-25')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(periodRange({ kind: 'month' }, '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange({ kind: 'year' }, '2026-09-25')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(periodRange({ kind: 'all' }, '2026-09-25')).toBeNull();
    expect(periodRange({ kind: 'range', from: '2026-09-01', to: '2026-09-10' }, '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-10' });
  });
  it('filtra días por rango inclusivo', () => {
    const r = { from: '2026-09-01', to: '2026-09-30' };
    expect(inRange('2026-09-30', r)).toBe(true);
    expect(inRange('2026-10-01', r)).toBe(false);
    expect(inRange('2020-01-01', null)).toBe(true);
  });
});

describe('series', () => {
  it('acumula resultado por día en orden ascendente', () => {
    const days = groupByDay([chunk({ startedAt: at(2026, 9, 26, 12), resultCny: -3 }), chunk({ startedAt: at(2026, 9, 25, 12), resultCny: 10 })], [], 6);
    expect(cumulativeResult(days)).toEqual([{ day: '2026-09-25', cum: 10, sd: 0, nsd: 10, ev: 10 }, { day: '2026-09-26', cum: 7, sd: 0, nsd: 7, ev: 7 }]);
  });
  it('separa lo ganado con y sin showdown', () => {
    const days = groupByDay(
      [chunk({ startedAt: at(2026, 9, 25, 12), resultCny: -100 }), chunk({ startedAt: at(2026, 9, 26, 12), resultCny: 50 })],
      [hand({ playedAt: at(2026, 9, 25, 12) }), hand({ playedAt: at(2026, 9, 26, 12), kind: 'study', allin: undefined, heroResultCny: 80, showdown: true })],
      6,
    );
    expect(cumulativeResult(days)).toEqual([
      { day: '2026-09-25', cum: -100, sd: -156.1, nsd: 56.1, ev: -54.86 },
      { day: '2026-09-26', cum: -50, sd: -76.1, nsd: 26.1, ev: -4.86 },
    ]);
  });
  it('la línea EV quita de lo ganado la suerte acumulada de los all-ins', () => {
    // El all-in del 25: perdió 156.1 con EV -110.96 → suerte -45.14, que la línea EV devuelve.
    const days = groupByDay([chunk({ startedAt: at(2026, 9, 25, 12), resultCny: -100 })], [hand({ playedAt: at(2026, 9, 25, 12) })], 6);
    expect(cumulativeResult(days)[0].ev).toBe(-54.86);
  });
  it('acumula real vs EV por all-in, ignorando manos de estudio', () => {
    const s = allinSeries([
      hand({ playedAt: at(2026, 9, 25, 12), heroResultCny: 191.1, allin: { street: 'flop', heroEquity: 0.87, potContested: 347.2, heroInvested: 156.1 } }),
      hand({ playedAt: at(2026, 9, 25, 11) }),
      hand({ kind: 'study', allin: undefined }),
    ]);
    expect(s).toEqual([
      { n: 0, real: 0, ev: 0 },
      { n: 1, real: -156.1, ev: -110.96 },
      { n: 2, real: 35, ev: 35 },
    ]);
  });
});
