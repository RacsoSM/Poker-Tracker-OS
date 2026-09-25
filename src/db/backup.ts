import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type { Hand, SessionChunk, StoredImage } from '../domain/types';
import type { PtDb, StoredTemplate } from './db';
import { getSettings } from './repo';

export const BACKUP_SCHEMA_VERSION = 1;

export class BackupError extends Error {}

const rankZ = z.enum(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
const cardZ = z.object({ rank: rankZ, suit: z.enum(['s', 'h', 'd', 'c']) });
const stakesZ = z.object({ sb: z.number(), bb: z.number().positive(), straddle: z.number(), gameType: z.literal('fast') });
const settingsZ = z.object({
  heroName: z.string(), stakes: stakesZ, currency: z.literal('CNY'),
  dayCutoffHour: z.number().int().min(0).max(23), lastBackupAt: z.number().nullable(),
});
const chunkZ = z.object({
  id: z.string(), startedAt: z.number(), resultCny: z.number(), hands: z.number().int().nonnegative(),
  durationSec: z.number().int().nonnegative(), stakes: stakesZ, imageId: z.string(), note: z.string().optional(), createdAt: z.number(),
});
const handZ = z.object({
  id: z.string(), handId: z.string(), playedAt: z.number(),
  heroPosition: z.enum(['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  heroCards: z.tuple([cardZ, cardZ]), board: z.array(cardZ).max(5), heroResultCny: z.number(),
  kind: z.enum(['allin', 'study']),
  allin: z.object({ street: z.enum(['preflop', 'flop', 'turn']), heroEquity: z.number().min(0).max(1), potContested: z.number(), heroInvested: z.number() }).optional(),
  tags: z.array(z.string()), note: z.string().optional(), imageId: z.string(), createdAt: z.number(),
});
const imageMetaZ = z.object({ id: z.string(), mime: z.string(), width: z.number(), height: z.number(), file: z.string() });
const templateZ = z.object({ id: z.string(), rank: rankZ, sizeClass: z.enum(['board', 'hole']), glyph: z.string().regex(/^[01]{384}$/) });
const backupZ = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION), exportedAt: z.number(), settings: settingsZ,
  chunks: z.array(chunkZ), hands: z.array(handZ), images: z.array(imageMetaZ), rankTemplates: z.array(templateZ),
});

export async function exportBackup(db: PtDb, now = Date.now()): Promise<Uint8Array> {
  const [settings, chunks, hands, images, rankTemplates] = await Promise.all([
    getSettings(db), db.chunks.toArray(), db.hands.toArray(), db.images.toArray(), db.rankTemplates.toArray(),
  ]);
  const files: Record<string, Uint8Array> = {};
  const imagesMeta = images.map((img) => {
    const file = `images/${img.id}`;
    files[file] = img.bytes;
    return { id: img.id, mime: img.mime, width: img.width, height: img.height, file };
  });
  const data = { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now, settings, chunks, hands, images: imagesMeta, rankTemplates };
  files['data.json'] = strToU8(JSON.stringify(data));
  return zipSync(files, { level: 0 });
}

export async function importBackup(db: PtDb, bytes: Uint8Array, mode: 'replace' | 'merge'): Promise<{ chunks: number; hands: number }> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupError('El archivo no es una copia vÃ¡lida (zip daÃ±ado).');
  }
  const raw = entries['data.json'];
  if (!raw) throw new BackupError('La copia no contiene data.json.');
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new BackupError('data.json estÃ¡ daÃ±ado.');
  }
  const parsed = backupZ.safeParse(json);
  if (!parsed.success) throw new BackupError('La copia no tiene el formato esperado.');
  const data = parsed.data;
  for (const m of data.images) if (!entries[m.file]) throw new BackupError(`Falta la imagen ${m.file} en la copia.`);
  const imageIds = new Set(data.images.map((i) => i.id));
  for (const item of [...data.chunks, ...data.hands]) {
    if (!imageIds.has(item.imageId)) throw new BackupError(`Falta la imagen ${item.imageId} en la copia.`);
  }

  const images: StoredImage[] = data.images.map((m) => ({ id: m.id, mime: m.mime, width: m.width, height: m.height, bytes: entries[m.file].slice() }));
  const chunks = data.chunks as SessionChunk[];
  const hands = data.hands as Hand[];
  const templates = data.rankTemplates as StoredTemplate[];
  let counts = { chunks: 0, hands: 0 };

  await db.transaction('rw', [db.settings, db.chunks, db.hands, db.images, db.rankTemplates], async () => {
    if (mode === 'replace') {
      await Promise.all([db.settings.clear(), db.chunks.clear(), db.hands.clear(), db.images.clear(), db.rankTemplates.clear()]);
      await db.settings.put({ ...data.settings, key: 'main' });
      await db.images.bulkAdd(images);
      await db.chunks.bulkAdd(chunks);
      await db.hands.bulkAdd(hands);
      await db.rankTemplates.bulkAdd(templates);
      counts = { chunks: chunks.length, hands: hands.length };
      return;
    }
    const chunkIds = new Set(await db.chunks.toCollection().primaryKeys());
    const handIds = new Set((await db.hands.toArray()).flatMap((h) => [h.id, h.handId]));
    const newChunks = chunks.filter((c) => !chunkIds.has(c.id));
    const newHands = hands.filter((h) => !handIds.has(h.id) && !handIds.has(h.handId));
    const needed = new Set([...newChunks, ...newHands].map((x) => x.imageId));
    const existingImages = new Set(await db.images.toCollection().primaryKeys());
    const templateIds = new Set(await db.rankTemplates.toCollection().primaryKeys());
    await db.images.bulkAdd(images.filter((i) => needed.has(i.id) && !existingImages.has(i.id)));
    await db.chunks.bulkAdd(newChunks);
    await db.hands.bulkAdd(newHands);
    await db.rankTemplates.bulkAdd(templates.filter((t) => !templateIds.has(t.id)));
    counts = { chunks: newChunks.length, hands: newHands.length };
  });
  return counts;
}
