import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { unlockWithPassword, unlockWithRecovery } from '../storage/vault';

export function Lock({ onSurvivor }: { onSurvivor: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'pw' | 'rc'>('pw');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'pw') await unlockWithPassword(value);
      else await unlockWithRecovery(value);
    } catch (e) {
      // Distinguish a wrong password/code (the expected, common failure)
      // from infrastructure errors (IndexedDB quota, corrupted store,
      // WebCrypto unavailable, etc). WebCrypto throws OperationError when
      // the AES-GCM auth tag fails — that's the wrong-secret signature.
      console.error('Unlock failed:', e);
      const name =
        e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
      const looksLikeWrongSecret = name === 'OperationError';
      if (looksLikeWrongSecret) {
        setErr(mode === 'pw' ? t('pw_wrong') : t('rc_wrong'));
      } else {
        setErr(
          t(
            'unlock_error_other',
            'Something went wrong opening the journal. Please try again, or reinstall the app if the problem continues.',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centre welcome-bg">
      <div className="centre-card welcome-card stack" style={{ textAlign: 'center' }}>
        <div className="lock-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1>{t('lock_title')}</h1>
        <p className="muted">{t('lock_hint')}</p>
        {mode === 'pw' ? (
          <>
            <label>{t('pw_label')}</label>
            <input
              type="password"
              className="setup-input unlock-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        ) : (
          <>
            <label>{t('unlock_code_label')}</label>
            <input
              className="setup-input unlock-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('unlock_code_placeholder')}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        )}
        {err && <p style={{ color: 'var(--accent-dark)' }}>{err}</p>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={submit}>
          {busy ? t('unlocking') : t('unlock')}
        </button>
        <button className="btn ghost" onClick={() => { setMode(mode === 'pw' ? 'rc' : 'pw'); setValue(''); setErr(null); }}>
          {mode === 'pw' ? t('use_recovery') : t('use_password')}
        </button>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />
        <button className="btn ghost" onClick={onSurvivor}>
          {t('im_loved_one')}
        </button>
      </div>
    </div>
  );
}
