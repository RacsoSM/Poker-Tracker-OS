import { pixel, type RGBA, type Rect } from '../image/rgba';

export interface RowBox { y0: number; y1: number }

// Una fila de jugador ocupa casi todo el ancho de la columna; la píldora con el bote de la
// calle, centrada bajo la cabecera, se queda bastante más corta.
const MIN_FILL = 0.9;

function modeColor(img: RGBA, x: number, y0: number, y1: number): [number, number, number] {
  const freq = new Map<string, number>();
  for (let y = y0; y < y1; y++) {
    const key = pixel(img, x, y).join(',');
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const [best] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  return best.split(',').map(Number) as [number, number, number];
}

// Las filas son recuadros (≈38,40,54) sobre el fondo de la columna (≈31,33,46).
// Una línea es "hueco" si ≥97% de las muestras están a ≤4 del color de fondo.
export function detectRows(img: RGBA, rect: Rect): RowBox[] {
  const s = img.width / 1280;
  const y0 = Math.max(0, rect.y);
  const y1 = Math.min(img.height, rect.y + rect.h);
  const bg = modeColor(img, rect.x + Math.round(5 * s), y0, y1);
  const near = (x: number, y: number) => {
    const [r, g, b] = pixel(img, x, y);
    return Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) <= 4;
  };
  const xs: number[] = [];
  for (let x = Math.round(rect.x + rect.w * 0.1); x < rect.x + rect.w * 0.9; x += 6) xs.push(x);
  const wide: number[] = [];
  for (let x = Math.round(rect.x + rect.w * 0.03); x < rect.x + rect.w * 0.97; x += 2) wide.push(x);

  // Ancho máximo cubierto por la fila, para descartar la píldora del bote.
  const fills = (a: number, b: number): number => {
    let best = 0;
    for (let y = a; y <= b; y++) {
      let ink = 0;
      for (const x of wide) if (!near(x, y)) ink++;
      best = Math.max(best, ink / wide.length);
    }
    return best;
  };

  const minH = 60 * s;
  const rows: RowBox[] = [];
  const push = (a: number, b: number) => {
    if (b - a >= minH && fills(a, b) >= MIN_FILL) rows.push({ y0: a, y1: b });
  };
  let start = -1;
  for (let y = y0; y < y1; y++) {
    let hits = 0;
    for (const x of xs) if (near(x, y)) hits++;
    const gap = hits / xs.length >= 0.97;
    if (!gap && start < 0) start = y;
    if (gap && start >= 0) {
      push(start, y - 1);
      start = -1;
    }
  }
  if (start >= 0) push(start, y1 - 1);
  return rows;
}
