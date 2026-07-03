import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { deleteAppliedTest } from '../../lib/test-catalog';

export default function TestDeleteDialog({
  evaluationId,
  test,
  onClose,
  onDeleted,
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    const result = await deleteAppliedTest(evaluationId, test.code);
    setDeleting(false);

    if (result.error || !result.data?.deleted) {
      setError(result.error?.message || 'Não foi possível excluir o teste.');
      return;
    }
    onDeleted(result.data);
  }

  return (
    <div
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && !deleting && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'grid', placeItems: 'center', padding: 20,
        background: 'rgba(25, 25, 24, .42)', backdropFilter: 'blur(3px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-test-title"
        style={{
          width: 'min(480px, 100%)', padding: 20,
          border: '1px solid var(--border)', borderRadius: 14,
          background: 'var(--surface)', boxShadow: '0 22px 60px rgba(0,0,0,.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{
            width: 42, height: 42, display: 'grid', placeItems: 'center',
            borderRadius: 10, color: 'var(--danger)', background: 'var(--danger-bg)',
          }}>
            <AlertTriangle size={21} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label="Fechar"
            style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}
          >
            <X size={17} />
          </button>
        </div>

        <h2 id="delete-test-title" style={{ fontSize: 18, fontWeight: 650, marginTop: 15 }}>
          Excluir teste aplicado?
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
          O resultado de <strong>{test.name}</strong> será removido desta avaliação.
          Links de resposta associados serão revogados. Esta ação ficará registrada
          no histórico de auditoria.
        </p>

        {error && (
          <div role="alert" style={{
            marginTop: 14, padding: '9px 11px', borderRadius: 8,
            color: 'var(--danger)', background: 'var(--danger-bg)', fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            style={{
              padding: '8px 12px', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-2)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              color: '#fff', background: 'var(--danger)',
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting
              ? <Loader2 className="anamnesis-spin" size={14} />
              : <Trash2 size={14} />}
            Excluir teste
          </button>
        </div>
      </section>
    </div>
  );
}

