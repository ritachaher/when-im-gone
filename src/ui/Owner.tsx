import { useEffect, useMemo, useState } from 'react';
import {
  getLastCloudPushAt,
  markCloudPushed,
  readAudit,
  setSectionComplete,
  setSectionField,
  setSectionList,
  useVault,
  wipe,
  type AuditEvent,
  type RepeatingItem,
} from '../storage/vault';
import { SECTIONS, findSection } from './sections';
import { SCHEMAS, countFilled, type Card } from './schema';
import { Callout, FieldInput } from './fields';
import { useTranslation } from 'react-i18next';
import { useTheme } from './useTheme';
import { ConfirmDialog } from './ConfirmDialog';
import { LANGUAGES, changeLanguage } from '../i18n';
import { pushBackup, isFirebaseConfigured, type BackupStatus } from '../storage/firebase';

export function Owner({ onLock }: { onLock: () => void }) {
  const { t, i18n } = useTranslation();
  const journal = useVault((s) => s.journal);
  const ownerName = useVault((s) => s.ownerDisplayName);
  const [active, setActive] = useState(SECTIONS[0].slug);
  const [navOpen, setNavOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (navOpen) document.body.classList.add('nav-open');
    else document.body.classList.remove('nav-open');
    return () => document.body.classList.remove('nav-open');
  }, [navOpen]);

  function pickSection(slug: string) {
    setActive(slug);
    setNavOpen(false);
  }

  const progress = useMemo(() => {
    if (!journal) return 0;
    let filled = 0;
    let total = 0;
    for (const s of SECTIONS) {
      const schema = SCHEMAS[s.slug];
      if (!schema) continue;
      const d = journal.sections[s.slug];
      const c = countFilled(schema, d?.fields, d?.items);
      filled += c.filled;
      total += c.total;
    }
    return total === 0 ? 0 : Math.round((filled / total) * 100);
  }, [journal]);

  // How many sections the owner has explicitly marked "done". Separate
  // from `progress` (which measures fields filled) so both bars can show.
  const sectionsDone = useMemo(() => {
    if (!journal) return 0;
    return SECTIONS.reduce(
      (n, s) => n + (journal.sections[s.slug]?.completed ? 1 : 0),
      0,
    );
  }, [journal]);
  const sectionsTotal = SECTIONS.length;
  const sectionsPct = sectionsTotal === 0 ? 0 : Math.round((sectionsDone / sectionsTotal) * 100);

  // NOTE: all hooks must run before any conditional return. `journal`
  // becomes null while this component is still mounted (e.g. lock()
  // during wipe), and an early return above a hook makes React throw
  // "Rendered fewer hooks than expected" - a white screen.
  const [confirmAction, setConfirmAction] = useState<null | 'wipe'>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const [cloudStatus, setCloudStatus] = useState<BackupStatus>('idle');
  const [lastCloudPushAt, setLastCloudPushAt] = useState<number | null>(null);
  // Audit log viewer state. Lazy-loaded only when the user opens the
  // panel - no point decrypting 50 records on every render.
  const [showAudit, setShowAudit] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[] | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  // Close the audit dialog on Escape (basic keyboard accessibility).
  useEffect(() => {
    if (!showAudit) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowAudit(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showAudit]);
  useEffect(() => {
    if (!showAudit) return;
    let cancelled = false;
    readAudit(50).then((evs) => { if (!cancelled) setAuditEvents(evs); });
    return () => { cancelled = true; };
  }, [showAudit]);

  // Load "last cloud push" timestamp on mount so we can decide whether
  // to nudge the user with a terracotta button.
  useEffect(() => {
    let cancelled = false;
    getLastCloudPushAt().then((t) => {
      if (!cancelled) setLastCloudPushAt(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Button goes terracotta if the journal has content AND either it's
  // never been pushed or the last push was more than 2 days ago.
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const isCloudStale =
    progress > 0 &&
    (lastCloudPushAt === null || Date.now() - lastCloudPushAt > TWO_DAYS_MS);

  if (!journal) return null;
  const section = findSection(active);
  const schema = SCHEMAS[section.slug];

  async function onCloudPush() {
    setCloudStatus('pushing');
    setCloudError(null);
    try {
      await pushBackup();
      const now = Date.now();
      await markCloudPushed(now);
      setLastCloudPushAt(now);
      setCloudStatus('done');
      setTimeout(() => setCloudStatus('idle'), 2500);
    } catch (e) {
      // Log only the error class - never the exception object - per the
      // codebase rule (nothing sensitive may reach DevTools logs).
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : 'unknown';
      console.error('Cloud push failed:', name);
      // Surface the one actionable failure specifically: a restored
      // vault that hasn't re-learned its cloud ID yet. The generic
      // "try again" message would leave the user stuck forever.
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Cloud ID missing')) {
        setCloudError(
          t(
            'cloud_error_no_id',
            'To turn cloud backup back on after a restore, lock the journal once and unlock it with your recovery code.',
          ),
        );
      }
      setCloudStatus('error');
      setTimeout(() => setCloudStatus('idle'), 6000);
    }
  }

  async function doWipe() {
    await wipe();
    location.reload();
  }

  return (
    <div className="owner-shell">
      {/* Mobile top bar - only visible ≤720px */}
      <div className="mobile-topbar">
        <button
          className="mt-hamburger"
          aria-label={t('open_menu', 'Open menu')}
          onClick={() => setNavOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="mt-brand">{t(`sec_${section.slug}_title`, section.title)}</div>
        <button
          className="mt-lock"
          aria-label={t('lock_journal', 'Lock')}
          onClick={onLock}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
      </div>

      <div
        className={`sidebar-backdrop${navOpen ? ' show' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar${navOpen ? ' open' : ''}`}>
        <button
          className="sidebar-close"
          aria-label={t('close_menu', 'Close menu')}
          onClick={() => setNavOpen(false)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
        <div className="brand">
          {t('app_name')}
          <small>{t('journal_label', { name: ownerName })}</small>
        </div>
        <div className="nav-overall">
          {t('complete_pct', { pct: progress })}
          <div className="progress">
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="nav-overall-sections">
            {t('sections_done', { done: sectionsDone, total: sectionsTotal })}
          </div>
          <div className="progress">
            <div style={{ width: `${sectionsPct}%` }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>{t('auto_saved')}</div>
        </div>
        <nav className="nav">
          <ul>
            {SECTIONS.map((s) => {
              const sch = SCHEMAS[s.slug];
              const d = journal.sections[s.slug];
              const done = !!d?.completed;
              // A manual "complete" tick always wins over the auto count,
              // so the dot goes green even if the owner left fields blank.
              const status: 'empty' | 'part' | 'done' = done
                ? 'done'
                : sch
                ? (() => {
                    const c = countFilled(sch, d?.fields, d?.items);
                    if (c.filled === 0) return 'empty';
                    if (c.filled >= c.total) return 'done';
                    return 'part';
                  })()
                : (d && (Object.keys(d.fields).length > 0 || (d.items && Object.keys(d.items).length > 0))
                    ? 'part'
                    : 'empty');
              const secTitle = t(`sec_${s.slug}_title`, s.title);
              return (
                <li key={s.slug} className="nav-item">
                  {/* button, not <a href-less>: keyboard-focusable and
                      announced correctly by screen readers */}
                  <button
                    type="button"
                    className={`nav-link${s.slug === active ? ' active' : ''}`}
                    aria-current={s.slug === active ? 'page' : undefined}
                    onClick={() => pickSection(s.slug)}
                  >
                    <span className={`dot ${status}`} />
                    <span>{secTitle}</span>
                  </button>
                  {/* Checkbox is a sibling of the button - never nested
                      inside it (invalid + unclickable interactive-in-button). */}
                  <label
                    className="nav-check"
                    title={done
                      ? t('mark_incomplete', 'Mark as not complete')
                      : t('mark_complete', 'Mark as complete')}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => setSectionComplete(s.slug, e.target.checked)}
                      aria-label={t('mark_section_complete', 'Mark "{{name}}" complete', { name: secTitle })}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="nav-footer">
          {isFirebaseConfigured() && (
            <div className="footer-action">
              <button
                className={isCloudStale ? 'cloud-stale' : undefined}
                onClick={onCloudPush}
                disabled={cloudStatus === 'pushing' || cloudStatus === 'pulling'}
              >
                {cloudStatus === 'pushing' ? t('cloud_pushing', 'Saving…') : t('cloud_push_btn', 'Save a copy')}
              </button>
              <span className="footer-hint">
                {isCloudStale
                  ? t('cloud_push_hint_stale', 'Your cloud copy is out of date - save now')
                  : t('cloud_push_hint', 'Keeps a safe backup in case this device is lost')}
              </span>
              {cloudStatus === 'done' && <span className="footer-hint" style={{ color: 'var(--ok)' }}>{t('cloud_done', '\u2713 Saved')}</span>}
              {cloudStatus === 'error' && (
                <span className="footer-hint" style={{ color: 'var(--danger)' }}>
                  {cloudError ?? t('cloud_error', 'Could not save - please try again')}
                </span>
              )}
            </div>
          )}
          <div className="footer-action">
            <button onClick={onLock}>{t('lock_journal', 'Lock')}</button>
            {/* Distinct key from the Lock screen's 'lock_hint' - reusing it
                showed "Unlock your journal to continue." here. */}
            <span className="footer-hint">{t('lock_footer_hint', 'Hides everything behind your password')}</span>
          </div>
          <div className="footer-action">
            <button onClick={() => setConfirmAction('wipe')}>{t('wipe_btn', 'Wipe everything')}</button>
            <span className="footer-hint">{t('wipe_hint', 'Permanently deletes all data on this device')}</span>
          </div>
          {/* Encrypted audit log - shows the user every time their
              journal has been unlocked, exported, or synced. Helps
              spot "who else has been in here". */}
          <div className="footer-action">
            <button onClick={() => setShowAudit(true)}>{t('audit_btn', 'Recent activity')}</button>
            <span className="footer-hint">{t('audit_hint', 'See unlocks, exports and cloud syncs')}</span>
          </div>
          <div className="footer-action">
            <a
              href="https://amzn.eu/d/02TZ0FVb"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link-btn"
            >
              {t('book_btn', 'Order the printed book')}
            </a>
            <span className="footer-hint">{t('book_hint', 'A paper companion you can keep on a shelf')}</span>
          </div>
          <div className="toggle-wrap">
            <button
              className={`toggle-track${theme === 'dark' ? ' on' : ''}`}
              onClick={toggleTheme}
              aria-label={theme === 'light' ? t('dark_mode') : t('light_mode')}
            />
            {theme === 'light' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            )}
            <span>{theme === 'light' ? t('dark_mode') : t('light_mode')}</span>
          </div>
          <select
            className="theme-toggle"
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            style={{ appearance: 'auto', cursor: 'pointer' }}
          >
            {LANGUAGES.map((l) => {
              // Tell users upfront if they'll see English fallback text.
              // Suffix stays in English since it's on a language-picker
              // where the user hasn't chosen the target language yet.
              const suffix =
                l.status === 'mostly'
                  ? ' (beta)'
                  : l.status === 'partial'
                  ? ' (partial)'
                  : '';
              return (
                <option key={l.code} value={l.code}>
                  {l.name}
                  {suffix}
                </option>
              );
            })}
          </select>
        </div>
      </aside>

      <main className="main">
        <div className="crumbs">Journal &nbsp;&rsaquo;&nbsp; {t(`sec_${section.slug}_title`, section.title)}</div>
        <div className="section-head">
          <div>
            <h1>{t(`sec_${section.slug}_title`, section.title)}</h1>
            <p>{schema ? t(`sch_${section.slug}_intro`, schema.intro) : t(`sec_${section.slug}_hint`, section.hint)}</p>
          </div>
          <span className="pillstatus">{statusLabel(section.slug, journal, t)}</span>
        </div>

        <label className="mark-complete">
          <input
            type="checkbox"
            checked={!!journal.sections[section.slug]?.completed}
            onChange={(e) => setSectionComplete(section.slug, e.target.checked)}
          />
          <span>{t('mark_section_done', 'Mark this section as complete')}</span>
        </label>

        {schema ? (
          <SchemaEditor slug={section.slug} onNavigate={pickSection} />
        ) : (
          <div className="stub">
            <em>{t(`sec_${section.slug}_title`, section.title)}</em>
            {t('stub_msg')}
          </div>
        )}
      </main>

      {confirmAction === 'wipe' && (
        <ConfirmDialog
          title={t('confirm_wipe_title')}
          message={t('confirm_wipe_msg')}
          confirmLabel={t('confirm_wipe_yes')}
          cancelLabel={t('cancel')}
          danger
          onConfirm={doWipe}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {showAudit && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAudit(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)', borderRadius: 12, padding: 24,
              maxWidth: 520, width: '90%', maxHeight: '80vh', overflow: 'auto',
            }}
          >
            <h3 style={{ marginBottom: 8 }}>{t('audit_title', 'Recent activity')}</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              {t(
                'audit_desc',
                'Every time your journal is unlocked, exported or synced, it’s recorded here. If you see something you don’t recognise, change your password.',
              )}
            </p>
            {auditEvents === null ? (
              <p className="muted">{t('audit_loading', 'Loading…')}</p>
            ) : auditEvents.length === 0 ? (
              <p className="muted">{t('audit_empty', 'No activity recorded yet.')}</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {auditEvents.map((ev, i) => (
                  <li key={i} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{auditLabel(ev.kind, t)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(ev.at).toLocaleString()}
                    </div>
                    {ev.ua && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2, wordBreak: 'break-word' }}>
                        {ev.ua}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="btnrow" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setShowAudit(false)}>{t('close', 'Close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function auditLabel(kind: AuditEvent['kind'], t: any): string {
  switch (kind) {
    case 'unlock_pw': return t('audit_unlock_pw', 'Unlocked with password');
    case 'unlock_rc': return t('audit_unlock_rc', 'Unlocked with recovery code');
    case 'export':    return t('audit_export', 'Exported a copy');
    case 'cloud_push':return t('audit_cloud_push', 'Saved to cloud');
    case 'cloud_pull':return t('audit_cloud_pull', 'Pulled from cloud');
    case 'wipe':      return t('audit_wipe', 'Wiped device');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statusLabel(slug: string, journal: { sections: Record<string, { fields: Record<string, unknown>; items?: Record<string, RepeatingItem[]>; completed?: boolean }> }, t: any): string {
  const d = journal.sections[slug];
  // Manual "complete" tick wins over the auto field count.
  if (d?.completed) return `\u2713 ${t('section_complete', 'Complete')}`;
  const sch = SCHEMAS[slug];
  if (!sch) return `\u25CB ${t('not_detailed', 'Not detailed yet')}`;
  const c = countFilled(sch, d?.fields, d?.items);
  if (c.filled === 0) return `\u25CB ${t('not_started', 'Not started')}`;
  if (c.filled >= c.total) return `\u2713 ${t('section_complete', 'Complete')}`;
  return `\u25D0 ${t('in_progress', 'In progress')}`;
}

function SchemaEditor({ slug, onNavigate }: { slug: string; onNavigate?: (slug: string) => void }) {
  const { t } = useTranslation();
  const journal = useVault((s) => s.journal);
  const schema = SCHEMAS[slug]!;
  const data = journal?.sections[slug];

  return (
    <>
      {schema.rootCallout && (
        <Callout type={schema.rootCallout.type}>{t(`sch_${slug}_callout`, schema.rootCallout.text)}</Callout>
      )}
      {schema.cards.map((card, i) =>
        card.kind === 'single' ? (
          <SingleCard key={i} slug={slug} cardIndex={i} card={card} values={data?.fields ?? {}} />
        ) : (
          <RepeatingCard
            key={i}
            slug={slug}
            cardIndex={i}
            card={card}
            items={(data?.items?.[card.listId] as RepeatingItem[] | undefined) ?? []}
            onNavigate={onNavigate}
          />
        ),
      )}
    </>
  );
}

function SingleCard({
  slug,
  cardIndex,
  card,
  values,
}: {
  slug: string;
  cardIndex: number;
  card: Extract<Card, { kind: 'single' }>;
  values: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const cardTitle = t(`sch_${slug}_c${cardIndex}_title`, card.title);
  const cardHint = card.hint ? t(`sch_${slug}_c${cardIndex}_hint`, card.hint) : undefined;
  const cardCallout = card.callout ? t(`sch_${slug}_c${cardIndex}_callout`, card.callout.text) : undefined;

  return (
    <div className="card">
      <h3>{cardTitle}</h3>
      {cardHint && <p className="hint">{cardHint}</p>}
      {card.callout && <Callout type={card.callout.type}>{cardCallout}</Callout>}
      <div className="grid2">
        {card.fields.map((f) => (
          <FieldInput
            key={f.id}
            slug={slug}
            field={f}
            value={values[f.id]}
            onChange={(v) => setSectionField(slug, f.id, v)}
            inputId={`${slug}-c${cardIndex}-${f.id}`}
          />
        ))}
      </div>
    </div>
  );
}

function isUnder18(dobStr: unknown): boolean {
  if (!dobStr || typeof dobStr !== 'string') return false;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  const eighteenth = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
  return today < eighteenth;
}

function RepeatingCard({
  slug,
  cardIndex,
  card,
  items,
  onNavigate,
}: {
  slug: string;
  cardIndex: number;
  card: Extract<Card, { kind: 'repeat' }>;
  items: RepeatingItem[];
  onNavigate?: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const [removeId, setRemoveId] = useState<string | null>(null);

  const cardTitle = t(`sch_${slug}_c${cardIndex}_title`, card.title);
  const cardHint = card.hint ? t(`sch_${slug}_c${cardIndex}_hint`, card.hint) : undefined;
  const cardCallout = card.callout ? t(`sch_${slug}_c${cardIndex}_callout`, card.callout.text) : undefined;
  const addLabel = t(`sch_${slug}_c${cardIndex}_add`, card.addLabel);

  function update(next: RepeatingItem[]) {
    setSectionList(slug, card.listId, next);
  }
  function add() {
    if (card.maxItems && items.length >= card.maxItems) return;
    const newItem: RepeatingItem = { id: crypto.randomUUID() };
    update([...items, newItem]);
  }
  function confirmRemove() {
    if (!removeId) return;
    update(items.filter((it) => it.id !== removeId));
    setRemoveId(null);
  }
  function change(id: string, fieldId: string, value: string) {
    update(items.map((it) => (it.id === id ? { ...it, [fieldId]: value } : it)));
  }

  return (
    <div className="card">
      <h3>
        {cardTitle}
        {card.maxItems && (
          <span style={{ fontSize: 13, fontWeight: 'normal', color: 'var(--ink-soft)' }}>
            {t('repeat_count', '{{count}} of up to {{max}}', { count: items.length, max: card.maxItems })}
          </span>
        )}
      </h3>
      {cardHint && <p className="hint">{cardHint}</p>}
      {card.callout && <Callout type={card.callout.type}>{cardCallout}</Callout>}

      {items.map((it) => (
        <div key={it.id as string} className="repeat-item">
          <button className="repeat-remove" onClick={() => setRemoveId(it.id as string)}>
            {t('remove_btn', 'Remove')}
          </button>
          <div className="grid2">
            {card.fields.map((f) => {
              if (f.conditionalUnder18 && !isUnder18(it.dob)) return null;
              return (
                <FieldInput
                  key={f.id}
                  slug={slug}
                  field={f}
                  value={it[f.id]}
                  onChange={(v) => change(it.id as string, f.id, v)}
                  inputId={`${slug}-c${cardIndex}-${it.id}-${f.id}`}
                />
              );
            })}
          </div>
          {it.addedToWill === 'No' && (
            <div className="callout warn" style={{ marginTop: 8 }}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'text-bottom' }}>
                <path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5"></path><path d="M12 17.5h.01"></path>
              </svg>
              {t('will_not_named', 'This person is not named in a will. This record has no legal standing on its own — we strongly recommend adding them to a formal will.')}
              {onNavigate && (
                <div style={{ marginTop: 6 }}>
                  <button
                    className="btn"
                    style={{ fontSize: 13, padding: '4px 10px' }}
                    onClick={() => onNavigate('financial')}
                  >
                    {t('will_goto_financial', 'Go to Financial Information — Will & Solicitors')}
                  </button>
                </div>
              )}
            </div>
          )}
          {it.addedToWill === 'Yes' && (
            <div className="callout" style={{ marginTop: 8 }}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'text-bottom' }}>
                <path d="M5 12l4 4L19 6"></path>
              </svg>
              {t('will_added', 'Added to will.')}
              {onNavigate && (
                <button
                  style={{ marginLeft: 10, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'inherit', padding: 0 }}
                  onClick={() => onNavigate('financial')}
                >
                  {t('will_view_details', 'View Will & Solicitor details')}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <button className="addmore" onClick={add}>
        {addLabel}
      </button>

      {removeId && (
        <ConfirmDialog
          title={t('confirm_remove_title', 'Remove this entry?')}
          message={t('confirm_remove_msg', 'This will delete this item and its data. This cannot be undone.')}
          confirmLabel={t('confirm_remove_yes', 'Yes, remove')}
          danger
          onConfirm={confirmRemove}
          onCancel={() => setRemoveId(null)}
        />
      )}
    </div>
  );
}
