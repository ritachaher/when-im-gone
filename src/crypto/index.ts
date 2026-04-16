// WebCrypto wrapper — PBKDF2 (SHA-256, 600k) + AES-GCM-256.
// Ported from the v0 single-file prototype. Keep the algorithm constants here
// so a future migration to Argon2id touches only this module.

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

// TS 5.7 narrowed Uint8Array's generic to require an explicit backing type.
// We standardise on Uint8Array<ArrayBuffer> throughout so WebCrypto accepts them as BufferSource.
export type Bytes = Uint8Array<ArrayBuffer>;

export type WrappedKey = {
  salt: Bytes;
  iv: Bytes;
  wrapped: Bytes;
};

export function randomBytes(n: number): Bytes {
  const u = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(u);
  return u;
}

function toBytes(buf: ArrayBuffer): Bytes {
  return new Uint8Array(buf);
}

async function deriveWrappingKey(password: string, salt: Bytes): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    toBytes(enc.encode(password).buffer as ArrayBuffer),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function wrapDataKey(dataKey: CryptoKey, password: string): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrappingKey = await deriveWrappingKey(password, salt);
  const wrapped = toBytes(
    await crypto.subtle.wrapKey('jwk', dataKey, wrappingKey, { name: 'AES-GCM', iv }),
  );
  return { salt, iv, wrapped };
}

export async function unwrapDataKey(wrapped: WrappedKey, password: string): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(password, wrapped.salt);
  return crypto.subtle.unwrapKey(
    'jwk',
    wrapped.wrapped,
    wrappingKey,
    { name: 'AES-GCM', iv: wrapped.iv },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(dataKey: CryptoKey, value: unknown): Promise<Bytes> {
  const iv = randomBytes(IV_BYTES);
  const plaintext = toBytes(enc.encode(JSON.stringify(value)).buffer as ArrayBuffer);
  const ct = toBytes(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dataKey, plaintext),
  );
  const out = new Uint8Array(new ArrayBuffer(iv.length + ct.length));
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

export async function decryptJSON<T = unknown>(dataKey: CryptoKey, blob: Bytes): Promise<T> {
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dataKey, ct);
  return JSON.parse(dec.decode(pt));
}

// Recovery code: 12 chars, Crockford-ish alphabet (no 0/O/1/I), grouped XXXX-XXXX-XXXX.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode(): string {
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += ALPHA[bytes[i] % ALPHA.length];
    if (i === 3 || i === 7) out += '-';
  }
  return out;
}

export function normaliseRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Derives a stable hex identifier from a recovery code. Used as the
 * Firestore document ID for the cloud vault so every device that holds
 * the same recovery code converges on the same cloud document (enabling
 * phone ↔ PC sync).
 *
 * Threat model: anyone holding the recovery code can already decrypt
 * the journal, so gating the cloud document by "know the recovery code"
 * adds no weakness — it's precisely the right level. The context prefix
 * prevents the hash from being confused with any other hash of the same
 * input (e.g. the wrap-key derivation path).
 *
 * Entropy: the 12-character code has ~60 bits of entropy (2^60 ≈ 1e18).
 * Brute-force enumeration of the ID space is infeasible.
 */
export async function deriveVaultCloudId(recoveryCode: string): Promise<string> {
  const normalised = normaliseRecoveryCode(recoveryCode);
  const input = new TextEncoder().encode(
    `when-im-gone:cloud-id:v1:${normalised}`,
  );
  const hash = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
