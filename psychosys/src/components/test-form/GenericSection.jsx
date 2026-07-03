import React from 'react';
import GenericField from './GenericField';

export default function GenericSection({
  section,
  values,
  errors,
  onChange,
  disabled,
}) {
  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: '13px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>{section.title}</h2>
        {section.description && (
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {section.description}
          </p>
        )}
      </header>

      <div className="generic-test-grid" style={{ padding: 18 }}>
        {section.fields.map(field => (
          <GenericField
            key={field.id}
            field={field}
            value={values[field.id]}
            error={errors[field.id]}
            onChange={value => onChange(field.id, value)}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}
