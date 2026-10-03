import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures');
export const SUMMARY_PNG = 'session-summary-01.png';
export const HAND_PNG = 'hand-1323539300829384704.png';
// Capturas del móvil: interfaz en español, menos resolución y ciegas dentro de PRE-FLOP.
export const MOBILE_SUMMARY_PNG = 'mobile-summary-01.png';
export const MOBILE_HAND_PNGS = ['mobile-hand-01.png', 'mobile-hand-02.png'] as const;

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

export function fixtureJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), 'utf8')) as T;
}
