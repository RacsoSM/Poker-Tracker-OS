import { playingDay } from '../domain/stats';
import { DEFAULT_SETTINGS, type Hand, type HandValues, type SessionChunk, type Settings, type StoredImage } from '../domain/types';
import { glyphFromString, type RankTemplate } from '../vision/glyph';
import { loadSeedTemplates } from '../vision/seeds';
import type { PtDb, StoredTemplate } from './db';

export type ChunkInput = Omit<SessionChunk, 'id' | 'createdAt' | 'imageId'>;
export type ImageInput = Omit<StoredImage, 'id'>;

export class DuplicateHandError extends Error {
  existingId: string;
  constructor(existingId: string) {
    super('Esta mano ya está guardada');
    this.existingId = existingId;
  }
}

const newId = () => crypto.randomUUID();

export async function getSettings(db: PtDb): Promise<Settings> {
  const row = await db.settings.get('main');
  if (!row) return DEFAULT_SETTINGS;
  return { heroName: row.heroName, stakes: row.stakes, currency: row.currency, dayCutoffHour: row.dayCutoffHour, lastBackupAt: row.lastBackupAt };
}

export async function saveSettings(db: PtDb, s: Settings): Promise<void> {
  await db.settings.put({ ...s, key: 'main' });
}

export async function addChunk(db: PtDb, chunk: ChunkInput, image: ImageInput): Promise<SessionChunk> {
  const imageId = newId();
  const saved: SessionChunk = { ...chunk, id: newId(), imageId, createdAt: Date.now() };
  await db.transaction('rw', db.chunks, db.images, async () => {
    await db.images.add({ ...image, id: imageId });
    await db.chunks.add(saved);
  });
  return saved;
}

export async function updateChunk(db: PtDb, id: string, patch: Partial<ChunkInput>): Promise<void> {
  await db.chunks.update(id, patch);
}

export async function deleteChunk(db: PtDb, id: string): Promise<void> {
  await db.transaction('rw', db.chunks, db.images, async () => {
    const c = await db.chunks.get(id);
    if (!c) return;
    await db.chunks.delete(id);
    await db.images.delete(c.imageId);
  });
}

export async function findSimilarChunk(
  db: PtDb,
  c: Pick<SessionChunk, 'startedAt' | 'resultCny' | 'hands' | 'durationSec'>,
  cutoffHour: number,
): Promise<SessionChunk | undefined> {
  const day = playingDay(c.startedAt, cutoffHour);
  const all = await db.chunks.toArray();
  return all.find(
    (x) => playingDay(x.startedAt, cutoffHour) === day && x.resultCny === c.resultCny && x.hands === c.hands && x.durationSec === c.durationSec,
  );
}

export async function findHandByHandId(db: PtDb, handId: string): Promise<Hand | undefined> {
  return db.hands.where('handId').equals(handId).first();
}

export async function addHand(db: PtDb, values: HandValues, image: ImageInput): Promise<Hand> {
  const imageId = newId();
  const saved: Hand = { ...values, id: newId(), imageId, createdAt: Date.now() };
  await db.transaction('rw', db.hands, db.images, async () => {
    const existing = await findHandByHandId(db, values.handId);
    if (existing) throw new DuplicateHandError(existing.id);
    await db.images.add({ ...image, id: imageId });
    await db.hands.add(saved);
  });
  return saved;
}

export async function updateHand(db: PtDb, id: string, values: HandValues): Promise<void> {
  await db.transaction('rw', db.hands, async () => {
    const current = await db.hands.get(id);
    if (!current) return;
    const clash = await findHandByHandId(db, values.handId);
    if (clash && clash.id !== id) throw new DuplicateHandError(clash.id);
    await db.hands.put({ ...current, ...values, allin: values.allin });
  });
}

export async function deleteHand(db: PtDb, id: string): Promise<void> {
  await db.transaction('rw', db.hands, db.images, async () => {
    const h = await db.hands.get(id);
    if (!h) return;
    await db.hands.delete(id);
    await db.images.delete(h.imageId);
  });
}

export async function addTemplates(db: PtDb, ts: Omit<StoredTemplate, 'id'>[]): Promise<void> {
  if (ts.length) await db.rankTemplates.bulkAdd(ts.map((t) => ({ ...t, id: newId() })));
}

export async function loadTemplates(db: PtDb): Promise<RankTemplate[]> {
  const stored = await db.rankTemplates.toArray();
  return [...loadSeedTemplates(), ...stored.map((t) => ({ rank: t.rank, sizeClass: t.sizeClass, glyph: glyphFromString(t.glyph) }))];
}
