import React from 'react';

const inputStyle = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 11px',
  color: 'var(--text)',
  background: 'var(--surface)',
  outline: 'none',
};

function NativeInput({ field, value, onChange, disabled, describedBy }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        id={field.id}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        aria-describedby={describedBy}
        rows={4}
        style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        id={field.id}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby={describedBy}
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {field.options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={field.id}
      type={field.type}
      value={value ?? ''}
      onChange={event => onChange(event.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      readOnly={field.readOnly}
      required={field.required}
      min={field.type === 'number' && field.min !== null ? field.min : undefined}
      max={field.type === 'number' && field.max !== null ? field.max : undefined}
      step={field.type === 'number' ? field.step : undefined}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
      aria-describedby={describedBy}
      style={inputStyle}
    />
  );
}

export default function GenericField({
  field,
  value,
  error,
  onChange,
  disabled = false,
}) {
  const helpId = `${field.id}-help`;
  const errorId = `${field.id}-error`;
  const describedBy = [field.helpText ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;
  const fieldDisabled = disabled || field.readOnly;

  if (field.type === 'checkbox') {
    return (
      <div style={{ gridColumn: `span ${field.span}`, minWidth: 0 }}>
        <label
          htmlFor={field.id}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 9,
            fontSize: 13, color: 'var(--text)', cursor: fieldDisabled ? 'default' : 'pointer',
          }}
        >
          <input
            id={field.id}
            type="checkbox"
            checked={value === true}
            onChange={event => onChange(event.target.checked)}
            disabled={fieldDisabled}
            aria-describedby={describedBy}
            style={{ marginTop: 3 }}
          />
          <span>
            {field.label}
            {field.required && <span style={{ color: 'var(--danger)' }}> *</span>}
          </span>
        </label>
        {field.helpText && (
          <div id={helpId} style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, marginLeft: 23 }}>
            {field.helpText}
          </div>
        )}
        {error && (
          <div id={errorId} style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, marginLeft: 23 }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ gridColumn: `span ${field.span}`, minWidth: 0 }}>
      <label
        htmlFor={field.id}
        style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}
      >
        {field.label}
        {field.required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>

      {field.type === 'radio' ? (
        <div
          id={field.id}
          role="radiogroup"
          aria-describedby={describedBy}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {field.options.map(option => {
            const selected = String(value ?? '') === option.value;
            return (
              <label
                key={option.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px', borderRadius: 8,
                  border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: selected ? 'var(--accent-bg)' : 'var(--surface)',
                  color: selected ? 'var(--accent)' : 'var(--text-2)',
                  cursor: fieldDisabled ? 'default' : 'pointer',
                  fontSize: 12,
                }}
              >
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={selected}
                  onChange={event => onChange(event.target.value)}
                  disabled={fieldDisabled}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      ) : (
        <NativeInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={fieldDisabled}
          describedBy={describedBy}
        />
      )}

      {field.helpText && (
        <div id={helpId} style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
          {field.helpText}
        </div>
      )}
      {error && (
        <div id={errorId} style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
