import Dexie, { type Table, type Transaction } from 'dexie';
import type { Hand, Rank, SessionChunk, Settings, SizeClass, StoredImage } from '../domain/types';

export interface SettingsRow extends Settings { key: 'main' }
export interface StoredTemplate { id: string; rank: Rank; sizeClass: SizeClass; glyph: string }

export type SyncKind = 'chunk' | 'hand' | 'template' | 'settings';
/** Un cambio local pendiente de subir a la nube. `imageId` solo se guarda en los borrados, para poder borrar también la captura remota. */
export interface OutboxRow { seq?: number; kind: SyncKind; id: string; op: 'put' | 'delete'; imageId?: string }
export interface MetaRow { key: string; value: string }

export class PtDb extends Dexie {
  settings!: Table<SettingsRow, string>;
  chunks!: Table<SessionChunk, string>;
  hands!: Table<Hand, string>;
  images!: Table<StoredImage, string>;
  rankTemplates!: Table<StoredTemplate, string>;
  outbox!: Table<OutboxRow, number>;
  syncMeta!: Table<MetaRow, string>;

  private remoteTxs = new WeakSet<Transaction>();

  constructor(name = 'poker-tracker-os') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      chunks: 'id, startedAt',
      hands: 'id, &handId, playedAt, kind',
      images: 'id',
      rankTemplates: 'id, sizeClass',
    });
    this.version(2).stores({
      outbox: '++seq',
      syncMeta: 'key',
    });
    this.track(this.chunks, 'chunk', (c) => c.id, (c) => c.imageId);
    this.track(this.hands, 'hand', (h) => h.id, (h) => h.imageId);
    this.track(this.rankTemplates, 'template', (t) => t.id);
    this.track(this.settings, 'settings', () => 'main');
  }

  /** Aplica cambios que vienen de la nube sin que se anoten en la cola de subida. */
  applyRemote<T>(tables: Table[], fn: () => Promise<T>): Promise<T> {
    return this.transaction('rw', tables, async (tx) => {
      this.remoteTxs.add(tx);
      return fn();
    });
  }

  private track<T>(table: Table<T, string>, kind: SyncKind, idOf: (row: T) => string, imageOf?: (row: T) => string | undefined) {
    const enqueue = (tx: Transaction, row: OutboxRow) => {
      if (this.remoteTxs.has(tx)) return;
      // Se escribe cuando la transacción original ya terminó bien; así no hace falta incluir `outbox` en cada transacción.
      tx.on('complete', () => {
        void this.outbox.add(row);
      });
    };
    table.hook('creating', (_pk, obj, tx) => {
      enqueue(tx, { kind, id: idOf(obj), op: 'put' });
    });
    table.hook('updating', (_mods, _pk, obj, tx) => {
      enqueue(tx, { kind, id: idOf(obj), op: 'put' });
    });
    table.hook('deleting', (_pk, obj, tx) => {
      enqueue(tx, { kind, id: idOf(obj), op: 'delete', imageId: imageOf?.(obj) });
    });
  }
}
