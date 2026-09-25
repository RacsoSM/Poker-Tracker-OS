// Signos que el OCR puede devolver: +, guion, en dash, em dash y signo menos.
export const SIGN = '[+\\-–—−]';

export function isNegativeSign(s: string | undefined): boolean {
  return s !== undefined && /[-–—−]/.test(s);
}
