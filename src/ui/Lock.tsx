import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { unlockWithPassword, unlockWithRecovery } from '../storage/vault';

// Exponential-backoff throttle for unlock attempts. Persisted in
// localStorage so an attacker can't bypass it with a page reload.
// PBKDF2-600k is slow but not infinite; combining it with backoff
// makes targeted brute-force impractical against a stolen device.
const FAIL_KEY = 'wig.unlock.fails';
const FAIL_AT_KEY = 'wig.unlock.fails.at';

function readFails(): { count: number; lastAt: number } {
  try {
    return {
      count: Number(localStorage.getItem(FAIL_KEY)) || 0,
      lastAt: Number(localStorage.getItem(FAIL_AT_KEY)) || 0,
    };
  } catch {
    return { count: 0, lastAt: 0 };
  }
}

function writeFails(count: number, at: number) {
  try {
    localStorage.setItem(FAIL_KEY, String(count));
    localStorage.setItem(FAIL_AT_KEY, String(at));
  } catch { /* ignore - private mode etc. */ }
}

function clearFails() {
  try { localStorage.removeItem(FAIL_KEY); localStorage.removeItem(FAIL_AT_KEY); } catch {}
}

// Returns ms to wait before the next attempt is allowed. After 3 free
// tries we add 2^(n-3) seconds, capped at 5 minutes.
function backoffMs(count: number): number {
  if (count < 3) return 0;
  const seconds = Math.min(300, Math.pow(2, count - 3));
  return seconds * 1000;
}

export function Lock({ onSurvivor }: { onSurvivor: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'pw' | 'rc'>('pw');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    // Throttle check - refuse if we're inside the cooldown window from
    // recent failures. The window grows exponentially after 3 attempts.
    const { count, lastAt } = readFails();
    const wait = backoffMs(count) - (Date.now() - lastAt);
    if (wait > 0) {
      const sec = Math.ceil(wait / 1000);
      setErr(
        t('unlock_throttled', 'Too many attempts. Please wait {{sec}} seconds before trying again.', { sec }),
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === 'pw') await unlockWithPassword(value);
      else await unlockWithRecovery(value);
      // Successful unlock - reset the failure counter so the next
      // device-locked-up event starts fresh.
      clearFails();
    } catch (e) {
      // Distinguish a wrong password/code (the expected, common failure)
      // from infrastructure errors (IndexedDB quota, corrupted store,
      // WebCrypto unavailable, etc). WebCrypto throws OperationError when
      // the AES-GCM auth tag fails - that's the wrong-secret signature.
      const name =
        e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
      // Log only the error class - never the exception object, which
      // can carry the attempted secret in some browser builds and would
      // leak into DevTools / screen recordings.
      console.error('Unlock failed:', name || 'unknown');
      const looksLikeWrongSecret = name === 'OperationError';
      if (looksLikeWrongSecret) {
        // Increment the failure counter so each wrong attempt extends
        // the backoff window. Only counts wrong-secret failures, not
        // infrastructure errors (those would punish honest users for
        // problems outside their control).
        const next = readFails().count + 1;
        writeFails(next, Date.now());
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
