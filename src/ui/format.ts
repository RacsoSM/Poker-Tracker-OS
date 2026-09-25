export function signClass(n: number | null): '' | 'pos' | 'neg' {
  if (n === null || n === 0) return '';
  return n > 0 ? 'pos' : 'neg';
}
