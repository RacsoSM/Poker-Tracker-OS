import type { Settings } from './types';

const WEEK = 7 * 86_400_000;

export function needsBackupReminder(settings: Settings, itemCount: number, now: number): boolean {
  if (itemCount === 0) return false;
  return settings.lastBackupAt === null || now - settings.lastBackupAt > WEEK;
}
