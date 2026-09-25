import { describe, expect, it } from 'vitest';
import { binarize, decodePng, encodePng, pixel } from './rgba';
import { fixtureBytes, HAND_PNG, SUMMARY_PNG } from '../test/fixtures';

describe('rgba', () => {
  it('decodifica los fixtures a RGBA', () => {
    const hand = decodePng(fixtureBytes(HAND_PNG));
    expect([hand.width, hand.height, hand.data.length]).toEqual([1280, 2295, 1280 * 2295 * 4]);
    expect(pixel(hand, 640, 400)).toEqual([139, 25, 25]);
    const sum = decodePng(fixtureBytes(SUMMARY_PNG));
    expect([sum.width, sum.height]).toEqual([469, 363]);
  });
  it('codifica y vuelve a decodificar sin pérdidas', () => {
    const img = { width: 2, height: 1, data: new Uint8Array([1, 2, 3, 255, 250, 251, 252, 255]) };
    expect(decodePng(encodePng(img))).toEqual(img);
  });
  it('binariza: tinta a negro, resto a blanco, con escala', () => {
    const img = { width: 2, height: 1, data: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]) };
    const out = binarize(img, { x: 0, y: 0, w: 2, h: 1 }, (r) => r > 128, 2);
    expect([out.width, out.height]).toEqual([4, 2]);
    expect(pixel(out, 0, 0)).toEqual([0, 0, 0]);
    expect(pixel(out, 3, 1)).toEqual([255, 255, 255]);
  });
});
