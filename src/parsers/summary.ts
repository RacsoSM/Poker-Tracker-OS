import type { OcrWord } from '../ocr/types';
import { isNegativeSign, SIGN } from './money';
import { readingOrder } from './words';

export type SummaryField = 'resultCny' | 'hands' | 'durationSec';
export interface SummaryDraft { resultCny: number | null; hands: number | null; durationSec: number | null; uncertain: SummaryField[] }

const RESULT = new RegExp(`(${SIGN})?\\s*CN\\s*[¥Y]\\s*(\\d[\\d,]*\\.\\d{2})`, 'i');
const HANDS = /(\d[\d,]*)\s*hands/i;
const DURATION = /(\d{1,3}):(\d{2}):(\d{2})/;
const MIN_CONF = 60;

export function emptySummaryDraft(): SummaryDraft {
  return { resultCny: null, hands: null, durationSec: null, uncertain: ['resultCny', 'hands', 'durationSec'] };
}

function lowConf(words: OcrWord[], token: string): boolean {
  return words.some((w) => w.text.includes(token) && w.conf < MIN_CONF);
}

export function parseSummary(words: OcrWord[]): SummaryDraft {
  const ordered = readingOrder(words);
  const text = ordered.map((w) => w.text).join(' ');
  const uncertain: SummaryField[] = [];

  let resultCny: number | null = null;
  const r = RESULT.exec(text);
  if (r) {
    const v = Number(r[2].replace(/,/g, ''));
    resultCny = isNegativeSign(r[1]) ? -v : v;
    if (lowConf(ordered, r[2])) uncertain.push('resultCny');
  } else uncertain.push('resultCny');

  let hands: number | null = null;
  const h = HANDS.exec(text);
  if (h) {
    hands = Number(h[1].replace(/,/g, ''));
    if (lowConf(ordered, h[1])) uncertain.push('hands');
  } else uncertain.push('hands');

  let durationSec: number | null = null;
  const d = DURATION.exec(text);
  if (d) {
    durationSec = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
    if (lowConf(ordered, d[0])) uncertain.push('durationSec');
  } else uncertain.push('durationSec');

  return { resultCny, hands, durationSec, uncertain };
}
