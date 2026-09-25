import { decode, encode } from 'fast-png';

export interface RGBA { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export interface Rect { x: number; y: number; w: number; h: number }

export function decodePng(bytes: Uint8Array): RGBA {
  const p = decode(bytes);
  if (p.depth !== 8) throw new Error(`PNG de ${p.depth} bits no soportado`);
  if (p.palette) throw new Error('PNG con paleta no soportado');
  const c = p.channels;
  const src = p.data as Uint8Array;
  if (c === 4) return { width: p.width, height: p.height, data: src };
  const n = p.width * p.height;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = src[i * c];
    data[i * 4] = r;
    data[i * 4 + 1] = c >= 3 ? src[i * c + 1] : r;
    data[i * 4 + 2] = c >= 3 ? src[i * c + 2] : r;
    data[i * 4 + 3] = c === 2 ? src[i * c + 1] : 255;
  }
  return { width: p.width, height: p.height, data };
}

export function encodePng(img: RGBA): Uint8Array {
  return encode({ width: img.width, height: img.height, data: img.data, channels: 4, depth: 8 });
}

export function pixel(img: RGBA, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function binarize(
  img: RGBA,
  rect: Rect,
  isInk: (r: number, g: number, b: number) => boolean,
  scale = 1,
): RGBA {
  const width = rect.w * scale;
  const height = rect.h * scale;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(img, rect.x + Math.floor(x / scale), rect.y + Math.floor(y / scale));
      const v = isInk(r, g, b) ? 0 : 255;
      const o = (y * width + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}
