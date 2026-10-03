import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { createOcrEngine, type OcrEngine } from '../ocr/engine';
import { nodeOcrPaths } from '../ocr/nodePaths';
import { fixtureBytes, MOBILE_HAND_PNGS, MOBILE_SUMMARY_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { analyzeFile, type IncomingFile } from './pipeline';

// De punta a punta con el motor real sobre las capturas del móvil: lo que antes salía como
// "imagen desconocida" ahora tiene que clasificarse y leerse solo.
let engine: OcrEngine;
beforeAll(async () => { engine = await createOcrEngine(nodeOcrPaths()); });
afterAll(async () => { await engine.terminate(); });

const LAST_MODIFIED = 1759490000000;
const file = (name: string): IncomingFile => ({ bytes: fixtureBytes(name), mime: 'image/png', lastModified: LAST_MODIFIED, name });
const deps = () => ({ engine, decode: async (f: IncomingFile) => decodePng(f.bytes), templates: loadSeedTemplates(), heroName: 'RacsoSM' });

describe('analyzeFile sobre capturas del móvil', () => {
  it('resumen en español con coma decimal', async () => {
    const a = await analyzeFile(file(MOBILE_SUMMARY_PNG), deps());
    expect(a.kind).toBe('summary');
    if (a.kind === 'summary') expect(a.draft).toEqual({ resultCny: 177.74, hands: 29, durationSec: 296, uncertain: [] });
  });

  it('mano ganada desde el straddle', async () => {
    const a = await analyzeFile(file(MOBILE_HAND_PNGS[0]), deps());
    expect(a.kind).toBe('hand');
    if (a.kind === 'hand') {
      expect(a.draft).toMatchObject({ heroPosition: 'UTG', heroResultCny: 96.23, kind: 'study' });
      // El móvil no enseña identificador ni fecha: se completan desde el archivo.
      expect(a.draft.handId).toMatch(/^img-[0-9a-f]{16}$/);
      expect(a.draft.playedAt).toBe(LAST_MODIFIED);
      expect(a.draft.uncertain).not.toContain('handId');
      expect(a.draft.uncertain).toContain('playedAt');
    }
  });

  it('mano con all-in en el turn', async () => {
    const a = await analyzeFile(file(MOBILE_HAND_PNGS[1]), deps());
    expect(a.kind).toBe('hand');
    if (a.kind === 'hand') {
      expect(a.draft).toMatchObject({ heroPosition: 'MP', heroResultCny: 146.65, kind: 'allin' });
      expect(a.draft.allin).toEqual({ street: 'turn', heroEquity: 0.95, potContested: 290.3, heroInvested: 143.65 });
    }
  });
});
