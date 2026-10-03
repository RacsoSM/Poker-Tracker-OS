import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, fixtureJson, MOBILE_HAND_PNGS } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { parseHand, type HandOcr } from './hand';
import { buildHandLayout } from './handLayout';

// Capturas hechas desde el móvil: interfaz en español, menos de la mitad de resolución,
// importes con coma decimal y sin enteros, y las ciegas dentro de la columna PRE-FLOP
// (cuatro columnas en vez de cinco). Tampoco muestran HAND ID ni la fecha.
const load = (png: string) => {
  const ocr = fixtureJson<HandOcr>(png.replace(/\.png$/, '.ocr.json'));
  const layout = buildHandLayout(decodePng(fixtureBytes(png)), ocr.full, loadSeedTemplates())!;
  return { ocr, layout };
};

describe('parseHand sobre capturas del móvil', () => {
  it('mano 01: RacsoSM gana con A♥K♠ desde el straddle', () => {
    const { ocr, layout } = load(MOBILE_HAND_PNGS[0]);
    expect(layout.mergedBlinds).toBe(true);
    expect(layout.columns.river.rows).toHaveLength(8);
    const d = parseHand(ocr, layout, 'RacsoSM');
    expect(d.heroPosition).toBe('UTG');
    expect(d.heroResultCny).toBe(96.23);
    expect(d.heroCards.map((c) => c.suit)).toEqual(['h', 's']);
    expect(d.board.map((c) => c.suit)).toEqual(['h', 'h', 'd', 'c', 'c']);
    expect(d.kind).toBe('study');
    // El móvil no enseña ni el identificador ni la fecha de la mano.
    expect(d.uncertain).toEqual(expect.arrayContaining(['handId', 'playedAt']));
    expect(d.uncertain).not.toContain('heroResultCny');
  });

  it('mano 02: RacsoSM all-in en el turn con 95% desde MP', () => {
    const { ocr, layout } = load(MOBILE_HAND_PNGS[1]);
    expect(layout.mergedBlinds).toBe(true);
    expect(layout.columns.river.rows).toHaveLength(8);
    const d = parseHand(ocr, layout, 'RacsoSM');
    expect(d.heroPosition).toBe('MP');
    expect(d.heroResultCny).toBe(146.65);
    expect(d.heroCards.map((c) => c.suit)).toEqual(['s', 'h']);
    expect(d.board.map((c) => c.suit)).toEqual(['c', 's', 'c', 'c', 's']);
    expect(d.kind).toBe('allin');
    expect(d.allin).toEqual({ street: 'turn', heroEquity: 0.95, potContested: 290.3, heroInvested: 143.65 });
  });

  it('también lee a otro jugador de la mesa', () => {
    const { ocr, layout } = load(MOBILE_HAND_PNGS[1]);
    const d = parseHand(ocr, layout, 'Allenji131');
    expect(d.heroPosition).toBe('HJ');
    expect(d.heroResultCny).toBe(0);
  });
});
