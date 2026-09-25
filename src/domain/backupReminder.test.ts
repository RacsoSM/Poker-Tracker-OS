import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { needsBackupReminder } from './backupReminder';

const DAY = 86_400_000;

describe('needsBackupReminder', () => {
  it('no avisa sin datos', () => {
    expect(needsBackupReminder(DEFAULT_SETTINGS, 0, 10 * DAY)).toBe(false);
  });
  it('avisa si nunca se exportó y hay datos', () => {
    expect(needsBackupReminder(DEFAULT_SETTINGS, 3, 10 * DAY)).toBe(true);
  });
  it('avisa pasados 7 días de la última copia', () => {
    const s = { ...DEFAULT_SETTINGS, lastBackupAt: 0 };
    expect(needsBackupReminder(s, 3, 7 * DAY)).toBe(false);
    expect(needsBackupReminder(s, 3, 7 * DAY + 1)).toBe(true);
  });
});
