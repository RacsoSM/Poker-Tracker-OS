import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type HandValues } from '../domain/types';
import { PtDb } from './db';
import {
  addChunk, addHand, addTemplates, deleteChunk, deleteHand, DuplicateHandError, findHandByHandId, findSimilarChunk,
  getSettings, loadTemplates, saveSettings, updateHand,
} from './repo';

const newDb = () => new PtDb(`test-${crypto.randomUUID()}`);
const IMG = { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png', width: 1, height: 1 };
const CHUNK = { startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes };
const HAND: HandValues = {
  handId: '1323539300829384704', playedAt: new Date(2026, 8, 25, 11, 0, 47).getTime(), heroPosition: 'HJ',
  heroCards: [{ rank: 'A', suit: 'd' }, { rank: '8', suit: 'c' }], board: [], heroResultCny: -28, kind: 'study', tags: [],
};

describe('repo', () => {
  it('devuelve los ajustes por defecto y los guarda', async () => {
    const db = newDb();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(db, { ...DEFAULT_SETTINGS, heroName: 'Otro' });
    expect((await getSettings(db)).heroName).toBe('Otro');
  });

  it('guarda un tramo con su imagen y lo borra junto con ella', async () => {
    const db = newDb();
    const c = await addChunk(db, CHUNK, IMG);
    expect(await db.images.get(c.imageId!)).toMatchObject({ mime: 'image/png' });
    await deleteChunk(db, c.id);
    expect(await db.chunks.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
  });

  it('guarda y borra una mano manual, sin captura', async () => {
    const db = newDb();
    const h = await addHand(db, HAND);
    expect(h.imageId).toBeUndefined();
    expect(await db.hands.get(h.id)).toMatchObject({ handId: HAND.handId });
    expect(await db.images.count()).toBe(0);
    await deleteHand(db, h.id);
    expect(await db.hands.count()).toBe(0);
  });

  it('guarda y borra un tramo manual, sin captura', async () => {
    const db = newDb();
    const c = await addChunk(db, CHUNK);
    expect(c.imageId).toBeUndefined();
    expect(await db.chunks.get(c.id)).toMatchObject({ resultCny: -13, hands: 18 });
    expect(await db.images.count()).toBe(0);
    await deleteChunk(db, c.id);
    expect(await db.chunks.count()).toBe(0);
  });

  it('detecta un tramo igual el mismo día de juego', async () => {
    const db = newDb();
    await addChunk(db, CHUNK, IMG);
    expect(await findSimilarChunk(db, { ...CHUNK, startedAt: CHUNK.startedAt + 3_600_000 }, 6)).toBeDefined();
    expect(await findSimilarChunk(db, { ...CHUNK, hands: 19 }, 6)).toBeUndefined();
  });

  it('bloquea manos duplicadas por handId', async () => {
    const db = newDb();
    const h = await addHand(db, HAND, IMG);
    expect((await findHandByHandId(db, HAND.handId))?.id).toBe(h.id);
    await expect(addHand(db, HAND, IMG)).rejects.toBeInstanceOf(DuplicateHandError);
    const other = await addHand(db, { ...HAND, handId: '999' }, IMG);
    await expect(updateHand(db, other.id, { ...HAND })).rejects.toBeInstanceOf(DuplicateHandError);
    await updateHand(db, other.id, { ...HAND, handId: '999', note: 'revisar' });
    expect((await db.hands.get(other.id))?.note).toBe('revisar');
  });

  it('combina semillas y plantillas aprendidas', async () => {
    const db = newDb();
    const before = (await loadTemplates(db)).length;
    await addTemplates(db, [{ rank: 'J', sizeClass: 'board', glyph: '0'.repeat(384) }]);
    const all = await loadTemplates(db);
    expect(all).toHaveLength(before + 1);
    expect(all.at(-1)).toMatchObject({ rank: 'J', sizeClass: 'board' });
  });
});
