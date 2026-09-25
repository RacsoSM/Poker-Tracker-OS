import type { OcrWord } from '../ocr/types';

export function readingOrder(words: OcrWord[]): OcrWord[] {
  const sorted = [...words].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const lines: OcrWord[][] = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2;
    const h = Math.max(1, w.y1 - w.y0);
    const line = lines[lines.length - 1];
    if (line) {
      const lc = (line[0].y0 + line[0].y1) / 2;
      if (Math.abs(cy - lc) <= h * 0.6) {
        line.push(w);
        continue;
      }
    }
    lines.push([w]);
  }
  return lines.flatMap((l) => l.sort((a, b) => a.x0 - b.x0));
}
