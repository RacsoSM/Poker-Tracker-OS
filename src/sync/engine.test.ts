import { describe, expect, it } from 'vitest';
import { PtDb } from '../db/db';
import { addChunk, addHand, deleteChunk, saveSettings, updateHand } from '../db/repo';
import { DEFAULT_SETTINGS, type HandValues } from '../domain/types';
import { pull, syncOnce } from './engine';
import type { Remote, RemoteImage, RemoteRecord } from './remote';

function memoryRemote(): Remote & { records: RemoteRecord[]; images: Map<string, RemoteImage> } {
  const records: RemoteRecord[] = [];
  const images = new Map<string, RemoteImage>();
  let clock = 0;
  return {
    records,
    images,
    async putRecords(rows) {
      for (const r of rows) {
        const i = records.findIndex((x) => x.kind === r.kind && x.id === r.id);
        const next = { ...r, cursor: String(++clock).padStart(8, '0') };
        if (i >= 0) records[i] = next;
        else records.push(next);
      }
    },
    async pullRecords(after, limit) {
      return records.filter((r) => !after || r.cursor > after).sort((a, b) => a.cursor.localeCompare(b.cursor)).slice(0, limit);
    },
    async putImage(id, img) { images.set(id, img); },
    async getImage(id) { return images.get(id) ?? null; },
    async deleteImage(id) { images.delete(id); },
  };
}

const newDb = () => new PtDb(`test-${crypto.randomUUID()}`);
const IMG = { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png', width: 1, height: 1 };
const CHUNK = { startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes };
const HAND: HandValues = {
  handId: '1323539300829384704', playedAt: new Date(2026, 8, 25, 11, 0, 47).getTime(), heroPosition: 'HJ',
  heroCards: [{ rank: 'A', suit: 'd' }, { rank: '8', suit: 'c' }], board: [], heroResultCny: -28, kind: 'study', tags: [],
};

describe('sync', () => {
  it('lo que subes en un dispositivo aparece en el otro, con su captura', async () => {
    const remote = memoryRemote();
    const phone = newDb();
    const pc = newDb();
    const chunk = await addChunk(phone, CHUNK, IMG);
    const hand = await addHand(phone, HAND, IMG);

    expect(await syncOnce(phone, remote, 'u1')).toMatchObject({ pushed: 2 });
    await syncOnce(pc, remote, 'u1');

    expect((await pc.chunks.get(chunk.id))?.resultCny).toBe(-13);
    expect((await pc.hands.get(hand.id))?.handId).toBe(HAND.handId);
    expect((await pc.images.get(chunk.imageId))?.bytes).toEqual(IMG.bytes);
  });

  it('propaga ediciones y borrados, y borra también la captura de la nube', async () => {
    const remote = memoryRemote();
    const phone = newDb();
    const pc = newDb();
    const chunk = await addChunk(phone, CHUNK, IMG);
    const hand = await addHand(phone, HAND, IMG);
    await syncOnce(phone, remote, 'u1');
    await syncOnce(pc, remote, 'u1');

    await updateHand(phone, hand.id, { ...HAND, note: 'editada' });
    await deleteChunk(phone, chunk.id);
    await syncOnce(phone, remote, 'u1');
    await syncOnce(pc, remote, 'u1');

    expect((await pc.hands.get(hand.id))?.note).toBe('editada');
    expect(await pc.chunks.get(chunk.id)).toBeUndefined();
    expect(await pc.images.get(chunk.imageId)).toBeUndefined();
    expect(remote.images.has(chunk.imageId)).toBe(false);
  });

  it('lo que llega de la nube no se vuelve a subir', async () => {
    const remote = memoryRemote();
    const phone = newDb();
    const pc = newDb();
    await addChunk(phone, CHUNK, IMG);
    await syncOnce(phone, remote, 'u1');
    await syncOnce(pc, remote, 'u1');
    expect(await pc.outbox.count()).toBe(0);
    expect((await syncOnce(pc, remote, 'u1')).pushed).toBe(0);
  });

  it('un cambio local sin subir no lo pisa lo que llega de la nube', async () => {
    const remote = memoryRemote();
    const phone = newDb();
    const pc = newDb();
    const hand = await addHand(phone, HAND, IMG);
    await syncOnce(phone, remote, 'u1');
    await syncOnce(pc, remote, 'u1');

    await updateHand(phone, hand.id, { ...HAND, note: 'del celular' });
    await syncOnce(phone, remote, 'u1');
    await updateHand(pc, hand.id, { ...HAND, note: 'de la PC' }); // aún sin subir
    expect(await pull(pc, remote, 'u1')).toBe(0); // la mano con cambio pendiente se ignora

    expect((await pc.hands.get(hand.id))?.note).toBe('de la PC');
    await syncOnce(pc, remote, 'u1'); // al subir, el último en escribir gana
    await syncOnce(phone, remote, 'u1');
    expect((await phone.hands.get(hand.id))?.note).toBe('de la PC');
  });

  it('sincroniza los ajustes y sube los datos que ya existían antes de iniciar sesión', async () => {
    const remote = memoryRemote();
    const phone = newDb();
    const pc = newDb();
    await saveSettings(phone, { ...DEFAULT_SETTINGS, heroName: 'Otro' });
    await syncOnce(phone, remote, 'u1');
    await syncOnce(pc, remote, 'u1');
    expect((await pc.settings.get('main'))?.heroName).toBe('Otro');
  });
});
