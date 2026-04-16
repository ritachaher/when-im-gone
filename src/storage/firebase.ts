// Firebase init + Firestore cloud backup helpers.
// The encrypted blob (already AES-GCM-256 encrypted locally) is stored as a
// single Firestore document keyed by a hash derived from the export payload.
// No plaintext ever leaves the device.

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { exportEncryptedBlob, importEncryptedBlob } from './vault';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialise if config is present (dev may run without Firebase)
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

/** Derive a stable, non-reversible document ID from the export JSON.
 *  We hash the pwSalt field so the Firestore doc ID is deterministic per vault. */
async function vaultDocId(json: string): Promise<string> {
  const enc = new TextEncoder().encode(json.slice(0, 200));
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type BackupStatus = 'idle' | 'pushing' | 'pulling' | 'done' | 'error';

/** Push the locally-encrypted vault to Firestore. */
export async function pushBackup(): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const blob = await exportEncryptedBlob();
  const json = await blob.text();
  const id = await vaultDocId(json);
  // Firestore max doc size is 1 MB. The encrypted journal should be well under.
  await setDoc(doc(db, 'vaults', id), {
    data: json,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Pull the encrypted vault from Firestore and import it locally.
 * DESTRUCTIVE: overwrites the local journal on this device.
 *
 * Caller must pass `{ confirmedReplace: true }` after showing a two-step
 * confirmation dialog; otherwise the underlying import refuses to run.
 */
export async function pullBackup(
  docId: string,
  opts: { confirmedReplace: boolean },
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const snap = await getDoc(doc(db, 'vaults', docId));
  if (!snap.exists()) throw new Error('No backup found');
  const json = snap.data().data as string;
  await importEncryptedBlob(json, opts);
}

/** Get the doc ID for the current vault (so we know where to pull from). */
export async function getVaultDocId(): Promise<string> {
  const blob = await exportEncryptedBlob();
  const json = await blob.text();
  return vaultDocId(json);
}

export function isFirebaseConfigured(): boolean {
  return db !== null;
}
