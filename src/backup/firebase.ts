// Firebase backend — used ONLY for anonymous cloud backup of the already-encrypted
// journal blob. The server never sees plaintext, and there is no cross-device read of
// individual fields. If the user never signs in, everything still works locally.
//
// Architecture: Auth (anonymous or email link) -> Firestore doc per user holding
// { blob: base64(ciphertext), wraps: {...}, updatedAt }. Nothing decryptable by Firebase.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { db as localDb } from '../storage/db';
import type { Bytes } from '../crypto';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let store: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return !!config.apiKey && !!config.projectId;
}

function ensureApp(): { auth: Auth; store: Firestore } {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.');
  }
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    store = getFirestore(app);
  }
  return { auth: auth!, store: store! };
}

export async function ensureAnonUser(): Promise<User> {
  const { auth } = ensureApp();
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub();
        resolve(user);
      }
    });
  });
}

// Base64 helpers — Firestore cannot store Uint8Array directly in a JSON doc.
function b64encode(u: Bytes): string {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

function b64decode(s: string): Bytes {
  const bin = atob(s);
  const u = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// Push a snapshot of local encrypted state to Firestore.
export async function pushBackup(): Promise<void> {
  const user = await ensureAnonUser();
  const { store } = ensureApp();
  const meta = await localDb.meta.get('meta');
  const journal = await localDb.journal.get('journal');
  if (!meta || !journal) throw new Error('Nothing to back up yet.');
  const payload = {
    schemaVersion: meta.schemaVersion,
    ownerDisplayName: meta.ownerDisplayName,
    pwSalt: b64encode(meta.pwSalt),
    pwIv: b64encode(meta.pwIv),
    pwWrapped: b64encode(meta.pwWrapped),
    rcSalt: b64encode(meta.rcSalt),
    rcIv: b64encode(meta.rcIv),
    rcWrapped: b64encode(meta.rcWrapped),
    journalBlob: b64encode(journal.blob),
    updatedAt: journal.updatedAt,
  };
  await setDoc(doc(store, 'backups', user.uid), payload, { merge: false });
}

// Pull a snapshot from Firestore into local IndexedDB (overwrites local).
export async function pullBackup(): Promise<boolean> {
  const user = await ensureAnonUser();
  const { store } = ensureApp();
  const snap = await getDoc(doc(store, 'backups', user.uid));
  if (!snap.exists()) return false;
  const d = snap.data();
  await localDb.meta.put({
    id: 'meta',
    ownerDisplayName: d.ownerDisplayName,
    createdAt: d.updatedAt,
    pwSalt: b64decode(d.pwSalt),
    pwIv: b64decode(d.pwIv),
    pwWrapped: b64decode(d.pwWrapped),
    rcSalt: b64decode(d.rcSalt),
    rcIv: b64decode(d.rcIv),
    rcWrapped: b64decode(d.rcWrapped),
    schemaVersion: d.schemaVersion,
  });
  await localDb.journal.put({
    id: 'journal',
    blob: b64decode(d.journalBlob),
    updatedAt: d.updatedAt,
  });
  return true;
}
