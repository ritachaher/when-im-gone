// Generic form renderers that walk a SectionSchema.
// These are dumb components — they read values from props and call onChange.

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

type FieldProps = {
  slug: string;
  field: Field;
  value: unknown;
  onChange: (next: string) => void;
};

export function FieldInput({ slug, field, value, onChange }: FieldProps) {
  const { t } = useTranslation();
  const str = (value as string | undefined) ?? '';
  const common = {
    id: field.id,
    value: str,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(e.target.value),
    placeholder: field.placeholder ? t(`sch_${slug}_f_${field.id}_placeholder`, field.placeholder) : undefined,
  };

  const label = t(`sch_${slug}_f_${field.id}_label`, field.label);
  const hint = field.hint ? t(`sch_${slug}_f_${field.id}_hint`, field.hint) : undefined;
  const calloutText = field.callout ? t(`sch_${slug}_f_${field.id}_callout`, field.callout.text) : undefined;

  return (
    <div className={`field ${field.full ? 'full' : ''}`}>
      <label htmlFor={field.id}>
        {label}
        {field.optional && <span className="optional">(optional)</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea {...common} />
      ) : field.type === 'select' ? (
        <select {...common}>
          <option value="">—</option>
          {field.options?.map((o) => {
            const normalized = o.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            const translated = t(`opt_${normalized}`, o);
            return (
              <option key={o} value={o}>
                {translated}
              </option>
            );
          })}
        </select>
      ) : field.type === 'chips' ? (
        <div className="chips">
          {field.options?.map((o) => {
            const normalized = o.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            const translated = t(`opt_${normalized}`, o);
            return (
              <label key={o} className={`chip ${str === o ? 'on' : ''}`}>
                <input
                  type="radio"
                  name={field.id}
                  checked={str === o}
                  onChange={() => onChange(o)}
                />
                {translated}
              </label>
            );
          })}
        </div>
      ) : (
        <input type={field.type} {...common} />
      )}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{hint}</div>}
      {field.callout && <Callout type={field.callout.type}>{calloutText}</Callout>}
    </div>
  );
}
