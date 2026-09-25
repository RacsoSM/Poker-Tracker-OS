import { createWorker, OEM, PSM, type Page } from 'tesseract.js';
import { toBlob } from '../image/blob';
import type { OcrWord } from './types';

export type OcrMode = 'block' | 'sparse';

export interface OcrEngine {
  recognize(image: Uint8Array, mode: OcrMode): Promise<OcrWord[]>;
  terminate(): Promise<void>;
}

export interface OcrEnginePaths { workerPath?: string; corePath?: string; langPath?: string; cacheMethod?: string }

export function pageWords(page: Page): OcrWord[] {
  const out: OcrWord[] = [];
  for (const b of page.blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        for (const w of l.words) {
          if (!w.text.trim()) continue;
          out.push({ text: w.text, conf: Math.round(w.confidence), x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
        }
      }
    }
  }
  return out;
}

export async function createOcrEngine(paths: OcrEnginePaths = {}): Promise<OcrEngine> {
  const worker = await createWorker('eng', OEM.LSTM_ONLY, paths);
  return {
    async recognize(image, mode) {
      // SINGLE_BLOCK es el modo por defecto de tesseract.js y el que usó la prueba (spec §10a).
      await worker.setParameters({ tessedit_pageseg_mode: mode === 'sparse' ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK });
      const input =
        typeof window === 'undefined'
          ? (globalThis as unknown as { Buffer: { from(b: Uint8Array): Buffer } }).Buffer.from(image)
          : toBlob(image, 'image/png');
      const { data } = await worker.recognize(input, {}, { blocks: true });
      return pageWords(data);
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
