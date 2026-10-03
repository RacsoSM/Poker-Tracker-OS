import type { OcrWord } from '../ocr/types';

export const STREET_HEADER = /^(PRE-?FLOP|FLOP|TURN|RIVER)$/i;

// La app cambia de idioma (escritorio en inglés, móvil del usuario en español) y el OCR
// pierde las tildes, así que se buscan las raíces sin acentos.
const SUMMARY = /my\s*stats|mis\s*estad[ií]?sticas|duraci[oó]?n\s*del\s*juego|game\s*duration/i;
const HAND = /hand\s*id/i;

export function detectKind(words: OcrWord[]): 'summary' | 'hand' | 'unknown' {
  const text = words.map((w) => w.text).join(' ');
  if (SUMMARY.test(text)) return 'summary';
  if (HAND.test(text)) return 'hand';
  // El móvil no muestra "HAND ID": la mano se reconoce por su cabecera de calles,
  // que la app deja en inglés en ambos idiomas.
  const streets = new Set(words.filter((w) => STREET_HEADER.test(w.text)).map((w) => w.text.toUpperCase().replace('-', '')));
  return streets.size >= 3 ? 'hand' : 'unknown';
}
