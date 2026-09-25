import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx|css)$/.test(name) ? [p] : [];
  });
}

describe('codificación', () => {
  it('ningún archivo fuente tiene acentos doblemente codificados (mojibake)', () => {
    const bad = sourceFiles(join(process.cwd(), 'src')).filter((f) => /Ã[\u0080-ÿ]|Â[\u0080-ÿ]/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
