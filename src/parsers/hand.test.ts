import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { fixtureBytes, fixtureJson, HAND_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { buildHandLayout } from './handLayout';
import { emptyHandDraft, parseHand, parseMoneyText, type HandOcr } from './hand';

const ocr = fixtureJson<HandOcr>('hand-1323539300829384704.ocr.json');
const layout = buildHandLayout(decodePng(fixtureBytes(HAND_PNG)), ocr.full, loadSeedTemplates())!;
const BOARD = [
  { rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }, { rank: '4', suit: 'c' }, { rank: '3', suit: 'd' },
];

describe('parseMoneyText', () => {
  it('lee importes con signo separado y guion tipográfico', () => {
    expect(parseMoneyText('RacsoSM = HH -¥ 28.00')).toBe(-28);
    expect(parseMoneyText('+¥ 191.10')).toBe(191.1);
    expect(parseMoneyText('¥0.00')).toBe(0);
    expect(parseMoneyText('—¥1,156.10')).toBe(-1156.1);
    expect(parseMoneyText('Fold')).toBeNull();
  });
  it('lee los formatos del móvil: "CN¥", coma decimal y enteros sin decimales', () => {
    expect(parseMoneyText('RacsoSM UTG +CN¥ 96.23')).toBe(96.23);
    expect(parseMoneyText('Pozo total : CN¥ 211,23')).toBe(211.23);
    expect(parseMoneyText('@nexian SB -CN¥ 1')).toBe(-1);
    expect(parseMoneyText('lunerjs CO CN¥ 0')).toBe(0);
    expect(parseMoneyText('-CN¥ 1.234,56')).toBe(-1234.56);
    // Un punto final de frase no forma parte del importe.
    expect(parseMoneyText('+CN¥ 146.65.')).toBe(146.65);
  });
});

describe('parseHand sobre el fixture real', () => {
  it('RacsoSM (HJ, foldea en el flop): mano de estudio', () => {
    const d = parseHand(ocr, layout, 'RacsoSM');
    expect(d.handId).toBe('1323539300829384704');
    expect(d.playedAt).toBe(new Date(2026, 8, 25, 11, 0, 47).getTime());
    expect(d.heroPosition).toBe('HJ');
    expect(d.heroCards).toEqual([{ rank: 'A', suit: 'd' }, { rank: '8', suit: 'c' }]);
    expect(d.board).toEqual(BOARD);
    expect(d.heroResultCny).toBe(-28);
    expect(d.kind).toBe('study');
    expect(d.allin).toBeNull();
    expect(d.uncertain).toEqual([]);
    expect(d.glyphs.filter((g) => g.slot === 'hero')).toHaveLength(2);
    expect(d.glyphs.filter((g) => g.slot === 'board')).toHaveLength(5);
  });

  it('HiTeR2504 (BTN, all-in en el flop con 13%)', () => {
    const d = parseHand(ocr, layout, 'HiTeR2504');
    expect(d.heroPosition).toBe('BTN');
    expect(d.heroCards).toEqual([{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }]);
    expect(d.heroResultCny).toBe(-156.1);
    expect(d.kind).toBe('allin');
    expect(d.allin).toEqual({ street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 });
    // El OCR leyó el -¥156.10 del héroe con confianza 0: resultado y bote quedan para revisar.
    expect(d.uncertain).toEqual(expect.arrayContaining(['heroResultCny', 'allin']));
  });

  it('all-in: si falta el importe de otra fila de RIVER, el bote queda marcado como incierto', () => {
    const river = ocr.columns.river.filter((w) => w.text !== '191.10' && w.text !== '+¥');
    const d = parseHand({ ...ocr, columns: { ...ocr.columns, river } }, layout, 'HiTeR2504');
    expect(d.kind).toBe('allin');
    expect(d.uncertain).toContain('allin');
  });

  it('all-in: si el porcentaje del héroe sale solo de la pasada por columna, se marca incierto', () => {
    const full = ocr.full.filter((w) => w.text !== '13%');
    const d = parseHand({ ...ocr, full }, layout, 'HiTeR2504');
    expect(d.kind).toBe('allin');
    expect(d.uncertain).toContain('allin');
  });

  it('héroe inexistente: borrador sin crash, con campos inciertos', () => {
    const d = parseHand(ocr, layout, 'NoExiste99');
    expect(d.handId).toBe('1323539300829384704');
    expect(d.heroCards).toEqual([{ rank: null, suit: null }, { rank: null, suit: null }]);
    expect(d.heroPosition).toBeNull();
    expect(d.heroResultCny).toBeNull();
    expect(d.kind).toBe('study');
    expect(d.uncertain).toEqual(expect.arrayContaining(['heroCards', 'heroPosition', 'heroResultCny']));
  });
});

describe('emptyHandDraft', () => {
  it('marca todo como incierto', () => {
    expect(emptyHandDraft().uncertain).toEqual(['handId', 'playedAt', 'heroPosition', 'heroCards', 'heroResultCny']);
  });
});
