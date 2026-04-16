import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { unlockWithPassword, unlockWithRecovery, useVault } from '../storage/vault';
import { SECTIONS, findSection, type SectionDef } from './sections';
import { SCHEMAS, type Card, type Field } from './schema';

export function Survivor({ onBack }: { onBack: () => void }) {
  const unlocked = useVault((s) => s.unlocked);
  if (!unlocked) return <SurvivorUnlock onBack={onBack} />;
  return <SurvivorHome onBack={onBack} />;
}

function SurvivorUnlock({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'pw' | 'rc'>('rc');
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
      // Expected failure: WebCrypto's OperationError when the AES-GCM
      // auth tag doesn't validate (i.e. wrong password/code). Anything
      // else is an infrastructure problem the survivor shouldn't be
      // blamed for — show a different message.
      console.error('Unlock failed:', e);
      const name =
        e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
      if (name === 'OperationError') {
        setErr(
          mode === 'pw'
            ? 'That password doesn\u2019t match.'
            : 'That recovery code doesn\u2019t match.',
        );
      } else {
        setErr(
          'Something went wrong opening the journal. Please try again.',
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
        <h1>Welcome</h1>
        <p className="muted">
          A loved one left this information for you.<br />
          Please enter the code from the sealed envelope, or the password you were told.
        </p>
        {mode === 'pw' ? (
          <>
            <label>Password</label>
            <input
              type="password"
              className="setup-input unlock-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        ) : (
          <>
            <label>Unlock code</label>
            <input
              className="setup-input unlock-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        )}
        {err && <p style={{ color: 'var(--accent-dark)' }}>{err}</p>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={submit}>
          {busy ? 'Unlocking\u2026' : 'Unlock'}
        </button>
        <button className="btn ghost" onClick={() => { setMode(mode === 'pw' ? 'rc' : 'pw'); setValue(''); setErr(null); }}>
          {mode === 'pw' ? 'I have an unlock code instead' : 'I have a password instead'}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          This information is read-only.
        </p>
        <button className="btn ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

type Triage = 'hours' | 'week' | 'month' | 'later';

function SurvivorHome({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const journal = useVault((s) => s.journal);
  const ownerName = useVault((s) => s.ownerDisplayName);
  const [open, setOpen] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Triage, SectionDef[]> = { hours: [], week: [], month: [], later: [] };
    for (const s of SECTIONS) g[s.triage].push(s);
    return g;
  }, []);

  if (!journal) return null;
  const lastUpdated = new Date(journal.updatedAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  if (open) {
    return (
      <div className="survivor-shell">
        <button className="sv-back" onClick={() => setOpen(null)}>&larr; {t('back', 'Back')}</button>
        <SurvivorDetail slug={open} />
      </div>
    );
  }

  return (
    <div className="survivor-shell">
      <div className="sv-header">
        <div>
          <h1>{t('survivor_header', '{{name}}\'s journal', { name: ownerName })}</h1>
          <p>{t('survivor_header_date', 'Last updated {{date}} · Read-only view', { date: lastUpdated })}</p>
        </div>
      </div>

      <h2 style={{ marginBottom: 14 }}>{t('where_to_start', 'Where to start')}</h2>
      <div className="triage">
        <TriageCard urgency={t('first_hours', 'First few hours')} title={t('triage_people_title', 'People to tell')} bullets={[t('triage_people_1', 'Family, close friends'), t('triage_people_2', 'Employer, key contacts'), t('triage_people_3', 'Funeral director')]} onOpen={() => setOpen('contacts')} />
        <TriageCard urgency={t('first_week', 'First week')} title={t('triage_funeral_title', 'Funeral wishes')} bullets={[t('triage_funeral_1', 'Burial / cremation choice'), t('triage_funeral_2', 'Readings, music'), t('triage_funeral_3', 'Dress code')]} onOpen={() => setOpen('funeral')} />
        <TriageCard urgency={t('first_month', 'First month')} title={t('triage_money_title', 'Money & paperwork')} bullets={[t('triage_money_1', 'Will & solicitor'), t('triage_money_2', 'Bank accounts (where to look)'), t('triage_money_3', 'Life insurance & pension')]} onOpen={() => setOpen('financial')} />
      </div>

      <h2 style={{ margin: '28px 0 10px' }}>{t('browse_everything', 'Browse everything')}</h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
        {t('browse_hint', 'Each section is a set of pointers — where to find things, not passwords or balances.')}
      </p>

      <div className="sv-sections">
        {SECTIONS.map((s) => (
          <div key={s.slug} className="sv-sec" onClick={() => setOpen(s.slug)}>
            <div className="nm">{t(`sec_${s.slug}_title`, s.title)}</div>
            <div className="dc">{t(`sec_${s.slug}_hint`, s.hint)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <button className="btn ghost" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t('lock_exit_btn', 'Lock & exit')}
        </button>
      </div>
      {void grouped /* reserved for future grouping UI */}
    </div>
  );
}

function TriageCard({
  urgency, title, bullets, onOpen,
}: { urgency: string; title: string; bullets: string[]; onOpen: () => void }) {
  return (
    <div className="triage-card">
      <div className="urg">{urgency}</div>
      <h3>{title}</h3>
      <ul>
        {bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
      <div className="btnrow">
        <button className="btn ghost" onClick={onOpen}>Open &rarr;</button>
      </div>
    </div>
  );
}

function SurvivorDetail({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const journal = useVault((s) => s.journal);
  const section = findSection(slug);
  const schema = SCHEMAS[slug];
  const data = journal?.sections[slug];

  return (
    <>
      <h1>{t(`sec_${slug}_title`, section.title)}</h1>
      <p className="muted">{schema ? t(`sch_${slug}_intro`, schema.intro) : t(`sec_${slug}_hint`, section.hint)}</p>
      <div style={{ height: 14 }} />

      {!schema ? (
        <div className="stub">
          <em>{t(`sec_${slug}_title`, section.title)}</em>
          {t('sv_section_not_filled', 'This section hasn\'t been filled in yet.')}
        </div>
      ) : (
        <>
          {schema.rootCallout && (
            <div className={`callout ${schema.rootCallout.type === 'accent' ? '' : schema.rootCallout.type}`}>
              {t(`sch_${slug}_callout`, schema.rootCallout.text)}
            </div>
          )}
          {schema.cards.map((card, i) => (
            <ReadOnlyCard key={i} slug={slug} cardIndex={i} card={card} data={data} />
          ))}
        </>
      )}
    </>
  );
}

function ReadOnlyCard({
  slug,
  cardIndex,
  card,
  data,
}: {
  slug: string;
  cardIndex: number;
  card: Card;
  data: { fields: Record<string, unknown>; items?: Record<string, unknown[]> } | undefined;
}) {
  const { t } = useTranslation();
  if (card.kind === 'single') {
    const cardTitle = t(`sch_${slug}_c${cardIndex}_title`, card.title);
    return (
      <div className="card">
        <h3>{cardTitle}</h3>
        {card.fields.map((f) => (
          <ReadOnlyRow key={f.id} slug={slug} field={f} value={data?.fields[f.id]} />
        ))}
      </div>
    );
  }
  const cardTitle = t(`sch_${slug}_c${cardIndex}_title`, card.title);
  const list = (data?.items?.[card.listId] as Record<string, unknown>[]) ?? [];
  return (
    <div className="card">
      <h3>{cardTitle}</h3>
      {list.length === 0 && <p className="muted" style={{ fontStyle: 'italic' }}>{t('none_added', '(none added)')}</p>}
      {list.map((item, idx) => (
        <div key={(item.id as string) ?? idx} style={{ marginBottom: 16 }}>
          {card.fields.map((f) => (
            <ReadOnlyRow key={f.id} slug={slug} field={f} value={item[f.id]} />
          ))}
          {idx < list.length - 1 && <hr style={{ border: 0, borderTop: '1px solid var(--cream-dark)' }} />}
        </div>
      ))}
    </div>
  );
}

function ReadOnlyRow({ slug, field, value }: { slug: string; field: Field; value: unknown }) {
  const { t } = useTranslation();
  const s = (value as string | undefined) ?? '';
  const empty = s.trim() === '';
  const fieldLabel = t(`sch_${slug}_f_${field.id}_label`, field.label);
  return (
    <div className="sv-row">
      <div className="k">{fieldLabel}</div>
      <div className={`v ${empty ? 'empty' : ''}`}>{empty ? t('not_filled', '(not filled in)') : s}</div>
    </div>
  );
}
