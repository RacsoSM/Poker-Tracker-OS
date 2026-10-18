import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, fixtureJson, MOBILE_HAND_PNGS } from '../test/fixtures';
import { MOBILE_TRUTH } from '../test/mobileTruth';
import { glyphFromString, matchRank, type RankTemplate } from '../vision/glyph';
import { loadSeedTemplates } from '../vision/seeds';
import { parseHand, type HandDraft, type HandOcr, type PartialCard } from './hand';
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

const cardsText = (cs: PartialCard[]) => cs.map((c) => `${c.rank ?? '?'}${c.suit ?? '?'}`).join('');

// Capturas reales del móvil del usuario (03–21): acciones del river antes de los resultados,
// cartas del mismo palo pegadas, seguro de all-in, capturas cortadas…
describe('parseHand sobre las capturas del móvil 03–21', () => {
  const parsed = MOBILE_TRUTH.map((t) => ({ t, ...load(t.png) }));

  for (const { t, ocr, layout } of parsed) {
    it(`${t.png}: ${t.cards} en ${t.position ?? '?'}, ${t.result ?? '?'}`, () => {
      const d = parseHand(ocr, layout, 'RacsoSM');
      expect(cardsText(d.heroCards)).toBe(t.cards);
      expect(cardsText(d.board)).toBe(t.board);
      expect(d.heroPosition).toBe(t.position);
      expect(d.heroResultCny).toBe(t.result);
      expect(d.allin ? { street: d.allin.street, equity: d.allin.heroEquity } : undefined).toEqual(t.allin);
      if (t.position === null) expect(d.uncertain).toContain('heroPosition');
      if (t.result === null) expect(d.uncertain).toContain('heroResultCny');
    });
  }

  it('la columna RIVER con acciones: el resultado es la fila de resultados, no "Subir CN¥ 73"', () => {
    const { ocr, layout } = parsed.find((p) => p.t.png === 'mobile-hand-05.png')!;
    expect(layout.columns.river.rows).toHaveLength(11);
    const d = parseHand(ocr, layout, 'RacsoSM');
    expect(d.heroResultCny).toBe(1.5);
    expect(d.uncertain).toEqual([]);
  });

  it('con seguro de all-in la columna RIVER no cuadra y el bote queda para revisar', () => {
    const { ocr, layout } = parsed.find((p) => p.t.png === 'mobile-hand-09.png')!;
    expect(parseHand(ocr, layout, 'RacsoSM').uncertain).toContain('allin');
  });

  it('reconoce los rangos de una captura nueva con plantillas sacadas solo de las demás', () => {
    const glyphs = (p: (typeof parsed)[number], d: HandDraft) =>
      d.glyphs.map((g) => ({ rank: (g.slot === 'hero' ? p.t.cards : p.t.board)[g.index * 2] as RankTemplate['rank'], sizeClass: g.sizeClass, glyph: glyphFromString(g.glyph) }));
    const all = parsed.map((p) => glyphs(p, parseHand(p.ocr, p.layout, 'RacsoSM')));
    all.forEach((own, i) => {
      const others = all.filter((_, j) => j !== i).flat();
      for (const g of own) expect(matchRank(g.glyph, others)?.rank, MOBILE_TRUTH[i].png).toBe(g.rank);
    });
  });
});
