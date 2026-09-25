export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function nameMatches(text: string, heroName: string): boolean {
  const a = normalizeName(text);
  const b = normalizeName(heroName);
  if (!b || !a) return false;
  if (a === b) return true;
  return b.length >= 5 && Math.abs(a.length - b.length) <= 1 && levenshtein(a, b) <= 1;
}
