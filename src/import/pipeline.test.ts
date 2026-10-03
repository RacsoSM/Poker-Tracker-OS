import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import type { OcrEngine, OcrMode } from '../ocr/engine';
import type { OcrWord } from '../ocr/types';
import { COLUMN_SCALE } from '../ocr/columns';
import { columnRect, findHeader, LAYOUT_COLUMNS } from '../parsers/handLayout';
import type { HandOcr } from '../parsers/hand';
import { fixtureBytes, fixtureJson, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';
import { loadSeedTemplates } from '../vision/seeds';
import { analyzeFile, type IncomingFile } from './pipeline';

// Motor falso: devuelve las salidas OCR congeladas en el orden en que el pipeline las pide.
// Las palabras de columna del fixture están en coordenadas de la imagen; Tesseract real las
// devuelve en coordenadas del recorte escalado, así que se deshace ese mapeo.
function fakeEngine(full: OcrWord[], columns?: HandOcr['columns']): OcrEngine & { calls: OcrMode[] } {
  const calls: OcrMode[] = [];
  const top = findHeader(full)?.bottom ?? 0;
  let col = 0;
  return {
    calls,
    async recognize(_img, mode) {
      calls.push(mode);
      if (mode === 'block') return full;
      if (!columns) return [];
      // Tras las cinco columnas, el pipeline pide la mesa: aquí no aporta nada.
      if (col >= LAYOUT_COLUMNS.length) return [];
      const name = LAYOUT_COLUMNS[col++];
      const rect = columnRect(1280, 2295, name, top);
      return columns[name].map((w) => ({
        ...w,
        x0: (w.x0 - rect.x) * COLUMN_SCALE,
        y0: (w.y0 - rect.y) * COLUMN_SCALE,
        x1: (w.x1 - rect.x) * COLUMN_SCALE,
        y1: (w.y1 - rect.y) * COLUMN_SCALE,
      }));
    },
    async terminate() {},
  };
}

const file = (name: string): IncomingFile => ({ bytes: fixtureBytes(name), mime: 'image/png', lastModified: 1, name });
const deps = (engine: OcrEngine) => ({ engine, decode: async (f: IncomingFile) => decodePng(f.bytes), templates: loadSeedTemplates(), heroName: 'RacsoSM' });

describe('analyzeFile', () => {
  it('resumen: una sola pasada y borrador listo', async () => {
    const engine = fakeEngine(fixtureJson<{ full: OcrWord[] }>('session-summary-01.ocr.json').full);
    const a = await analyzeFile(file(SUMMARY_PNG), deps(engine));
    expect(a.kind).toBe('summary');
    if (a.kind === 'summary') expect(a.draft).toMatchObject({ resultCny: -13, hands: 18, durationSec: 133 });
    expect(engine.calls).toEqual(['block']);
  });
  it('mano: pasada completa + 5 columnas + mesa', async () => {
    const ocr = fixtureJson<HandOcr>('hand-1323539300829384704.ocr.json');
    const engine = fakeEngine(ocr.full, ocr.columns);
    const a = await analyzeFile(file(HAND_PNG), deps(engine));
    expect(a.kind).toBe('hand');
    if (a.kind === 'hand') expect(a.draft).toMatchObject({ handId: '1323539300829384704', heroPosition: 'HJ', heroResultCny: -28 });
    expect(engine.calls).toEqual(['block', 'sparse', 'sparse', 'sparse', 'sparse', 'sparse', 'sparse']);
  });
  it('imagen desconocida', async () => {
    const engine = fakeEngine([{ text: 'Lobby', conf: 90, x0: 0, y0: 0, x1: 1, y1: 1 }]);
    expect((await analyzeFile(file(SUMMARY_PNG), deps(engine))).kind).toBe('unknown');
  });
  it('mano sin cabecera de columnas: borrador vacío en vez de error', async () => {
    const engine = fakeEngine([{ text: 'HAND', conf: 90, x0: 0, y0: 0, x1: 1, y1: 1 }, { text: 'ID', conf: 90, x0: 2, y0: 0, x1: 3, y1: 1 }]);
    const a = await analyzeFile(file(HAND_PNG), deps(engine));
    expect(a.kind).toBe('hand');
    if (a.kind === 'hand') expect(a.draft.handId).toBeNull();
  });
});
