# When I'm gone

A calm, private place to gather what your loved ones will need — based on the book of the same name.

## Architecture

- **Frontend:** Vite + React + TypeScript PWA
- **Storage:** IndexedDB (via Dexie), AES-GCM-256 encrypted, key never leaves the device
- **Backup:** Firebase Auth (anonymous) + Firestore — stores only the encrypted blob
- **Hosting:** Azure Static Web Apps
- **CI/CD:** GitHub Actions

The server can never read journal contents. Firestore sees ciphertext only; the user's password / recovery code is the only way to decrypt.

## Repo layout

```
src/
  crypto/      WebCrypto wrapper (PBKDF2 + AES-GCM)
  storage/     Dexie schema + high-level vault API
  backup/      Firebase anonymous backup
  ui/          React screens (Setup / Lock / Owner / Survivor)
staticwebapp.config.json  Azure SWA routing + CSP
firestore.rules           Per-user doc access rules
.github/workflows/        Azure SWA deploy on push to main
```

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in Firebase values (optional for local dev)
npm run dev
```

Without Firebase env vars the app runs fully local — cloud backup is simply disabled.

## First-time cloud setup

1. **GitHub** — push this repo to a new GitHub repo.
2. **Firebase** — create a project at https://console.firebase.google.com, enable Anonymous Auth and Firestore. Deploy `firestore.rules`. Copy the web config into `.env.local`.
3. **Azure Static Web Apps** — in the Azure portal create a Static Web App, point it at the GitHub repo, build preset "Custom", output `dist`. Azure will add `AZURE_STATIC_WEB_APPS_API_TOKEN` as a repo secret.
4. Add the six `VITE_FIREBASE_*` values as GitHub repo secrets so the Actions build has them.

## Security model (short version)

- Master password derives a wrapping key via PBKDF2-SHA256, 600k iterations.
- Recovery code (12 chars, Crockford alphabet) derives an independent wrapping key.
- A single AES-256 data key is generated on setup and wrapped twice — either unlock path recovers it.
- Journal JSON is encrypted with AES-GCM; ciphertext is what's stored locally and in the cloud.
- No password / PIN / full account number is ever stored — the journal is **pointers, not a vault** (see spec `When-Im-gone-spec.docx`).

## Roadmap

- [ ] Port the four rich section schemas (About me, Financial, Digital, Funeral) from v0
- [ ] Add the remaining 14 section schemas
- [ ] Attachment support (encrypted on-device)
- [ ] Rotate recovery code without re-encrypting data
- [ ] Mobile wrappers (Capacitor)
