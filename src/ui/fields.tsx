// Generic form renderers that walk a SectionSchema.
// These are dumb components - they read values from props and call onChange.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Field } from './schema';

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
      ) : (
        <input type={field.type} {...common} />
      )}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{hint}</div>}
      {field.callout && <Callout type={field.callout.type}>{calloutText}</Callout>}
    </div>
  );
}
