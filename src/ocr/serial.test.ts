import { describe, expect, it } from 'vitest';
import { createSerial } from './serial';

describe('createSerial', () => {
  it('ejecuta las tareas de una en una aunque se pidan a la vez', async () => {
    const run = createSerial();
    const log: string[] = [];
    const task = (name: string, ms: number) => run(async () => {
      log.push(`${name}:inicio`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`${name}:fin`);
      return name;
    });
    const results = await Promise.all([task('a', 20), task('b', 1)]);
    expect(results).toEqual(['a', 'b']);
    expect(log).toEqual(['a:inicio', 'a:fin', 'b:inicio', 'b:fin']);
  });
  it('un fallo no bloquea las tareas siguientes', async () => {
    const run = createSerial();
    await expect(run(async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(run(async () => 1)).resolves.toBe(1);
  });
});
