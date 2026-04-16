// Firebase init + Firestore cloud backup helpers.
//
// Cloud backup stores one document per authenticated user, keyed by the
// user's anonymous Firebase Auth UID. The document body is the encrypted
// .wig export (AES-GCM-256, already unreadable without the user's
// password or recovery code) — Firestore never sees plaintext.
//
// Requirement: Anonymous sign-in must be enabled for the Firebase
// project (Firebase Console → Authentication → Sign-in method →
// Anonymous → Enable). Without it, signInAnonymously() will fail.
//
// Scope: This protects one device's backup. Anonymous UIDs are tied to
// the browser/device that created them — restoring onto a fresh
// install uses the exported .wig file, not this cloud path.

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
import { exportEncryptedBlob, importEncryptedBlob } from './vault';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialise if config is present (dev may run without Firebase).
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

/**
 * Returns the current anonymous user, signing in if needed. The Firebase
 * SDK persists the anonymous session in IndexedDB, so this is a fast
 * no-op on subsequent calls.
 */
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

/** Push the locally-encrypted vault to Firestore, keyed by anon UID. */
export async function pushBackup(): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const user = await ensureAnonUser();
  const blob = await exportEncryptedBlob();
  const json = await blob.text();
  // Firestore max doc size is 1 MB. The encrypted journal should be well under.
  await setDoc(doc(db, 'vaults', user.uid), {
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
export async function pullBackup(opts: {
  confirmedReplace: boolean;
}): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const user = await ensureAnonUser();
  const snap = await getDoc(doc(db, 'vaults', user.uid));
  if (!snap.exists()) throw new Error('No backup found');
  const json = snap.data().data as string;
  await importEncryptedBlob(json, opts);
}

export function isFirebaseConfigured(): boolean {
  return db !== null;
}
