// Firebase init + Firestore cloud backup helpers.
//
// Cloud backup stores one document per vault, keyed by a hash derived
// from the user's recovery code (see crypto/deriveVaultCloudId). This
// makes the cloud document "the same" across every device that holds
// the recovery code — that's what enables phone ↔ PC sync.
//
// The document body is the encrypted .wig export (AES-GCM-256,
// unreadable without the user's password or recovery code). Firestore
// never sees plaintext, and knowing the document ID already implies
// knowing the recovery code, so the ID itself functions as the
// capability check.
//
// Requirement: Anonymous sign-in must be enabled for the Firebase
// project (Firebase Console → Authentication → Sign-in method →
// Anonymous). We still sign in anonymously so Firestore has a per-
// client rate-limit anchor against drive-by spam, even though the ID
// is the real access control.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { deriveVaultCloudId } from '../crypto';
import {
  exportEncryptedBlob,
  getVaultCloudId,
  importEncryptedBlob,
} from './vault';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

async function ensureAnonUser(): Promise<User> {
  if (!auth) throw new Error('Firebase not configured');
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth!,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        }
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}

export type BackupStatus = 'idle' | 'pushing' | 'pulling' | 'done' | 'error';

/**
 * Push the locally-encrypted vault to Firestore, keyed by the vault
 * cloud ID stored in meta. Any device holding the same recovery code
 * will compute the same ID and therefore read/write the same doc.
 */
export async function pushBackup(): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const vaultCloudId = await getVaultCloudId();
  if (!vaultCloudId) {
    throw new Error(
      'Cloud ID missing. Unlock once with the recovery code to initialise it.',
    );
  }
  await ensureAnonUser();
  const blob = await exportEncryptedBlob();
  const json = await blob.text();
  await setDoc(doc(db, 'vaults', vaultCloudId), {
    data: json,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Pull the encrypted vault belonging to this device's recovery code
 * and import it locally. DESTRUCTIVE: overwrites the local journal.
 *
 * Caller must pass `{ confirmedReplace: true }` after showing a two-
 * step confirmation dialog; otherwise the underlying import refuses.
 */
export async function pullBackup(opts: {
  confirmedReplace: boolean;
}): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const vaultCloudId = await getVaultCloudId();
  if (!vaultCloudId) throw new Error('Cloud ID missing.');
  await ensureAnonUser();
  const snap = await getDoc(doc(db, 'vaults', vaultCloudId));
  if (!snap.exists()) throw new Error('No backup found');
  const json = snap.data().data as string;
  await importEncryptedBlob(json, opts);
}

/**
 * Pairing flow for a second device: given a recovery code typed into a
 * fresh install, derive the cloud ID, pull the encrypted blob, and
 * import it locally. The caller then needs to unlock with the same
 * recovery code to land in the Owner view.
 *
 * Returns true on success, false if no cloud backup exists for that
 * code (so the UI can tell the user "we didn't find a journal").
 */
export async function pairViaRecoveryCode(
  recoveryCode: string,
): Promise<boolean> {
  if (!db) throw new Error('Firebase not configured');
  const vaultCloudId = await deriveVaultCloudId(recoveryCode);
  await ensureAnonUser();
  const snap = await getDoc(doc(db, 'vaults', vaultCloudId));
  if (!snap.exists()) return false;
  const json = snap.data().data as string;
  await importEncryptedBlob(json, { confirmedReplace: true });
  return true;
}

export function isFirebaseConfigured(): boolean {
  return db !== null;
}
