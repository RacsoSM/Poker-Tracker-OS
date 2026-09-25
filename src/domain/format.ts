const pad = (n: number) => String(n).padStart(2, '0');

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtCny(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}¥${Math.abs(n).toFixed(2)}`;
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function fmtNum(n: number | null, digits = 1): string {
  return n === null ? '—' : n.toFixed(digits);
}

export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDecimal(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fromLocalInput(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0).getTime();
}
