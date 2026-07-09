import React, { useMemo, useState } from 'react';
import {
  ArchiveRestore, CheckCircle, RotateCcw, Search, Trash2, X
} from 'lucide-react';

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function DeletedTestsDialog({
  deletedTests,
  tests,
  onClose,
  onRestore,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('deleted');
  const testsByCode = useMemo(
    () => new Map(tests.map(test => [test.code, test])),
    [tests]
  );
  const normalizedQuery = normalizeSearchText(query);
  const filteredTests = deletedTests.filter(item => {
    const test = testsByCode.get(item.form_code);
    const matchesQuery = !normalizedQuery || normalizeSearchText([
      test?.name,
      item.form_code,
      test?.desc,
      test?.category,
    ].join(' ')).includes(normalizedQuery);
    const matchesStatus =
      status === 'all'
      || (status === 'deleted' && !item.restored_at)
      || (status === 'restored' && Boolean(item.restored_at));
    return matchesQuery && matchesStatus;
  });

  return (
    <div
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'grid', placeItems: 'center', padding: 20,
        background: 'rgba(25, 25, 24, .42)', backdropFilter: 'blur(3px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleted-tests-title"
        style={{
          width: 'min(720px, 100%)', maxHeight: 'min(760px, 90vh)',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)', borderRadius: 14,
          background: 'var(--surface)', boxShadow: '0 22px 60px rgba(0,0,0,.2)',
          overflow: 'hidden',
        }}
      >
        <header style={{
          padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 40, height: 40, display: 'grid', placeItems: 'center',
              borderRadius: 10, color: 'var(--accent)', background: 'var(--accent-bg)',
            }}>
              <ArchiveRestore size={20} />
            </div>
            <div>
              <h2 id="deleted-tests-title" style={{ fontSize: 17, fontWeight: 650 }}>
                Lixeira de testes
              </h2>
              <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
                Consulte exclusões e restaure resultados com senha.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}
          >
            <X size={17} />
          </button>
        </header>

        <div style={{
          padding: 14, display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) minmax(150px, .4fr)',
          gap: 9, borderBottom: '1px solid var(--border)',
        }}>
          <label style={{ position: 'relative' }}>
            <Search
              size={14}
              aria-hidden="true"
              style={{
                position: 'absolute', left: 11, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-3)',
              }}
            />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por nome, sigla ou domínio"
              aria-label="Buscar testes excluídos"
              style={{
                width: '100%', height: 36, padding: '8px 34px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                style={{
                  position: 'absolute', right: 7, top: 7,
                  width: 22, height: 22, display: 'grid', placeItems: 'center',
                  color: 'var(--text-3)', borderRadius: 6,
                }}
              >
                <X size={13} />
              </button>
            )}
          </label>
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            aria-label="Filtrar histórico por situação"
            style={{
              width: '100%', height: 36, padding: '8px 10px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface)', color: 'var(--text)',
            }}
          >
            <option value="deleted">Aguardando restauração</option>
            <option value="restored">Já restaurados</option>
            <option value="all">Todo o histórico</option>
          </select>
        </div>

        <div style={{ overflowY: 'auto', padding: 14 }}>
          {filteredTests.length === 0 ? (
            <div style={{
              padding: '38px 20px', textAlign: 'center',
              border: '1px dashed var(--border)', borderRadius: 10,
              color: 'var(--text-3)',
            }}>
              <Search size={21} style={{ marginBottom: 8 }} />
              <div style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 550 }}>
                Nenhum teste encontrado
              </div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                Ajuste a busca ou o filtro de situação.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTests.map(item => {
                const test = testsByCode.get(item.form_code);
                const restored = Boolean(item.restored_at);
                const canRestore =
                  !restored && item.snapshot_saved;
                return (
                  <article
                    key={item.id}
                    style={{
                      padding: '12px 14px',
                      border: '1px solid var(--border)', borderRadius: 10,
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, flexShrink: 0,
                        display: 'grid', placeItems: 'center', borderRadius: 8,
                        color: restored ? 'var(--success)' : 'var(--danger)',
                        background: restored ? 'var(--success-bg)' : 'var(--danger-bg)',
                      }}>
                        {restored ? <CheckCircle size={15} /> : <Trash2 size={15} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {test?.name || item.form_code}
                        </div>
                        <div style={{
                          color: 'var(--text-3)', fontSize: 10,
                          marginTop: 2, lineHeight: 1.5,
                        }}>
                          {item.form_code} · Excluído em {formatDateTime(item.deleted_at)}
                          {restored && (
                            <> · Restaurado em {formatDateTime(item.restored_at)}</>
                          )}
                        </div>
                        {!restored && !item.snapshot_saved && (
                          <div style={{ color: 'var(--warning)', fontSize: 10, marginTop: 3 }}>
                            Registro anterior ao recurso de restauração
                          </div>
                        )}
                      </div>
                    </div>

                    {canRestore && (
                      <button
                        type="button"
                        onClick={() => onRestore({
                          ...item,
                          name: test?.name || item.form_code,
                        })}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 10px', borderRadius: 8,
                          color: 'var(--accent)', background: 'var(--accent-bg)',
                          border: '1px solid var(--accent-border)',
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        <RotateCcw size={13} />
                        Restaurar
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
