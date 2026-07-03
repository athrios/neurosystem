import React from 'react';
import { BarChart2 } from 'lucide-react';

export default function GenericResults({ result }) {
  const outputs = Object.entries(result?.outputs || {});
  if (!outputs.length) return null;

  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <BarChart2 size={15} color="var(--accent)" />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Resultados calculados</h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
      }}>
        {outputs.map(([id, output]) => (
          <div key={id} style={{
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 9,
            background: 'var(--surface2)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
              {output.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <strong style={{ fontSize: 20, fontWeight: 650 }}>{output.value}</strong>
              {output.unit && <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{output.unit}</span>}
            </div>
            {output.classification && (
              <span style={{
                display: 'inline-block', marginTop: 6,
                padding: '2px 7px', borderRadius: 10,
                fontSize: 10, fontWeight: 500,
                color: 'var(--accent)', background: 'var(--accent-bg)',
              }}>
                {output.classification}
              </span>
            )}
            {output.details?.length > 0 && (
              <div style={{
                marginTop: 8, paddingTop: 7,
                borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                {output.details.map(detail => (
                  <div
                    key={detail.label}
                    style={{
                      display: 'flex', justifyContent: 'space-between', gap: 8,
                      fontSize: 10.5, color: 'var(--text-3)',
                    }}
                  >
                    <span>{detail.label}</span>
                    <strong style={{ color: 'var(--text-2)', textAlign: 'right' }}>
                      {detail.value}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
