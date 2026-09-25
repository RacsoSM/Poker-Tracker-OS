import { describe, expect, it } from 'vitest';
import { inferPot } from './allin';

const OTHERS_WHEN_BTN_HERO = [191.1, -28, -4, -2, -1, 0, 0];
const OTHERS_WHEN_CO_HERO = [-156.1, -28, -4, -2, -1, 0, 0];

describe('inferPot', () => {
  it('héroe pierde heads-up (BTN de la mano de prueba)', () => {
    expect(inferPot(-156.1, OTHERS_WHEN_BTN_HERO, 2)).toEqual({ heroInvested: 156.1, potContested: 347.2, ambiguous: false });
  });
  it('héroe gana heads-up (CO de la mano de prueba)', () => {
    expect(inferPot(191.1, OTHERS_WHEN_CO_HERO, 2)).toEqual({ heroInvested: 156.1, potContested: 347.2, ambiguous: false });
  });
  it('marca ambiguo con 3+ jugadores en el all-in', () => {
    expect(inferPot(-100, [150, -50], 3).ambiguous).toBe(true);
  });
  it('marca ambiguo con bote dividido o resultado cero', () => {
    expect(inferPot(0, [0, -2], 2).ambiguous).toBe(true);
    expect(inferPot(20, [20, -40], 2).ambiguous).toBe(true);
  });
});
