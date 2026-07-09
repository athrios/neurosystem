import React, { useState } from 'react';
import { ArchiveRestore, Loader2, LockKeyhole, RotateCcw, X } from 'lucide-react';
import { restoreAppliedTest } from '../../lib/test-catalog';

export default function TestRestoreDialog({
  test,
  onClose,
  onRestored,
}) {
  const [password, setPassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');

  async function confirmRestore() {
    if (!password) {
      setError('Informe a senha de segurança.');
      return;
    }
    setRestoring(true);
    setError('');
    const result = await restoreAppliedTest(test.id, password);
    setRestoring(false);

    if (result.error || !result.data?.restored) {
      setError(
        result.error?.message
        || result.data?.message
        || 'Não foi possível restaurar o teste.'
      );
      return;
    }
    onRestored(result.data);
  }

  return (
    <div
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && !restoring && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        display: 'grid', placeItems: 'center', padding: 20,
        background: 'rgba(25, 25, 24, .52)', backdropFilter: 'blur(4px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-test-title"
        style={{
          width: 'min(480px, 100%)', padding: 20,
          border: '1px solid var(--border)', borderRadius: 14,
          background: 'var(--surface)', boxShadow: '0 22px 60px rgba(0,0,0,.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{
            width: 42, height: 42, display: 'grid', placeItems: 'center',
            borderRadius: 10, color: 'var(--accent)', background: 'var(--accent-bg)',
          }}>
            <ArchiveRestore size={21} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={restoring}
            aria-label="Fechar"
            style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}
          >
            <X size={17} />
          </button>
        </div>

        <h2 id="restore-test-title" style={{ fontSize: 18, fontWeight: 650, marginTop: 15 }}>
          Restaurar resultado?
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
          O resultado excluído de <strong>{test.name}</strong> será devolvido à avaliação
          com seus escores e metadados originais.
        </p>

        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{
            display: 'block', color: 'var(--text-2)',
            fontSize: 12, fontWeight: 600, marginBottom: 6,
          }}>
            Senha de segurança
          </span>
          <div style={{ position: 'relative' }}>
            <LockKeyhole
              size={15}
              aria-hidden="true"
              style={{
                position: 'absolute', left: 11, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-3)',
              }}
            />
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && confirmRestore()}
              disabled={restoring}
              autoFocus
              autoComplete="off"
              placeholder="Digite sua senha"
              aria-label="Senha de segurança para restaurar o teste"
              style={{
                width: '100%', height: 38, padding: '8px 12px 8px 35px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
              }}
            />
          </div>
          <span style={{
            display: 'block', marginTop: 5,
            color: 'var(--warning)', fontSize: 10,
          }}>
            Ambiente de teste: senha temporária 1234
          </span>
        </label>

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
            disabled={restoring}
            style={{
              padding: '8px 12px', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-2)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmRestore}
            disabled={restoring || !password}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              color: '#fff', background: 'var(--accent)',
              opacity: restoring || !password ? 0.55 : 1,
            }}
          >
            {restoring
              ? <Loader2 className="anamnesis-spin" size={14} />
              : <RotateCcw size={14} />}
            Restaurar teste
          </button>
        </div>
      </section>
    </div>
  );
}
