import { describe, expect, it } from 'vitest';
import { fmtCny, fmtDay, fmtDuration, fmtNum, fromLocalInput, parseDecimal, round2, toLocalInput } from './format';

describe('format', () => {
  it('redondea a centavos', () => {
    expect(round2(145.9640000001)).toBe(145.96);
    expect(round2(-0.005)).toBe(-0);
  });
  it('formatea yuanes con signo', () => {
    expect(fmtCny(-13)).toBe('-¥13.00');
    expect(fmtCny(191.1)).toBe('+¥191.10');
    expect(fmtCny(0)).toBe('¥0.00');
  });
  it('formatea duración HH:MM:SS', () => {
    expect(fmtDuration(133)).toBe('00:02:13');
    expect(fmtDuration(3930)).toBe('01:05:30');
    expect(fmtDuration(360000)).toBe('100:00:00');
  });
  it('formatea números opcionales y días', () => {
    expect(fmtNum(null)).toBe('—');
    expect(fmtNum(-36.111, 2)).toBe('-36.11');
    expect(fmtDay('2026-09-25')).toBe('25/09/2026');
  });
  it('parsea decimales no negativos', () => {
    expect(parseDecimal('28')).toBe(28);
    expect(parseDecimal('13,5')).toBe(13.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
  it('convierte a y desde datetime-local', () => {
    const ms = new Date(2026, 8, 25, 11, 0, 47).getTime();
    expect(toLocalInput(ms)).toBe('2026-09-25T11:00:47');
    expect(fromLocalInput('2026-09-25T11:00:47')).toBe(ms);
    expect(fromLocalInput('2026-09-25T11:00')).toBe(new Date(2026, 8, 25, 11, 0, 0).getTime());
    expect(fromLocalInput('')).toBeNull();
  });
});
