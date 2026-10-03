import { describe, expect, it } from 'vitest';
import { decodePng } from '../image/rgba';
import type { OcrEngine, OcrMode } from '../ocr/engine';
import type { OcrWord } from '../ocr/types';
import { COLUMN_SCALE } from '../ocr/columns';
import { columnRect, findHeader, LAYOUT_COLUMNS } from '../parsers/handLayout';
import type { HandOcr } from '../parsers/hand';
import { fixtureBytes, fixtureJson, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';
import { emptyHandDraft } from '../parsers/hand';
import { loadSeedTemplates } from '../vision/seeds';
import { analyzeFile, importedHandDraft, type IncomingFile } from './pipeline';

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
const NOW = 1759500000000;
const deps = (engine: OcrEngine) => ({ engine, decode: async (f: IncomingFile) => decodePng(f.bytes), templates: loadSeedTemplates(), heroName: 'RacsoSM', now: () => NOW });

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
    if (a.kind === 'hand') expect(a.draft).toMatchObject({ heroPosition: 'HJ', heroResultCny: -28, playedAt: NOW });
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
    // Sin nada que leer, el identificador y la fecha se generan igual.
    if (a.kind === 'hand') expect(a.draft).toMatchObject({ handId: expect.stringMatching(/^img-/), playedAt: NOW });
  });
});

describe('importedHandDraft', () => {
  const f = file(HAND_PNG);

  it('pone siempre identificador generado y fecha de la subida', () => {
    const d = importedHandDraft(emptyHandDraft(), f, NOW);
    expect(d.handId).toMatch(/^img-[0-9a-f]{16}$/);
    expect(d.playedAt).toBe(NOW);
    // No son lecturas dudosas, son valores puestos a propósito: no se marcan para revisar.
    expect(d.uncertain).not.toContain('handId');
    expect(d.uncertain).not.toContain('playedAt');
  });

  it('el mismo archivo da siempre el mismo identificador, para detectar repetidas', () => {
    expect(importedHandDraft(emptyHandDraft(), f, NOW).handId).toBe(importedHandDraft(emptyHandDraft(), f, NOW + 5000).handId);
    expect(importedHandDraft(emptyHandDraft(), file(SUMMARY_PNG), NOW).handId).not.toBe(importedHandDraft(emptyHandDraft(), f, NOW).handId);
  });

  it('descarta lo que viniera en el borrador', () => {
    const d = importedHandDraft({ ...emptyHandDraft(), handId: '1323539300829384704', playedAt: 123 }, f, NOW);
    expect(d.handId).toMatch(/^img-/);
    expect(d.playedAt).toBe(NOW);
  });
});
