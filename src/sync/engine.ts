import type { OutboxRow, PtDb, SyncKind } from '../db/db';
import type { Hand, SessionChunk } from '../domain/types';
import type { Remote } from './remote';

export interface SyncResult { pushed: number; pulled: number }
/** Cuánto lleva la sync. En la bajada `total` es 0 si la nube no supo decir cuánto falta. */
export interface SyncProgress { phase: 'push' | 'pull'; done: number; total: number }
export type OnProgress = (p: SyncProgress) => void;

const PAGE = 200;
const BATCH = 50;
/** Cuántas capturas se suben o bajan a la vez: una a una, cada ida y vuelta a la nube se suma y la sync tarda minutos. */
const PARALLEL = 6;

/** Como `Promise.all(items.map(fn))`, pero con como mucho `limit` llamadas en vuelo. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

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

async function push(db: PtDb, remote: Remote, uid: string, onProgress?: OnProgress): Promise<number> {
  const queued = await db.outbox.orderBy('seq').toArray();
  if (!queued.length) return 0;
  // Si un mismo registro cambió varias veces, solo importa el último cambio.
  const latest = new Map<string, OutboxRow>();
  const seqs = new Map<string, number[]>();
  for (const row of queued) {
    const key = `${row.kind}:${row.id}`;
    latest.set(key, row);
    seqs.set(key, [...(seqs.get(key) ?? []), row.seq!]);
  }

  // Se sube por tandas y cada tanda sale de la cola al terminar: si la sync se corta, la siguiente sigue donde iba.
  const entries = [...latest.values()];
  let pushed = 0;
  let done = 0;
  const report = () => onProgress?.({ phase: 'push', done, total: entries.length });
  report();
  const toRow = async (entry: OutboxRow): Promise<Parameters<Remote['putRecords']>[0][number] | null> => {
    if (entry.op === 'delete') {
      return { kind: entry.kind, id: entry.id, json: JSON.stringify({ imageId: entry.imageId ?? null }), deleted: true };
    }
    const local = await loadLocal(db, entry.kind, entry.id);
    if (!local) return null; // ya no existe: su borrado va en una entrada posterior
    if (local.imageId && !(await metaGet(db, `uploaded:${uid}:${local.imageId}`))) {
      const img = await db.images.get(local.imageId);
      if (img) {
        await remote.putImage(img.id, { bytes: img.bytes, mime: img.mime, width: img.width, height: img.height });
        await metaSet(db, `uploaded:${uid}:${img.id}`, '1');
      }
    }
    return { kind: entry.kind, id: entry.id, json: JSON.stringify(local.record), deleted: false };
  };
  for (let i = 0; i < entries.length; i += BATCH) {
    const group = entries.slice(i, i + BATCH);
    const rows = await mapLimit(group, PARALLEL, (entry) => toRow(entry).finally(() => {
      done++;
      report();
    }));
    const ready = rows.filter((r) => r !== null);
    if (ready.length) await remote.putRecords(ready);
    const deletedImages = group.filter((e) => e.op === 'delete' && e.imageId).map((e) => e.imageId!);
    await mapLimit(deletedImages, PARALLEL, (imageId) => remote.deleteImage(imageId));
    await db.outbox.bulkDelete(group.flatMap((e) => seqs.get(`${e.kind}:${e.id}`)!));
    pushed += ready.length;
  }
  return pushed;
}

export async function pull(db: PtDb, remote: Remote, uid: string, onProgress?: OnProgress): Promise<number> {
  const cursorKey = `cursor:${uid}`;
  let cursor = (await metaGet(db, cursorKey)) ?? null;
  let applied = 0;
  // Las capturas son lo lento: dentro de cada página el avance se mide por las que ya bajaron.
  const total = onProgress ? ((await remote.countRecords?.(cursor).catch(() => null)) ?? 0) : 0;
  let seen = 0;
  const report = (done: number) => onProgress?.({ phase: 'pull', done, total: total && Math.max(total, done) });
  for (;;) {
    const page = await remote.pullRecords(cursor, PAGE);
    if (!page.length) break;
    report(seen);

    const pending = new Set((await db.outbox.toArray()).map((r) => `${r.kind}:${r.id}`));
    const incoming = page.filter((r) => !pending.has(`${r.kind}:${r.id}`)); // un cambio local aún sin subir manda sobre la nube
    const wanted = new Set<string>();
    for (const r of incoming) {
      if (r.deleted || (r.kind !== 'chunk' && r.kind !== 'hand')) continue;
      const { imageId } = JSON.parse(r.json) as SessionChunk | Hand;
      if (imageId && !(await db.images.get(imageId))) wanted.add(imageId);
    }
    const ids = [...wanted];
    let got = 0;
    const fetched = await mapLimit(ids, PARALLEL, (id) => remote.getImage(id).finally(() => report(seen + Math.floor((page.length * ++got) / ids.length))));
    const images = new Map(ids.map((id, i) => [id, fetched[i]]));

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
        if (value.imageId) {
          const img = images.get(value.imageId);
          if (img) await db.images.put({ ...img, id: value.imageId });
          if (!img && !(await db.images.get(value.imageId))) continue; // la captura aún no llegó; se reintenta en la próxima sync
        }
        if (r.kind === 'chunk') await db.chunks.put(value);
        else {
          const clash = await db.hands.where('handId').equals(value.handId).first();
          if (!clash || clash.id === value.id) await db.hands.put(value);
        }
      }
    });
    applied += incoming.length;
    seen += page.length;
    report(seen);
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
  if (row.imageId) await db.images.delete(row.imageId);
}

export async function syncOnce(db: PtDb, remote: Remote, uid: string, onProgress?: OnProgress): Promise<SyncResult> {
  await queueExistingData(db, uid);
  const pushed = await push(db, remote, uid, onProgress);
  const pulled = await pull(db, remote, uid, onProgress);
  return { pushed, pulled };
}
