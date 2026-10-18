import type { Rank, SizeClass } from '../domain/types';
import { pixel, type RGBA } from '../image/rgba';
import type { CardBlob } from './cards';

export const GLYPH_W = 16;
export const GLYPH_H = 24;
// Con la distancia tolerante (abajo), en las capturas de prueba un rango bien leído queda por
// debajo de 0.1, y un rango sin plantilla se parece al más cercano a partir de 0.12 (3 y 8).
// Más allá se prefiere no adivinar: el usuario elige la carta y la app aprende.
export const RANK_MATCH_MAX = 0.11;
// Sube cuando cambia la forma de recortar el glifo: las plantillas aprendidas con otro recorte
// ya no se parecen a lo que se extrae ahora.
export const GLYPH_VERSION = 2;

export type Glyph = Uint8Array;
export interface RankTemplate { rank: Rank; sizeClass: SizeClass; glyph: Glyph }

interface Comp { x0: number; y0: number; x1: number; y1: number }

// Recorta la esquina superior izquierda (rango), toma los trazos claros como tinta,
// descarta componentes pequeños (restos del palo, antialias) y normaliza a 16x24.
// Las cartas de asiento asoman recortadas por la placa del nombre: su alto visible es menor y el
// rango ocupa más proporción. Con la mitad, la A perdía las patas y se leía como un 4.
export function extractGlyph(img: RGBA, card: CardBlob): Glyph | null {
  const cw = Math.min(card.w, Math.round(card.h * 0.62));
  const ch = Math.round(card.h * (card.sizeClass === 'hole' ? 0.58 : 0.5));
  const ink = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const [r, g, b] = pixel(img, card.x + x, card.y + y);
      ink[y * cw + x] = Math.min(r, g, b) > 150 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(cw * ch);
  const comps: Comp[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const c: Comp = { x0: cw, y0: ch, x1: 0, y1: 0 };
    while (stack.length) {
      const q = stack.pop()!;
      const qx = q % cw;
      const qy = (q - qx) / cw;
      c.x0 = Math.min(c.x0, qx); c.x1 = Math.max(c.x1, qx);
      c.y0 = Math.min(c.y0, qy); c.y1 = Math.max(c.y1, qy);
      const neigh = [qx > 0 ? q - 1 : -1, qx < cw - 1 ? q + 1 : -1, qy > 0 ? q - cw : -1, qy < ch - 1 ? q + cw : -1];
      for (const nq of neigh) {
        if (nq >= 0 && ink[nq] && !seen[nq]) {
          seen[nq] = 1;
          stack.push(nq);
        }
      }
    }
    comps.push(c);
  }
  if (comps.length === 0) return null;
  const maxH = Math.max(...comps.map((c) => c.y1 - c.y0));
  const keep = comps.filter((c) => c.y1 - c.y0 >= maxH * 0.6);
  const bx0 = Math.min(...keep.map((c) => c.x0));
  const bx1 = Math.max(...keep.map((c) => c.x1));
  const by0 = Math.min(...keep.map((c) => c.y0));
  const by1 = Math.max(...keep.map((c) => c.y1));
  const g = new Uint8Array(GLYPH_W * GLYPH_H);
  for (let y = 0; y < GLYPH_H; y++) {
    for (let x = 0; x < GLYPH_W; x++) {
      const sx = bx0 + Math.floor(((x + 0.5) * (bx1 - bx0 + 1)) / GLYPH_W);
      const sy = by0 + Math.floor(((y + 0.5) * (by1 - by0 + 1)) / GLYPH_H);
      g[y * GLYPH_W + x] = ink[sy * cw + sx];
    }
  }
  return g;
}

// Fracción de píxeles distintos. Una diferencia no cuenta si a un píxel de distancia los dos
// glifos sí coinciden: así un trazo desplazado un píxel al reescalar no penaliza.
export function glyphDistance(a: Glyph, b: Glyph): number {
  const has = (g: Glyph, x: number, y: number, v: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < GLYPH_W && yy < GLYPH_H && g[yy * GLYPH_W + xx] === v) return true;
      }
    }
    return false;
  };
  let d = 0;
  for (let y = 0; y < GLYPH_H; y++) {
    for (let x = 0; x < GLYPH_W; x++) {
      const i = y * GLYPH_W + x;
      if (a[i] !== b[i] && !(has(b, x, y, a[i]) && has(a, x, y, b[i]))) d++;
    }
  }
  return d / a.length;
}

// Se compara con todas las plantillas, de asiento y comunitarias: el glifo normalizado de un
// rango es casi igual en los dos tamaños, y así basta con haber visto el rango en uno de ellos.
export function matchRank(g: Glyph, templates: RankTemplate[]): { rank: Rank; distance: number } | null {
  let best: { rank: Rank; distance: number } | null = null;
  for (const t of templates) {
    const distance = glyphDistance(g, t.glyph);
    if (!best || distance < best.distance) best = { rank: t.rank, distance };
  }
  return best && best.distance <= RANK_MATCH_MAX ? best : null;
}

export function glyphToString(g: Glyph): string {
  return Array.from(g).join('');
}

export function glyphFromString(s: string): Glyph {
  return Uint8Array.from(s, (ch) => (ch === '1' ? 1 : 0));
}
