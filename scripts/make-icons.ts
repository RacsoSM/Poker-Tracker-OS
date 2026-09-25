import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from '../src/image/rgba';

// Ficha de póker: fondo oscuro, anillo verde con marcas blancas y centro verde.
function chip(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy) / c;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      let col: [number, number, number] = [15, 17, 21];
      if (r < 0.86) col = Math.floor(angle * 8) % 2 === 0 && r > 0.66 ? [240, 240, 240] : [10, 122, 43];
      if (r < 0.62) col = [17, 90, 40];
      if (r < 0.58) col = [10, 122, 43];
      const o = (y * size + x) * 4;
      data.set([...col, 255], o);
    }
  }
  return encodePng({ width: size, height: size, data });
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) writeFileSync(`public/icons/icon-${size}.png`, chip(size));
console.log('Iconos generados');
