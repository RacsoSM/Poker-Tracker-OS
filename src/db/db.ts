import Dexie, { type Table } from 'dexie';
import type { Hand, Rank, SessionChunk, Settings, SizeClass, StoredImage } from '../domain/types';

export interface SettingsRow extends Settings { key: 'main' }
export interface StoredTemplate { id: string; rank: Rank; sizeClass: SizeClass; glyph: string }

export class PtDb extends Dexie {
  settings!: Table<SettingsRow, string>;
  chunks!: Table<SessionChunk, string>;
  hands!: Table<Hand, string>;
  images!: Table<StoredImage, string>;
  rankTemplates!: Table<StoredTemplate, string>;

  constructor(name = 'poker-tracker-os') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      chunks: 'id, startedAt',
      hands: 'id, &handId, playedAt, kind',
      images: 'id',
      rankTemplates: 'id, sizeClass',
    });
  }
}
