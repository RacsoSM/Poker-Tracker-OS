import { describe, expect, it } from 'vitest';
import { fixtureBytes, MOBILE_HAND_PNGS } from '../test/fixtures';
import { hashBytes, isManualHandId, isSyntheticHandId, manualHandId, syntheticHandId, SYNTHETIC_PREFIX } from './syntheticId';

const bytes = (...n: number[]) => new Uint8Array(n);

describe('syntheticHandId', () => {
  it('los mismos bytes dan siempre el mismo identificador', () => {
    const a = fixtureBytes(MOBILE_HAND_PNGS[0]);
    expect(syntheticHandId(a)).toBe(syntheticHandId(fixtureBytes(MOBILE_HAND_PNGS[0])));
    expect(syntheticHandId(a)).toMatch(/^img-[0-9a-f]{16}$/);
  });

  it('capturas distintas dan identificadores distintos', () => {
    expect(syntheticHandId(fixtureBytes(MOBILE_HAND_PNGS[0]))).not.toBe(syntheticHandId(fixtureBytes(MOBILE_HAND_PNGS[1])));
  });

  it('distingue cambios mínimos y bytes en distinto orden', () => {
    expect(hashBytes(bytes(1, 2, 3))).not.toBe(hashBytes(bytes(1, 2, 4)));
    expect(hashBytes(bytes(1, 2, 3))).not.toBe(hashBytes(bytes(3, 2, 1)));
    // La longitud entra en la semilla, así que un archivo más largo nunca coincide.
    expect(hashBytes(bytes(1, 2, 3))).not.toBe(hashBytes(bytes(1, 2, 3, 0)));
  });

  it('se distingue de un identificador real de WPT', () => {
    expect(isSyntheticHandId(syntheticHandId(bytes(1)))).toBe(true);
    expect(isSyntheticHandId('1323539300829384704')).toBe(false);
    expect(SYNTHETIC_PREFIX).toBe('img-');
  });
});

describe('manualHandId', () => {
  it('genera IDs distintos, reconocibles como manuales y no como de captura', () => {
    const a = manualHandId();
    expect(a).toMatch(/^man-[0-9a-f]{16}$/);
    expect(manualHandId()).not.toBe(a);
    expect(isManualHandId(a)).toBe(true);
    expect(isSyntheticHandId(a)).toBe(false);
  });
});
