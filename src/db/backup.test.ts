import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type HandValues } from '../domain/types';
import { BackupError, exportBackup, importBackup } from './backup';
import { PtDb } from './db';
import { addChunk, addHand, addTemplates, saveSettings } from './repo';

const newDb = () => new PtDb(`test-${crypto.randomUUID()}`);
const IMG = { bytes: new Uint8Array([9, 8, 7]), mime: 'image/png', width: 1, height: 1 };
const HAND: HandValues = {
  handId: 'H1', playedAt: 1, heroPosition: 'BTN', heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [],
  heroResultCny: -156.1, kind: 'allin', allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 }, tags: ['cooler'],
};

async function seeded() {
  const db = newDb();
  await saveSettings(db, { ...DEFAULT_SETTINGS, heroName: 'RacsoSM', lastBackupAt: 5 });
  await addChunk(db, { startedAt: 10, resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes }, IMG);
  await addHand(db, HAND, IMG);
  await addTemplates(db, [{ rank: 'J', sizeClass: 'hole', glyph: '1'.repeat(384) }]);
  return db;
}

describe('backup', () => {
  it('exporta e importa (reemplazar) con resultado idÃ©ntico', async () => {
    const src = await seeded();
    const zip = await exportBackup(src, 123);
    expect(Object.keys(unzipSync(zip))).toContain('data.json');
    const dst = newDb();
    await addChunk(dst, { startedAt: 99, resultCny: 1, hands: 1, durationSec: 1, stakes: DEFAULT_SETTINGS.stakes }, IMG);
    expect(await importBackup(dst, zip, 'replace')).toEqual({ chunks: 1, hands: 1 });
    expect(await dst.chunks.toArray()).toEqual(await src.chunks.toArray());
    expect(await dst.hands.toArray()).toEqual(await src.hands.toArray());
    expect(await dst.images.toArray()).toEqual(await src.images.toArray());
    expect(await dst.rankTemplates.toArray()).toEqual(await src.rankTemplates.toArray());
    expect((await dst.settings.get('main'))?.heroName).toBe('RacsoSM');
  });

  it('fusiona sin duplicar manos por handId', async () => {
    const src = await seeded();
    const zip = await exportBackup(src);
    const dst = newDb();
    await addHand(dst, HAND, IMG);
    expect(await importBackup(dst, zip, 'merge')).toEqual({ chunks: 1, hands: 0 });
    expect(await dst.hands.count()).toBe(1);
    expect(await dst.chunks.count()).toBe(1);
  });

  it('rechaza archivos corruptos sin tocar los datos', async () => {
    const dst = await seeded();
    await expect(importBackup(dst, new Uint8Array([1, 2, 3]), 'replace')).rejects.toBeInstanceOf(BackupError);
    await expect(importBackup(dst, zipSync({ 'data.json': strToU8('{"schemaVersion":99}') }), 'replace')).rejects.toBeInstanceOf(BackupError);
    expect(await dst.chunks.count()).toBe(1);
  });

  it('rechaza copias con imÃ¡genes faltantes', async () => {
    const src = await seeded();
    const entries = unzipSync(await exportBackup(src));
    const broken = Object.fromEntries(Object.entries(entries).filter(([k]) => !k.startsWith('images/')));
    await expect(importBackup(newDb(), zipSync(broken), 'replace')).rejects.toThrow(/Falta la imagen/);
  });
});
