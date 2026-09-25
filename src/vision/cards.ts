import type { SizeClass, Suit } from '../domain/types';
import type { RGBA } from '../image/rgba';

export interface CardBlob { suit: Suit; x: number; y: number; w: number; h: number; sizeClass: SizeClass }

const SUIT_CODES: Suit[] = ['s', 'h', 'd', 'c'];

// Baraja de 4 colores de WPT (spec §10a).
export function classifyPixel(r: number, g: number, b: number): Suit | null {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  // Picas: cartas negras neutras (≈28,28,28). La placa del nombre es oscura pero azulada (33,33,41).
  if (mx < 45 && mx - mn < 6) return 's';
  if (mx - mn < 60) return null;
  if (r > 110 && g < 70 && b < 70) return 'h';
  if (g > r && g > b && g > 90) return 'c';
  if (b > r && b > g && b > 120) return 'd';
  return null;
}

export function detectCards(img: RGBA, maxY: number): CardBlob[] {
  const W = img.width;
  const H = Math.min(img.height, Math.max(0, Math.floor(maxY)));
  const s = W / 1280;
  const cls = new Int8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const suit = classifyPixel(img.data[p * 4], img.data[p * 4 + 1], img.data[p * 4 + 2]);
    cls[p] = suit ? SUIT_CODES.indexOf(suit) + 1 : 0;
  }
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const out: CardBlob[] = [];
  for (let start = 0; start < W * H; start++) {
    const c = cls[start];
    if (!c || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let n = 0;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (top > 0) {
      const q = stack[--top];
      n++;
      const qx = q % W;
      const qy = (q - qx) / W;
      if (qx < x0) x0 = qx;
      if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy;
      if (qy > y1) y1 = qy;
      const neigh = [qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1, qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1];
      for (const nq of neigh) {
        if (nq >= 0 && !seen[nq] && cls[nq] === c) {
          seen[nq] = 1;
          stack[top++] = nq;
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const ratio = h / w;
    const suit = SUIT_CODES[c - 1];
    const sizeClass: SizeClass = h / W >= 0.09 ? 'board' : 'hole';
    if (h < 35 * s || h > 0.15 * W || n / (w * h) <= 0.45) continue;
    if (w >= 25 * s && ratio > 1.1 && ratio < 1.9) {
      out.push({ suit, x: x0, y: y0, w, h, sizeClass });
    } else if (sizeClass === 'hole' && ratio > 0.5 && ratio <= 1.1 && h >= 0.06 * W) {
      // Dos cartas de asiento del mismo palo superpuestas y fundidas (p. ej. al reescalar se pierde
      // la línea que las separa). La de delante se ve entera (ancho ≈ 0.87 × alto).
      // Debe ser rectangular (esquinas con color de carta) para no partir avatares redondos.
      const inset = Math.max(2, Math.round(8 * s));
      const rectangular = cls[(y1 - inset) * W + x0 + inset] === c && cls[(y0 + inset) * W + x1 - inset] === c;
      if (!rectangular) continue;
      const rightW = Math.round(h * 0.87);
      const leftW = w - rightW;
      if (leftW >= h * 0.4) {
        out.push({ suit, x: x0, y: y0, w: leftW, h, sizeClass });
        out.push({ suit, x: x0 + leftW, y: y0, w: rightW, h, sizeClass });
      }
    }
  }
  return out;
}
