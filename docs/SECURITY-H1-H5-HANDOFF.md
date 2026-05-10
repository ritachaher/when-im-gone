# Security follow-ups — H1 & H5 (deferred from May 2026 audit)

Two findings from the May 2026 ISO 27001 audit are intentionally NOT
implemented on `main`. Both are real security wins, but both change
how vaults are encrypted or located. A bug in either one could lock
existing users (including you) out of their journals. They belong on
a feature branch with end-to-end manual testing before merge.

## H1 — Decouple cloud document ID from the recovery code

**Risk in current design.** Anyone who learns the recovery code can
both (a) decrypt the vault and (b) find the cloud blob. Because (a)
already implies game-over, the marginal risk from (b) is small —
mainly, it allows a targeted attacker to *verify* a guessed recovery
code against the live database without having a copy of the encrypted
blob.

**Recommended remediation.** Enable Firebase **App Check** instead of
restructuring the cloud ID. App Check requires every Firestore call to
carry an attestation token proving it came from the real app. With it
on, an attacker can't query the database from `curl`, a script, or a
spoofed client — knowing the cloud ID becomes useless without the
matching client.

The Firestore rules in `firestore.rules` already include an `appCheck()`
function stub that currently returns `true`. The flip is one line.

### How to enable App Check

1. Firebase Console → **App Check** → Register the web app
   - reCAPTCHA Enterprise (recommended) or reCAPTCHA v3
   - Copy the site key
2. In `src/storage/firebase.ts`, after `initializeApp(...)`:

   ```ts
   import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

   if (app && import.meta.env.VITE_APPCHECK_SITE_KEY) {
     initializeAppCheck(app, {
       provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY),
       isTokenAutoRefreshEnabled: true,
     });
   }
   ```

3. Add `VITE_APPCHECK_SITE_KEY` to `.env.example`, `.env.local`, and the
   GitHub Actions workflow secrets.
4. In `firestore.rules`, change the `appCheck()` function body from
   `return true;` to `return request.app != null;`.
5. Update CSP `connect-src` to include `https://www.recaptcha.net` and
   `https://recaptcha.google.com` (or the Enterprise endpoints).

### If a true H1 fix is wanted later

Generate a per-vault `cloudFindKey` (32 random bytes) at setup, store
it in `meta`, include it in the `.wig` export. Cloud ID becomes
`HMAC(recoveryCode, cloudFindKey)`. Pairing changes from "type the
recovery code" to "import the recovery file plus type the recovery
code". This is a real UX shift — pair-via-typing-only stops working,
which is a regression for users without the export file. Don't do this
until App Check has been live for a while and you understand whether
the remaining residual risk justifies the UX cost.

---

## H5 — Migrate KDF from PBKDF2-SHA256 (600k) to Argon2id

**Risk in current design.** PBKDF2-SHA256 with 600k iterations is the
current OWASP recommendation, but PBKDF2 is GPU-friendly. A motivated
attacker with a stolen device or stolen `.wig` file can rent cloud GPU
time and run dictionary attacks at ~10⁶+ guesses/sec. Argon2id is
memory-hard — it forces each guess to use ~64 MB of RAM, which kills
GPU parallelism and raises the cost-per-guess by 100×–1000×.

**Strategy.** Add Argon2id as a *new* wrap algorithm. Keep PBKDF2
unwrap forever (so old vaults and old `.wig` files still open). On
every successful unlock with a PBKDF2-wrapped key, transparently
re-wrap the data key with Argon2id and persist the new wrap. After a
few unlocks, virtually all live vaults are upgraded.

### Implementation skeleton

1. **Dependency.** `npm install argon2-browser` (≈200 KB WASM).
   Verify CSP `script-src 'self'` is sufficient — argon2-browser ships
   the WASM as a separate file.

2. **Type changes** in `src/crypto/index.ts`:

   ```ts
   export type KdfId = 'pbkdf2-sha256-600k' | 'argon2id-v1';

   export type WrappedKey = {
     kdf?: KdfId;          // undefined === 'pbkdf2-sha256-600k' (legacy)
     salt: Bytes;
     iv: Bytes;
     wrapped: Bytes;
     // Argon2id parameters — only set when kdf === 'argon2id-v1'.
     // Pinned at wrap time so future tweaks don't break old wraps.
     argonM?: number;      // memoryCost (KiB), e.g. 65536 (64 MiB)
     argonT?: number;      // timeCost (iterations), e.g. 3
     argonP?: number;      // parallelism, e.g. 1
   };
   ```

3. **Two derive paths.** Existing `deriveWrappingKey()` stays for
   PBKDF2. Add `deriveWrappingKeyArgon2id(password, salt, params)`
   using `argon2-browser`. Dispatch on `wrapped.kdf` in `unwrapDataKey`.

4. **Default new wraps to Argon2id.** `wrapDataKey()` always writes
   the new format. `wrapDataKey` callers in `vault.ts` (`create`,
   plus the new transparent re-wrap in `unlockWith`) get Argon2id wraps.

5. **Transparent re-wrap.** After a successful PBKDF2 unlock in
   `unlockWith()`, if `wrapped.kdf` is undefined, re-wrap with the
   same secret using Argon2id and update `db.meta`. Wrap silently;
   don't surface to the user.

6. **`.wig` import.** `importEncryptedBlob` already round-trips the
   wrap fields — just add `kdf` and the argon params to the
   `ExportPayload` schema (backwards-compatible: missing fields mean
   the legacy PBKDF2 wrap).

7. **Migration test.** Create a vault on `main`, dump IndexedDB,
   restore it on the H5 branch, unlock with the password, confirm
   the wrap in IndexedDB has been upgraded, lock, unlock again.

### Recommended Argon2id parameters

| Param         | Value         | Rationale |
|---            |---            |---        |
| `memoryCost`  | 65536 (64 MiB)| OWASP minimum for browser; bigger crashes mobile Safari |
| `timeCost`    | 3             | OWASP recommendation for the 64 MiB memory profile |
| `parallelism` | 1             | argon2-browser is single-threaded |

Re-benchmark on the slowest target device (an old Android phone) and
back off `memoryCost` if unlock takes more than ~2 seconds.

---

## Branch suggestion

```bash
git checkout -b security/h1-h5
# implement H5 first (it's more contained)
# implement H1 only if you've decided not to rely on App Check alone
git push -u origin security/h1-h5
# open a PR; do NOT merge until you've manually tested unlock on a
# vault created with the previous version
```

## Done criteria

- [ ] Old vault (created on `main`) opens on the branch with no error
      and the IndexedDB row shows the wrap has been upgraded.
- [ ] New vault (created on the branch) opens correctly after lock/unlock.
- [ ] `.wig` file exported from `main` imports cleanly on the branch.
- [ ] `.wig` file exported from the branch imports cleanly on `main`
      (forward compatibility — old code reads the new wrap by ignoring
      the new fields and falling back to PBKDF2 path; if it doesn't,
      bump the schema version and refuse the import with a clear error).
- [ ] All vitest tests pass (especially `vault-recovery.test.ts`).
