import { createOcrEngine, type OcrEngine } from './engine';

export class OcrUnavailableError extends Error {
  constructor() {
    super('No se pudo cargar el lector de capturas. Conéctate a internet una vez para descargarlo.');
  }
}

export function createEngineLoader(factory: () => Promise<OcrEngine>): () => Promise<OcrEngine> {
  let pending: Promise<OcrEngine> | null = null;
  return () => {
    pending ??= factory().catch((e: unknown) => {
      pending = null;
      console.error(e);
      throw new OcrUnavailableError();
    });
    return pending;
  };
}

export const getBrowserEngine = createEngineLoader(() =>
  createOcrEngine({ workerPath: '/tesseract/worker.min.js', corePath: '/tesseract/core', langPath: '/tesseract/lang' }),
);
