import type { OutboxRow, PtDb, SyncKind } from '../db/db';
import type { Hand, SessionChunk } from '../domain/types';
import type { Remote } from './remote';

export interface SyncResult { pushed: number; pulled: number }

const PAGE = 200;
const BATCH = 50;

const metaGet = async (db: PtDb, key: string) => (await db.syncMeta.get(key))?.value;
const metaSet = (db: PtDb, key: string, value: string) => db.syncMeta.put({ key, value });

/** La primera vez que una cuenta se conecta en este dispositivo, todo lo que ya hay en local se sube. */
async function queueExistingData(db: PtDb, uid: string): Promise<void> {
  const flag = `initial:${uid}`;
  if (await metaGet(db, flag)) return;
  const rows: OutboxRow[] = [];
  for (const id of await db.chunks.toCollection().primaryKeys()) rows.push({ kind: 'chunk', id, op: 'put' });
  for (const id of await db.hands.toCollection().primaryKeys()) rows.push({ kind: 'hand', id, op: 'put' });
  for (const id of await db.rankTemplates.toCollection().primaryKeys()) rows.push({ kind: 'template', id, op: 'put' });
  if (await db.settings.get('main')) rows.push({ kind: 'settings', id: 'main', op: 'put' });
  await db.transaction('rw', db.outbox, db.syncMeta, async () => {
    await db.outbox.bulkAdd(rows);
    await metaSet(db, flag, '1');
  });
}

async function loadLocal(db: PtDb, kind: SyncKind, id: string): Promise<{ record: unknown; imageId?: string } | undefined> {
  switch (kind) {
    case 'chunk': {
      const c = await db.chunks.get(id);
      return c && { record: c, imageId: c.imageId };
    }
    case 'hand': {
      const h = await db.hands.get(id);
      return h && { record: h, imageId: h.imageId };
    }
    case 'template': {
      const t = await db.rankTemplates.get(id);
      return t && { record: t };
    }
    case 'settings': {
      const row = await db.settings.get('main');
      if (!row) return undefined;
      const { key: _key, ...settings } = row;
      return { record: settings };
    }
  }
}

async function push(db: PtDb, remote: Remote, uid: string): Promise<number> {
  const queued = await db.outbox.orderBy('seq').toArray();
  if (!queued.length) return 0;
  // Si un mismo registro cambió varias veces, solo importa el último cambio.
  const latest = new Map<string, OutboxRow>();
  for (const row of queued) latest.set(`${row.kind}:${row.id}`, row);

  const rows: Parameters<Remote['putRecords']>[0] = [];
  const deletedImages: string[] = [];
  for (const entry of latest.values()) {
    if (entry.op === 'delete') {
      rows.push({ kind: entry.kind, id: entry.id, json: JSON.stringify({ imageId: entry.imageId ?? null }), deleted: true });
      if (entry.imageId) deletedImages.push(entry.imageId);
      continue;
    }
    const local = await loadLocal(db, entry.kind, entry.id);
    if (!local) continue; // ya no existe: su borrado va en una entrada posterior
    if (local.imageId && !(await metaGet(db, `uploaded:${uid}:${local.imageId}`))) {
      const img = await db.images.get(local.imageId);
      if (img) {
        await remote.putImage(img.id, { bytes: img.bytes, mime: img.mime, width: img.width, height: img.height });
        await metaSet(db, `uploaded:${uid}:${img.id}`, '1');
      }
    }
    rows.push({ kind: entry.kind, id: entry.id, json: JSON.stringify(local.record), deleted: false });
  }
  for (let i = 0; i < rows.length; i += BATCH) await remote.putRecords(rows.slice(i, i + BATCH));
  for (const imageId of deletedImages) await remote.deleteImage(imageId);
  await db.outbox.bulkDelete(queued.map((r) => r.seq!));
  return rows.length;
}

export async function pull(db: PtDb, remote: Remote, uid: string): Promise<number> {
  const cursorKey = `cursor:${uid}`;
  let cursor = (await metaGet(db, cursorKey)) ?? null;
  let applied = 0;
  for (;;) {
    const page = await remote.pullRecords(cursor, PAGE);
    if (!page.length) break;

    const pending = new Set((await db.outbox.toArray()).map((r) => `${r.kind}:${r.id}`));
    const incoming = page.filter((r) => !pending.has(`${r.kind}:${r.id}`)); // un cambio local aún sin subir manda sobre la nube
    const images = new Map<string, Awaited<ReturnType<Remote['getImage']>>>();
    for (const r of incoming) {
      if (r.deleted || (r.kind !== 'chunk' && r.kind !== 'hand')) continue;
      const { imageId } = JSON.parse(r.json) as SessionChunk | Hand;
      if (!imageId || images.has(imageId) || (await db.images.get(imageId))) continue;
      images.set(imageId, await remote.getImage(imageId));
    }

    await db.applyRemote([db.settings, db.chunks, db.hands, db.images, db.rankTemplates], async () => {
      for (const r of incoming) {
        const value = JSON.parse(r.json);
        if (r.deleted) {
          if (r.kind === 'chunk') await removeWithImage(db, db.chunks, r.id);
          else if (r.kind === 'hand') await removeWithImage(db, db.hands, r.id);
          else if (r.kind === 'template') await db.rankTemplates.delete(r.id);
          continue;
        }
        if (r.kind === 'settings') {
          await db.settings.put({ ...value, key: 'main' });
          continue;
        }
        if (r.kind === 'template') {
          await db.rankTemplates.put(value);
          continue;
        }
        const img = images.get(value.imageId);
        if (img) await db.images.put({ ...img, id: value.imageId });
        if (!img && !(await db.images.get(value.imageId))) continue; // la captura aún no llegó; se reintenta en la próxima sync
        if (r.kind === 'chunk') await db.chunks.put(value);
        else {
          const clash = await db.hands.where('handId').equals(value.handId).first();
          if (!clash || clash.id === value.id) await db.hands.put(value);
        }
      }
    });
    applied += incoming.length;
    cursor = page[page.length - 1].cursor;
    await metaSet(db, cursorKey, cursor);
    if (page.length < PAGE) break;
  }
  return applied;
}

async function removeWithImage(db: PtDb, table: PtDb['chunks'] | PtDb['hands'], id: string) {
  const row = await table.get(id);
  if (!row) return;
  await table.delete(id);
  await db.images.delete(row.imageId);
}

export async function syncOnce(db: PtDb, remote: Remote, uid: string): Promise<SyncResult> {
  await queueExistingData(db, uid);
  const pushed = await push(db, remote, uid);
  const pulled = await pull(db, remote, uid);
  return { pushed, pulled };
}
