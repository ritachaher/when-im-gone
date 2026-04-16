// The most important test in the project.
//
// "When I'm gone" only justifies its existence if the survivor can open
// the sealed envelope, type the recovery code, and see the owner's
// journal. This test simulates that end-to-end:
//
//   1. Owner creates a vault with a password, receives a recovery code.
//   2. Owner writes some data and exports the encrypted .wig blob.
//   3. We simulate a fresh device (wipe local state).
//   4. Survivor imports the blob on the "new device".
//   5. Survivor unlocks using only the recovery code.
//   6. The content the owner wrote must be intact.
//
// If this test fails, the product's entire premise is broken and no
// amount of UI polish matters. Keep it in the critical path of CI.

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { deriveVaultCloudId } from '../crypto';
import {
  create,
  exportEncryptedBlob,
  getVaultCloudId,
  importEncryptedBlob,
  lock,
  setSectionField,
  unlockWithPassword,
  unlockWithRecovery,
  useVault,
} from '../storage/vault';
import { db } from '../storage/db';

async function wipeEverything(): Promise<void> {
  await db.meta.clear();
  await db.journal.clear();
  await db.audit.clear();
  useVault.setState({
    unlocked: false,
    ownerDisplayName: null,
    journal: null,
    dataKey: null,
  });
}

describe('vault: recovery round trip', () => {
  beforeEach(wipeEverything);

  it('survivor can read owner content using the recovery code', async () => {
    const password = 'correct horse battery staple';

    // --- OWNER SIDE ---
    const { recoveryCode } = await create({
      password,
      ownerDisplayName: 'Eleanor',
    });
    expect(recoveryCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    await setSectionField('me', 'firstName', 'Eleanor');
    await setSectionField('me', 'surname', 'Hartley');
    await setSectionField('funeral', 'preference', 'Cremation');

    const exportedBlob = await exportEncryptedBlob();
    const exportedText = await exportedBlob.text();

    // --- SIMULATE FRESH DEVICE ---
    lock();
    await db.meta.clear();
    await db.journal.clear();

    // --- SURVIVOR SIDE ---
    await importEncryptedBlob(exportedText, { confirmedReplace: true });
    await unlockWithRecovery(recoveryCode);

    const state = useVault.getState();
    expect(state.unlocked).toBe(true);
    expect(state.ownerDisplayName).toBe('Eleanor');
    expect(state.journal?.sections.me?.fields.firstName).toBe('Eleanor');
    expect(state.journal?.sections.me?.fields.surname).toBe('Hartley');
    expect(state.journal?.sections.funeral?.fields.preference).toBe(
      'Cremation',
    );
  });

  it('owner can still unlock with their password after the round trip', async () => {
    const password = 'another-long-test-password-xyz';

    await create({ password, ownerDisplayName: 'Eleanor' });
    await setSectionField('me', 'firstName', 'Eleanor');
    const exportedText = await (await exportEncryptedBlob()).text();

    lock();
    await db.meta.clear();
    await db.journal.clear();

    await importEncryptedBlob(exportedText, { confirmedReplace: true });
    await unlockWithPassword(password);

    expect(useVault.getState().journal?.sections.me?.fields.firstName).toBe(
      'Eleanor',
    );
  });

  it('rejects a wrong recovery code with an OperationError', async () => {
    await create({ password: 'test-pw', ownerDisplayName: 'Eleanor' });

    await expect(unlockWithRecovery('WRONG-CODE-XXXX')).rejects.toMatchObject({
      name: 'OperationError',
    });
  });

  it('refuses to import a backup without confirmedReplace=true', async () => {
    await create({ password: 'test-pw', ownerDisplayName: 'Eleanor' });
    const exportedText = await (await exportEncryptedBlob()).text();

    // @ts-expect-error — intentionally omitting the required flag
    await expect(importEncryptedBlob(exportedText, {})).rejects.toThrow(
      /confirmedReplace/,
    );
  });

  // ---- Cross-device sync invariant ----
  // For phone ↔ PC sync to work, two devices holding the same recovery
  // code MUST compute the same vault cloud ID. If this ever diverges,
  // every synced user would silently see two disconnected journals.
  it('derives the same vault cloud ID on two devices holding the same recovery code', async () => {
    // Device A creates a vault and records its cloud ID in meta.
    const { recoveryCode } = await create({
      password: 'test-pw',
      ownerDisplayName: 'Eleanor',
    });
    const idOnDeviceA = await getVaultCloudId();
    expect(idOnDeviceA).not.toBeNull();
    expect(idOnDeviceA).toMatch(/^[0-9a-f]{64}$/);

    // Device B (fresh install, no local state) computes the cloud ID
    // from only the recovery code. This is what pairViaRecoveryCode
    // does in production.
    const idOnDeviceB = await deriveVaultCloudId(recoveryCode);
    expect(idOnDeviceB).toBe(idOnDeviceA);

    // Formatting variations (dashes, case, whitespace) must not matter.
    const stripped = recoveryCode.replace(/-/g, '');
    const lowercased = recoveryCode.toLowerCase();
    const spaced = recoveryCode.replace(/-/g, ' ');
    expect(await deriveVaultCloudId(stripped)).toBe(idOnDeviceA);
    expect(await deriveVaultCloudId(lowercased)).toBe(idOnDeviceA);
    expect(await deriveVaultCloudId(spaced)).toBe(idOnDeviceA);
  });

  it('different recovery codes derive different vault cloud IDs', async () => {
    const a = await deriveVaultCloudId('ABCD-EFGH-JKLM');
    const b = await deriveVaultCloudId('ABCD-EFGH-JKLN');
    expect(a).not.toBe(b);
  });

  it('backfills the vault cloud ID on unlock-with-recovery for pre-sync vaults', async () => {
    // Simulate an older vault created before cross-device sync: strip
    // the field out of meta after create().
    const { recoveryCode } = await create({
      password: 'test-pw',
      ownerDisplayName: 'Eleanor',
    });
    const meta = await db.meta.get('meta');
    expect(meta?.vaultCloudId).toBeDefined();
    // Remove the field and write back (as would an old install upgrading).
    const { vaultCloudId: _drop, ...metaWithoutCloudId } = meta!;
    void _drop;
    await db.meta.put(metaWithoutCloudId);
    expect((await db.meta.get('meta'))?.vaultCloudId).toBeUndefined();

    // Simulate the user locking and unlocking with the recovery code.
    lock();
    await unlockWithRecovery(recoveryCode);

    // The backfill should have run silently.
    const backfilled = await db.meta.get('meta');
    expect(backfilled?.vaultCloudId).toBeDefined();
    expect(backfilled?.vaultCloudId).toBe(await deriveVaultCloudId(recoveryCode));
  });
});
