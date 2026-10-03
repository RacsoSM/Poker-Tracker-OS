// Signos que el OCR puede devolver: +, guion, en dash, em dash y signo menos.
export const SIGN = '[+\\-–—−]';
// La moneda aparece como "¥", "CN¥" o "CNY"; el OCR confunde ¥ con Y y a veces cuela espacios.
export const CURRENCY = '(?:C\\s*N\\s*)?[¥Y]';
// Importe suelto: cifras con separadores de miles y/o decimales, en cualquier orden.
export const AMOUNT = '\\d[\\d.,]*';

export function isNegativeSign(s: string | undefined): boolean {
  return s !== undefined && /[-–—−]/.test(s);
}

// El móvil usa coma decimal ("CN¥ 211,23") y el escritorio punto ("¥ 1,156.10"),
// y ambos omiten los decimales en los enteros ("CN¥ 0"). Se decide por posición:
// el último separador es el decimal si le siguen 1 o 2 cifras; si no, es de miles.
export function parseAmount(raw: string): number | null {
  const t = raw.replace(/\s/g, '').replace(/[.,]+$/, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const last = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
  const decimals = last >= 0 && t.length - last - 1 <= 2;
  const intPart = (decimals ? t.slice(0, last) : t).replace(/[.,]/g, '');
  const frac = decimals ? t.slice(last + 1) : '';
  const n = Number(frac ? `${intPart}.${frac}` : intPart);
  return Number.isFinite(n) ? n : null;
}
