// Cola de una sola vía: cada tarea empieza cuando termina la anterior (haya fallado o no).
export function createSerial() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn);
    tail = result.catch(() => undefined);
    return result;
  };
}
