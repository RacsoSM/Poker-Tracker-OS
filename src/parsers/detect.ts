import type { OcrWord } from '../ocr/types';

export function detectKind(words: OcrWord[]): 'summary' | 'hand' | 'unknown' {
  const text = words.map((w) => w.text).join(' ').toLowerCase();
  if (/my\s*stats/.test(text)) return 'summary';
  if (/hand\s*id/.test(text)) return 'hand';
  return 'unknown';
}
