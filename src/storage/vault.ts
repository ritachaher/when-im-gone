// High-level journal API. Components should only touch vault, never db or crypto directly.

import { create as createZustand } from 'zustand';
import { db, wipeLocal } from './db';
import {
  decryptJSON,
  encryptJSON,
  generateDataKey,
  generateRecoveryCode,
  normaliseRecoveryCode,
  unwrapDataKey,
  wrapDataKey,
} from '../crypto';

export type RepeatingItem = { id: string } & Record<string, unknown>;

export type SectionData = {
  fields: Record<string, unknown>;
  items?: Record<string, RepeatingItem[]>;
  updatedAt: number;
};

export type Journal = {
  sections: Record<string, SectionData>;
  updatedAt: number;
  schemaVersion: number;
};

type VaultState = {
  unlocked: boolean;
  ownerDisplayName: string | null;
  journal: Journal | null;
  dataKey: CryptoKey | null;
};

export const useVault = createZustand<VaultState>(() => ({
  unlocked: false,
  ownerDisplayName: null,
  journal: null,
  dataKey: null,
}));

function emptyJournal(): Journal {
  return { sections: {}, updatedAt: Date.now(), schemaVersion: 1 };
}

export async function isInitialised(): Promise<boolean> {
  return !!(await db.meta.get('meta'));
}

export async function create(opts: {
  password: string;
  ownerDisplayName: string;
}): Promise<{ recoveryCode: string }> {
  if (await isInitialised()) throw new Error('Journal already exists on this device.');
  const dataKey = await generateDataKey();
  const recoveryCode = generateRecoveryCode();

  const pw = await wrapDataKey(dataKey, opts.password);
  const rc = await wrapDataKey(dataKey, normaliseRecoveryCode(recoveryCode));

  await db.meta.put({
    id: 'meta',
    ownerDisplayName: opts.ownerDisplayName,
    createdAt: Date.now(),
    pwSalt: pw.salt,
    pwIv: pw.iv,
    pwWrapped: pw.wrapped,
    rcSalt: rc.salt,
    rcIv: rc.iv,
    rcWrapped: rc.wrapped,
    schemaVersion: 1,
  });

  const journal = emptyJournal();
  const blob = await encryptJSON(dataKey, journal);
  await db.journal.put({ id: 'journal', blob, updatedAt: Date.now() });

  useVault.setState({
    unlocked: true,
    ownerDisplayName: opts.ownerDisplayName,
    journal,
    dataKey,
  });
  return { recoveryCode };
}

async function unlockWith(secret: string, which: 'pw' | 'rc'): Promise<void> {
  const meta = await db.meta.get('meta');
  if (!meta) throw new Error('No journal on this device yet.');
  const wrapped =
    which === 'pw'
      ? { salt: meta.pwSalt, iv: meta.pwIv, wrapped: meta.pwWrapped }
      : { salt: meta.rcSalt, iv: meta.rcIv, wrapped: meta.rcWrapped };
  const dataKey = await unwrapDataKey(wrapped, secret);

  const row = await db.journal.get('journal');
  const journal = row ? await decryptJSON<Journal>(dataKey, row.blob) : emptyJournal();

  useVault.setState({
    unlocked: true,
    ownerDisplayName: meta.ownerDisplayName,
    journal,
    dataKey,
  });
}

export async function unlockWithPassword(password: string): Promise<void> {
  await unlockWith(password, 'pw');
}

export async function unlockWithRecovery(code: string): Promise<void> {
  await unlockWith(normaliseRecoveryCode(code), 'rc');
}

export function lock(): void {
  useVault.setState({ unlocked: false, journal: null, dataKey: null });
}

export async function save(mutator: (draft: Journal) => void): Promise<void> {
  const { journal, dataKey } = useVault.getState();
  if (!journal || !dataKey) throw new Error('Vault is locked.');
  const next: Journal = { ...journal, sections: { ...journal.sections } };
  mutator(next);
  next.updatedAt = Date.now();
  const blob = await encryptJSON(dataKey, next);
  await db.journal.put({ id: 'journal', blob, updatedAt: next.updatedAt });
  useVault.setState({ journal: next });
}

export async function setSectionField(slug: string, fieldId: string, value: string): Promise<void> {
  await save((d) => {
    const existing = d.sections[slug] ?? { fields: {}, updatedAt: 0 };
    d.sections[slug] = {
      fields: { ...existing.fields, [fieldId]: value },
      items: existing.items,
      updatedAt: Date.now(),
    };
  });
}

export async function setSectionList(
  slug: string,
  listId: string,
  items: RepeatingItem[],
): Promise<void> {
  await save((d) => {
    const existing = d.sections[slug] ?? { fields: {}, updatedAt: 0 };
    d.sections[slug] = {
      fields: existing.fields,
      items: { ...(existing.items ?? {}), [listId]: items },
      updatedAt: Date.now(),
    };
  });
}

export async function wipe(): Promise<void> {
  lock();
  await wipeLocal();
}

// ===== Cloud push freshness =====
// Tracks when the user last clicked "Save a copy". The Owner view turns
// the button terracotta when it's been more than 2 days, so users notice
// their cloud backup is getting stale without a modal nag on close.

export async function getLastCloudPushAt(): Promise<number | null> {
  const meta = await db.meta.get('meta');
  return meta?.lastCloudPushAt ?? null;
}

export async function markCloudPushed(at: number = Date.now()): Promise<void> {
  const meta = await db.meta.get('meta');
  if (!meta) return;
  await db.meta.put({ ...meta, lastCloudPushAt: at });
}

// ===== Encrypted backup (.wig) =====
//
// Exports the IndexedDB contents to a self-contained blob. The recipient needs
// the password or recovery code to decrypt — nothing sensitive leaks.

type ExportPayload = {
  format: 'wig/1';
  ownerDisplayName: string;
  createdAt: number;
  schemaVersion: number;
  pwSalt: string;
  pwIv: string;
  pwWrapped: string;
  rcSalt: string;
  rcIv: string;
  rcWrapped: string;
  journalBlob: string;
  updatedAt: number;
};

function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export async function exportEncryptedBlob(): Promise<Blob> {
  const meta = await db.meta.get('meta');
  const journal = await db.journal.get('journal');
  if (!meta || !journal) throw new Error('Nothing to export yet.');
  const payload: ExportPayload = {
    format: 'wig/1',
    ownerDisplayName: meta.ownerDisplayName,
    createdAt: meta.createdAt,
    schemaVersion: meta.schemaVersion,
    pwSalt: b64(meta.pwSalt),
    pwIv: b64(meta.pwIv),
    pwWrapped: b64(meta.pwWrapped),
    rcSalt: b64(meta.rcSalt),
    rcIv: b64(meta.rcIv),
    rcWrapped: b64(meta.rcWrapped),
    journalBlob: b64(journal.blob),
    updatedAt: journal.updatedAt,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/octet-stream' });
}

/**
 * Replaces the local journal on this device with the contents of an
 * encrypted backup blob. This is destructive: anything the user has typed
 * on this device since the backup was taken will be gone.
 *
 * The caller MUST pass { confirmedReplace: true } to prove the user has
 * seen a two-step confirmation in the UI (see memory: two-step confirm
 * before any deletion). Without the flag, this function refuses to run.
 */
export async function importEncryptedBlob(
  text: string,
  opts: { confirmedReplace: boolean },
): Promise<void> {
  if (!opts?.confirmedReplace) {
    throw new Error(
      'importEncryptedBlob: refused. This replaces all local journal data; ' +
        'caller must pass { confirmedReplace: true } after user confirmation.',
    );
  }
  const payload = JSON.parse(text) as ExportPayload;
  if (payload.format !== 'wig/1') throw new Error('Unknown backup format.');
  await db.meta.put({
    id: 'meta',
    ownerDisplayName: payload.ownerDisplayName,
    createdAt: payload.createdAt,
    schemaVersion: payload.schemaVersion,
    pwSalt: unb64(payload.pwSalt),
    pwIv: unb64(payload.pwIv),
    pwWrapped: unb64(payload.pwWrapped),
    rcSalt: unb64(payload.rcSalt),
    rcIv: unb64(payload.rcIv),
    rcWrapped: unb64(payload.rcWrapped),
  });
  await db.journal.put({
    id: 'journal',
    blob: unb64(payload.journalBlob),
    updatedAt: payload.updatedAt,
  });
  lock();
}
