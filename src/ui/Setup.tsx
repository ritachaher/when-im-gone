import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from '../storage/vault';

type Step = 'welcome' | 'name' | 'password' | 'recovery';

export function Setup({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const rules = {
    len: pw1.length >= 10,
    letter: /[A-Za-z]/.test(pw1),
    number: /\d/.test(pw1),
    mixed: /[A-Z]/.test(pw1) && /[a-z]/.test(pw1),
  };
  const allMet = rules.len && rules.letter && rules.number && rules.mixed;

  async function submit() {
    setErr(null);
    if (!allMet) return setErr(t('pw_error_requirements'));
    if (pw1 !== pw2) return setErr(t('pw_error_mismatch'));
    setBusy(true);
    try {
      const { recoveryCode } = await create({ password: pw1, ownerDisplayName: name });
      setRecoveryCode(recoveryCode);
      setStep('recovery');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centre welcome-bg">
      <div className="centre-card welcome-card stack">
        {step === 'welcome' && (
          <>
            <div className="welcome-hero">
              <div className="welcome-illus" aria-hidden>
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <circle cx="40" cy="40" r="38" fill="var(--page-alt)" />
                  <rect x="26" y="34" width="28" height="22" rx="3" fill="none" stroke="var(--navy-soft)" strokeWidth="2" />
                  <path d="M33 34V28a7 7 0 0 1 14 0v6" fill="none" stroke="var(--navy-soft)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="40" cy="45" r="2.5" fill="var(--navy)" />
                  <line x1="40" y1="47.5" x2="40" y2="51" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="eyebrow">{t('eyebrow')}</p>
              <h1>{t('app_name')}</h1>
              <p className="lede">{t('welcome_lede')}</p>
              <button className="btn btn-lg" onClick={() => setStep('name')}>
                {t('begin')}
              </button>
              <ul className="trust-row">
                <li>
                  <span className="ti" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                  {t('trust_device')}
                </li>
                <li>
                  <span className="ti" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </span>
                  {t('trust_encrypted')}
                </li>
                <li>
                  <span className="ti" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  {t('trust_loved')}
                </li>
              </ul>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <h2>{t('name_title')}</h2>
            <p className="muted">{t('name_hint')}</p>
            <input
              className="setup-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name_placeholder')}
              autoFocus
            />
            <div className="btnrow">
              <button className="btn ghost" onClick={() => setStep('welcome')}>{t('back')}</button>
              <button className="btn" disabled={!name.trim()} onClick={() => setStep('password')}>{t('next')}</button>
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <h2>{t('pw_title')}</h2>
            <p className="muted">{t('pw_hint')}</p>
            <label>{t('pw_label')}</label>
            <input className="setup-input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoFocus />
            <ul className="pw-rules">
              <li className={rules.len ? 'ok' : ''}>{rules.len ? '\u2713' : '\u2022'} {t('pw_rule_length')}</li>
              <li className={rules.mixed ? 'ok' : ''}>{rules.mixed ? '\u2713' : '\u2022'} {t('pw_rule_mixed')}</li>
              <li className={rules.number ? 'ok' : ''}>{rules.number ? '\u2713' : '\u2022'} {t('pw_rule_number')}</li>
            </ul>
            <label>{t('pw_confirm_label')}</label>
            <input className="setup-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            {pw2.length > 0 && pw1 !== pw2 && (
              <p className="pw-mismatch">{t('pw_mismatch')}</p>
            )}
            {err && <p className="pw-error">{err}</p>}
            <div className="btnrow">
              <button className="btn ghost" onClick={() => setStep('name')}>{t('back')}</button>
              <button className="btn" disabled={busy || !allMet || pw1 !== pw2} onClick={submit}>
                {busy ? t('setting_up') : t('create_journal')}
              </button>
            </div>
          </>
        )}

        {step === 'recovery' && recoveryCode && (
          <>
            <h2>{t('recovery_title')}</h2>
            <p className="muted">{t('recovery_hint')}</p>
            <div className="recovery-code">{recoveryCode}</div>
            <div className="btnrow">
              <button className="btn ghost" onClick={() => window.print()}>{t('print')}</button>
              <button className="btn" onClick={onDone}>{t('recovery_done')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
