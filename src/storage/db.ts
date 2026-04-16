// Dexie IndexedDB wrapper. We store three things:
//   meta      — setup info (owner display name, pwWrap, rcWrap, createdAt)
//   journal   — single encrypted blob of the entire journal JSON
//   audit     — append-only log of unlock/export events (encrypted)
//
// All blobs are AES-GCM encrypted; the key never touches storage.

import Dexie, { type Table } from 'dexie';
import type { Bytes } from '../crypto';

export type MetaRow = {
  id: 'meta';
  ownerDisplayName: string;
  createdAt: number;
  // Wrapped keys — two independent wraps of the same AES data key
  pwSalt: Bytes;
  pwIv: Bytes;
  pwWrapped: Bytes;
  rcSalt: Bytes;
  rcIv: Bytes;
  rcWrapped: Bytes;
  schemaVersion: number;
};

export type BlobRow = {
  id: 'journal';
  blob: Bytes;
  updatedAt: number;
};

export type AuditRow = {
  id?: number;
  blob: Bytes; // encrypted event record
  at: number;
};

class WhenImGoneDB extends Dexie {
  meta!: Table<MetaRow, string>;
  journal!: Table<BlobRow, string>;
  audit!: Table<AuditRow, number>;

  constructor() {
    super('whenimgone');
    this.version(1).stores({
      meta: 'id',
      journal: 'id',
      audit: '++id, at',
    });
  }
}

export const db = new WhenImGoneDB();

export async function wipeLocal(): Promise<void> {
  await db.delete();
}
