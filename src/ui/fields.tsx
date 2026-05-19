// Generic form renderers that walk a SectionSchema.
// These are dumb components - they read values from props and call onChange.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Field } from './schema';

// ─── Custom date input (DD / MM / YYYY) ──────────────────────────────────────
// Replaces <input type="date"> which has deeply unreliable year-entry UX across
// browsers and mobile OSes. Stores value as ISO YYYY-MM-DD to match the old format.
function DateInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parse = (v: string) => {
    const [y = '', m = '', d = ''] = v ? v.split('-') : [];
    return { y, m, d };
  };

  const init = parse(value);
  const [day, setDay]   = useState(init.d);
  const [mon, setMon]   = useState(init.m);
  const [year, setYear] = useState(init.y);

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef  = useRef<HTMLInputElement>(null);

  // Sync when the value prop is changed externally (e.g. form clear)
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      const p = parse(value);
      setDay(p.d);
      setMon(p.m);
      setYear(p.y);
    }
  }, [value]);

  function commit(d: string, m: string, y: string) {
    if (d && m && y.length === 4) {
      onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    } else if (!d && !m && !y) {
      onChange('');
    }
    // While partially filled, keep the last committed value intact
  }

  const digits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);

  return (
    <div className="date-fields" role="group">
      <input
        id={id}
        className="date-part"
        type="text"
        inputMode="numeric"
        placeholder="DD"
        maxLength={2}
        value={day}
        onChange={e => {
          const v = digits(e.target.value, 2);
          setDay(v);
          commit(v, mon, year);
          if (v.length === 2) monthRef.current?.focus();
        }}
      />
      <span className="date-sep" aria-hidden="true">/</span>
      <input
        ref={monthRef}
        className="date-part"
        type="text"
        inputMode="numeric"
        placeholder="MM"
        maxLength={2}
        value={mon}
        onChange={e => {
          const v = digits(e.target.value, 2);
          setMon(v);
          commit(day, v, year);
          if (v.length === 2) yearRef.current?.focus();
        }}
      />
      <span className="date-sep" aria-hidden="true">/</span>
      <input
        ref={yearRef}
        className="date-part date-year"
        type="text"
        inputMode="numeric"
        placeholder="YYYY"
        maxLength={4}
        value={year}
        onChange={e => {
          const v = digits(e.target.value, 4);
          setYear(v);
          commit(day, mon, v);
        }}
      />
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function Callout({
  type = 'accent',
  children,
}: {
  type?: 'info' | 'warn' | 'accent';
  children: React.ReactNode;
}) {
  return <div className={`callout ${type === 'accent' ? '' : type}`}>{children}</div>;
}

// ─── Custom select dropdown ───────────────────────────────────────────────────
function CustomSelect({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const displayValue = value || '—';

  return (
    <div ref={ref} className={`csel${open ? ' csel--open' : ''}`}>
      <button
        type="button"
        id={id}
        className="csel__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? '' : 'csel__placeholder'}>{displayValue}</span>
        <svg
          className="csel__chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="csel__menu" role="listbox">
          <div
            className="csel__option"
            role="option"
            aria-selected={value === ''}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            —
          </div>
          {options.map((o) => (
            <div
              key={o}
              className={`csel__option${value === o ? ' csel__option--selected' : ''}`}
              role="option"
              aria-selected={value === o}
              onClick={() => { onChange(o); setOpen(false); }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

type FieldProps = {
  slug: string;
  field: Field;
  value: unknown;
  onChange: (next: string) => void;
  // Unique DOM id/name scope. Required to avoid collisions when the same
  // field renders multiple times (e.g. each row of a RepeatingCard, or the
  // user's own `dob` plus a child's `dob` in the same section).
  inputId?: string;
};

export function FieldInput({ slug, field, value, onChange, inputId }: FieldProps) {
  const { t } = useTranslation();
  const str = (value as string | undefined) ?? '';
  const domId = inputId ?? field.id;
  const common = {
    id: domId,
    value: str,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder: field.placeholder ? t(`sch_${slug}_f_${field.id}_placeholder`, field.placeholder) : undefined,
  };

  const label = t(`sch_${slug}_f_${field.id}_label`, field.label);
  const hint = field.hint ? t(`sch_${slug}_f_${field.id}_hint`, field.hint) : undefined;
  const calloutText = field.callout ? t(`sch_${slug}_f_${field.id}_callout`, field.callout.text) : undefined;

  return (
    <div className={`field ${field.full ? 'full' : ''}`}>
      <label htmlFor={domId}>
        {label}
      </label>
      {field.type === 'textarea' ? (
        <textarea {...common} />
      ) : field.type === 'select' ? (
        <CustomSelect
          id={domId}
          options={field.options ?? []}
          value={str}
          onChange={onChange}
        />
      ) : field.type === 'chips' ? (
        <div className="chips">
          {field.options?.map((o) => {
            const normalized = o.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            const translated = t(`opt_${normalized}`, o);
            return (
              <label key={o} className={`chip ${str === o ? 'on' : ''}`}>
                <input
                  type="radio"
                  name={domId}
                  checked={str === o}
                  onChange={() => onChange(o)}
                />
                {translated}
              </label>
            );
          })}
        </div>
      ) : field.type === 'slider' ? (
        <div className="trust-slider">
          <input
            type="range"
            id={domId}
            min="0"
            max="100"
            step="10"
            value={str || '0'}
            onChange={(e) => onChange(e.target.value)}
            className="trust-range"
            style={{ '--val': str || '0' } as React.CSSProperties}
          />
          <span className="trust-value">{str || '0'}%</span>
        </div>
      ) : field.type === 'date' ? (
        <DateInput id={domId} value={str} onChange={onChange} />
      ) : (
        <input type={field.type} {...common} />
      )}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{hint}</div>}
      {field.callout && <Callout type={field.callout.type}>{calloutText}</Callout>}
    </div>
  );
}
