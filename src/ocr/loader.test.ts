import { describe, expect, it } from 'vitest';
import type { OcrEngine } from './engine';
import { createEngineLoader, OcrUnavailableError } from './loader';

const engine: OcrEngine = { recognize: async () => [], terminate: async () => {} };

describe('createEngineLoader', () => {
  it('traduce el fallo a un mensaje claro y reintenta en la siguiente llamada', async () => {
    let attempts = 0;
    const get = createEngineLoader(async () => {
      attempts++;
      if (attempts === 1) throw new Error('network');
      return engine;
    });
    await expect(get()).rejects.toBeInstanceOf(OcrUnavailableError);
    await expect(get()).resolves.toBe(engine);
    await expect(get()).resolves.toBe(engine);
    expect(attempts).toBe(2);
  });
});
