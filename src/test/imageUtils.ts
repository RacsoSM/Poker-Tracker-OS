import type { RGBA } from '../image/rgba';

export function resizeNearest(img: RGBA, factor: number): RGBA {
  const width = Math.round(img.width * factor);
  const height = Math.round(img.height * factor);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / factor));
      const sy = Math.min(img.height - 1, Math.floor(y / factor));
      const si = (sy * img.width + sx) * 4;
      data.set(img.data.subarray(si, si + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function addNoise(img: RGBA, amp: number, seed = 42): RGBA {
  let state = seed;
  const rand = () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const data = new Uint8Array(img.data);
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) continue;
    data[i] = Math.max(0, Math.min(255, data[i] + Math.round((rand() * 2 - 1) * amp)));
  }
  return { width: img.width, height: img.height, data };
}
