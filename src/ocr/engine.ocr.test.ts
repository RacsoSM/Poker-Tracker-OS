import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import { buildHandLayout } from '../parsers/handLayout';
import { fixtureBytes, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { ocrColumns } from './columns';
import { createOcrEngine, type OcrEngine } from './engine';
import { nodeOcrPaths } from './nodePaths';

let engine: OcrEngine;
beforeAll(async () => { engine = await createOcrEngine(nodeOcrPaths()); });
afterAll(async () => { await engine.terminate(); });

describe('OCR real sobre los fixtures', () => {
  it('lee el resumen', async () => {
    const text = (await engine.recognize(fixtureBytes(SUMMARY_PNG), 'block')).map((w) => w.text).join(' ');
    expect(text).toContain('-CN¥13.00');
    expect(text).toMatch(/18\s+hands/);
    expect(text).toContain('00:02:13');
  });
  it('lee cabecera, héroe y porcentajes de la mano', async () => {
    const full = await engine.recognize(fixtureBytes(HAND_PNG), 'block');
    const texts = full.map((w) => w.text);
    expect(texts).toContain('1323539300829384704');
    expect(texts).toContain('RacsoSM');
    expect(texts).toContain('13%');
    expect(texts).toContain('87%');
    const img = decodePng(fixtureBytes(HAND_PNG));
    const layout = buildHandLayout(img, full, loadSeedTemplates())!;
    const cols = await ocrColumns(engine, img, layout);
    const river = cols.river.map((w) => w.text).join(' ');
    expect(river).toMatch(/\+¥\s?191\.10/);
    expect(river).toMatch(/-¥\s?28\.00/);
  });
});
