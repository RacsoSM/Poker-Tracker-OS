import type { SyncKind } from '../db/db';
import type { StoredImage } from '../domain/types';

export interface RemoteRecord { kind: SyncKind; id: string; json: string; deleted: boolean; cursor: string }
export type RemoteImage = Omit<StoredImage, 'id'>;

/** Lo que el motor de sincronización necesita de la nube. Firestore lo implementa; los tests usan una versión en memoria. */
export interface Remote {
  putRecords(rows: Pick<RemoteRecord, 'kind' | 'id' | 'json' | 'deleted'>[]): Promise<void>;
  /** Registros modificados después de `after` (null = desde el principio), del más viejo al más nuevo. */
  pullRecords(after: string | null, limit: number): Promise<RemoteRecord[]>;
  putImage(id: string, image: RemoteImage): Promise<void>;
  getImage(id: string): Promise<RemoteImage | null>;
  deleteImage(id: string): Promise<void>;
}
