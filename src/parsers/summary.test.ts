import { describe, expect, it } from 'vitest';
import type { OcrWord } from '../ocr/types';
import { fixtureJson } from '../test/fixtures';
import { emptySummaryDraft, parseSummary } from './summary';

let y = 0;
const w = (text: string, conf = 95): OcrWord => ({ text, conf, x0: 0, y0: (y += 40), x1: 50, y1: y + 20 });

describe('parseSummary', () => {
  it('lee el fixture real', () => {
    const d = parseSummary(fixtureJson<{ full: OcrWord[] }>('session-summary-01.ocr.json').full);
    expect(d).toEqual({ resultCny: -13, hands: 18, durationSec: 133, uncertain: [] });
  });
  it('acepta positivo, sin signo, miles y guion tipográfico', () => {
    expect(parseSummary([w('+CN¥1,234.50'), w('Total:'), w('1,250'), w('hands,'), w('Duration:'), w('01:30:00')])).toMatchObject({ resultCny: 1234.5, hands: 1250, durationSec: 5400 });
    expect(parseSummary([w('CN¥5.00')]).resultCny).toBe(5);
    expect(parseSummary([w('—CN¥3.00')]).resultCny).toBe(-3);
    expect(parseSummary([w('-CN'), w('Y13.00')]).resultCny).toBe(-13);
  });
  it('marca inciertos los campos ausentes o de baja confianza', () => {
    const d = parseSummary([w('-CN¥13.00', 40), w('18'), w('hands')]);
    expect(d.resultCny).toBe(-13);
    expect(d.durationSec).toBeNull();
    expect([...d.uncertain].sort()).toEqual(['durationSec', 'resultCny']);
  });
  it('borrador vacío con todo incierto', () => {
    expect(emptySummaryDraft()).toEqual({ resultCny: null, hands: null, durationSec: null, uncertain: ['resultCny', 'hands', 'durationSec'] });
  });
});
