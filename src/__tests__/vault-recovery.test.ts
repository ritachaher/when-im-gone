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

import {
  create,
  exportEncryptedBlob,
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
});
