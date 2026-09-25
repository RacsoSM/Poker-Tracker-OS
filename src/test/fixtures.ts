import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures');
export const SUMMARY_PNG = 'session-summary-01.png';
export const HAND_PNG = 'hand-1323539300829384704.png';

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

export function fixtureJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), 'utf8')) as T;
}
