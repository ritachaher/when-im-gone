import { useEffect, useMemo, useState } from 'react';
import {
  getLastCloudPushAt,
  markCloudPushed,
  setSectionField,
  setSectionList,
  useVault,
  wipe,
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

  if (!journal) return null;
  const section = findSection(active);
  const schema = SCHEMAS[section.slug];

  const [confirmAction, setConfirmAction] = useState<null | 'wipe'>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const [cloudStatus, setCloudStatus] = useState<BackupStatus>('idle');
  const [lastCloudPushAt, setLastCloudPushAt] = useState<number | null>(null);

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

  async function onCloudPush() {
    setCloudStatus('pushing');
    try {
      await pushBackup();
      const now = Date.now();
      await markCloudPushed(now);
      setLastCloudPushAt(now);
      setCloudStatus('done');
      setTimeout(() => setCloudStatus('idle'), 2500);
    } catch (e) {
      console.error('Cloud push failed:', e);
      setCloudStatus('error');
      setTimeout(() => setCloudStatus('idle'), 3000);
    }
  }

  async function doWipe() {
    await wipe();
    location.reload();
  }

  return (
    <div className="owner-shell">
      <aside className="sidebar">
        <div className="brand">
          {t('app_name')}
          <small>{t('journal_label', { name: ownerName })}</small>
        </div>
        <div className="nav-overall">
          {t('complete_pct', { pct: progress })}
          <div className="progress">
            <div style={{ width: `${progress}%` }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>{t('auto_saved')}</div>
        </div>
        <nav className="nav">
          <ul>
            {SECTIONS.map((s) => {
              const sch = SCHEMAS[s.slug];
              const d = journal.sections[s.slug];
              const status: 'empty' | 'part' | 'done' = sch
                ? (() => {
                    const c = countFilled(sch, d?.fields, d?.items);
                    if (c.filled === 0) return 'empty';
                    if (c.filled >= c.total) return 'done';
                    return 'part';
                  })()
                : (d && (Object.keys(d.fields).length > 0 || (d.items && Object.keys(d.items).length > 0))
                    ? 'part'
                    : 'empty');
              return (
                <li key={s.slug}>
                  <a
                    className={s.slug === active ? 'active' : ''}
                    onClick={() => setActive(s.slug)}
                  >
                    <span className={`dot ${status}`} />
                    <span>{t(`sec_${s.slug}_title`, s.title)}</span>
                  </a>
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
                  ? t('cloud_push_hint_stale', 'Your cloud copy is out of date — save now')
                  : t('cloud_push_hint', 'Keeps a safe backup in case this device is lost')}
              </span>
              {cloudStatus === 'done' && <span className="footer-hint" style={{ color: 'var(--ok)' }}>{t('cloud_done', '\u2713 Saved')}</span>}
              {cloudStatus === 'error' && <span className="footer-hint" style={{ color: 'var(--danger)' }}>{t('cloud_error', 'Could not save — please try again')}</span>}
            </div>
          )}
          <div className="footer-action">
            <button onClick={onLock}>{t('lock_journal', 'Lock')}</button>
            <span className="footer-hint">{t('lock_hint', 'Hides everything behind your password')}</span>
          </div>
          <div className="footer-action">
            <button onClick={() => setConfirmAction('wipe')}>{t('wipe_btn', 'Wipe everything')}</button>
            <span className="footer-hint">{t('wipe_hint', 'Permanently deletes all data on this device')}</span>
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
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
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

        {schema ? (
          <SchemaEditor slug={section.slug} />
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
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statusLabel(slug: string, journal: { sections: Record<string, { fields: Record<string, unknown>; items?: Record<string, RepeatingItem[]> }> }, t: any): string {
  const sch = SCHEMAS[slug];
  if (!sch) return `\u25CB ${t('not_detailed', 'Not detailed yet')}`;
  const d = journal.sections[slug];
  const c = countFilled(sch, d?.fields, d?.items);
  if (c.filled === 0) return `\u25CB ${t('not_started', 'Not started')}`;
  if (c.filled >= c.total) return `\u2713 ${t('section_complete', 'Complete')}`;
  return `\u25D0 ${t('in_progress', 'In progress')}`;
}

function SchemaEditor({ slug }: { slug: string }) {
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
          />
        ))}
      </div>
    </div>
  );
}

function RepeatingCard({
  slug,
  cardIndex,
  card,
  items,
}: {
  slug: string;
  cardIndex: number;
  card: Extract<Card, { kind: 'repeat' }>;
  items: RepeatingItem[];
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
            {card.fields.map((f) => (
              <FieldInput
                key={f.id}
                slug={slug}
                field={f}
                value={it[f.id]}
                onChange={(v) => change(it.id as string, f.id, v)}
              />
            ))}
          </div>
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
