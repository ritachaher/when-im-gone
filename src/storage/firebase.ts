// Firebase init + Firestore cloud backup helpers.
//
// Cloud backup stores one document per vault, keyed by a hash derived
// from the user's recovery code (see crypto/deriveVaultCloudId). This
// makes the cloud document "the same" across every device that holds
// the recovery code - that's what enables phone ↔ PC sync.
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
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
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
  recordCloudPush,
  recordCloudPull,
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
  // App Check (May 2026 audit, H1 remediation): every Firestore call
  // carries an attestation that it came from the real app, so knowing a
  // vault's cloud ID is useless from curl/scripts. Activates only when
  // VITE_APPCHECK_SITE_KEY is set; after enabling it in the Firebase
  // console, also flip appCheck() in firestore.rules to
  // `request.app != null` and add the reCAPTCHA endpoints to the CSP.
  if (import.meta.env.VITE_APPCHECK_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
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
  await recordCloudPush();
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
  await recordCloudPull();
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
  opts: { confirmedReplace: boolean },
): Promise<boolean> {
  if (!db) throw new Error('Firebase not configured');
  const vaultCloudId = await deriveVaultCloudId(recoveryCode);
  await ensureAnonUser();
  const snap = await getDoc(doc(db, 'vaults', vaultCloudId));
  if (!snap.exists()) return false;
  const json = snap.data().data as string;
  // The destructive-replace confirmation is the CALLER's responsibility:
  // pass the flag through rather than hard-coding it here, so any future
  // "re-pair"/"sync" button can't silently overwrite a local journal.
  await importEncryptedBlob(json, opts);
  return true;
}

export function isFirebaseConfigured(): boolean {
  return db !== null;
}

/**
 * Optionally store an email address in the subscribers collection.
 * Purely a marketing opt-in; the user must explicitly choose to submit
 * and there is always a visible Skip option in the UI.
 *
 * Honesty note: WE store no link between the email and any vault - the
 * document carries only email/timestamp/source. But the write is made
 * from the same anonymous Firebase session used for vault pushes, so
 * Google-side request logs could in principle correlate the two. Don't
 * describe this as "unlinked in any way" in user-facing copy - say
 * "we do not store any link".
 *
 * Does nothing silently if Firebase is not configured.
 */
export async function subscribeEmail(email: string): Promise<void> {
  if (!db) return;
  await ensureAnonUser();
  await addDoc(collection(db, 'subscribers'), {
    email: email.trim().toLowerCase(),
    subscribedAt: serverTimestamp(),
    source: 'setup',
  });
}
