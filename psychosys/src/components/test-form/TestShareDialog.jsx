import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Loader2,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import {
  createTestResponseLink,
  getTestForm,
  getTestResponseLinks,
  updateTestResponseLink,
} from '../../lib/test-catalog';
import {
  effectiveTestResponseStatus,
  getRespondentOptions,
  respondentLabel,
} from '../../lib/test-response-links';

const STATUS = {
  shared: ['Aguardando acesso', 'var(--warning)', 'var(--warning-bg)'],
  in_progress: ['Em preenchimento', 'var(--accent)', 'var(--accent-bg)'],
  submitted: ['Resposta recebida', 'var(--success)', 'var(--success-bg)'],
  reviewed: ['Revisada', 'var(--text-2)', 'var(--surface2)'],
  revoked: ['Link revogado', 'var(--danger)', 'var(--danger-bg)'],
  expired: ['Expirado', 'var(--text-3)', 'var(--surface2)'],
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function TestShareDialog({
  evaluationId,
  formCode,
  formName,
  patientName,
  onClose,
}) {
  const [form, setForm] = useState(null);
  const [links, setLinks] = useState([]);
  const [respondentType, setRespondentType] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const options = useMemo(() => getRespondentOptions(form), [form]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getTestForm(formCode),
      getTestResponseLinks(evaluationId, formCode),
    ]).then(([formResult, linksResult]) => {
      if (!active) return;
      if (formResult.error || !formResult.data) {
        setMessage(`Não foi possível carregar o formulário: ${formResult.error?.message || 'formulário não encontrado'}`);
      } else {
        const loadedForm = formResult.data;
        const loadedOptions = getRespondentOptions(loadedForm);
        setForm(loadedForm);
        setRespondentType(loadedOptions[0]?.value || '');
        if (['self', 'patient'].includes(loadedOptions[0]?.value)) {
          setRespondentName(patientName || '');
        }
      }
      if (linksResult.error) {
        setMessage(`Não foi possível carregar os links: ${linksResult.error.message}`);
      } else {
        setLinks(linksResult.data || []);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [evaluationId, formCode, patientName]);

  function changeRespondentType(value) {
    setRespondentType(value);
    if (['self', 'patient'].includes(value)) {
      setRespondentName(patientName || '');
      setRelationship('Paciente');
    } else {
      setRespondentName('');
      setRelationship('');
    }
  }

  async function createLink() {
    const requiresRelationship = !['self', 'patient'].includes(respondentType);
    if (!respondentType || !respondentName.trim() || (requiresRelationship && !relationship.trim())) {
      setMessage('Selecione o tipo, informe o nome e o vínculo do respondente.');
      return;
    }

    setCreating(true);
    setMessage('');
    const result = await createTestResponseLink({
      evaluationId,
      formCode,
      respondentType,
      respondentName: respondentName.trim(),
      relationship: relationship.trim(),
    });
    setCreating(false);

    if (result.error || !result.data) {
      setMessage(`Não foi possível gerar o link: ${result.error?.message || 'erro inesperado'}`);
      return;
    }

    setLinks(current => [result.data, ...current]);
    setMessage('Link exclusivo gerado. Agora você pode copiá-lo e enviar ao respondente.');
  }

  async function copyLink(link) {
    const url = `${window.location.origin}/teste/${link.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(''), 1800);
    } catch {
      setMessage('Não foi possível copiar automaticamente. Abra o link e copie-o pela barra do navegador.');
    }
  }

  async function revokeLink(link) {
    const result = await updateTestResponseLink(link.id, { status: 'revoked' });
    if (result.error) {
      setMessage(`Não foi possível revogar o link: ${result.error.message}`);
      return;
    }
    setLinks(current => current.map(item => (
      item.id === link.id ? { ...item, status: 'revoked' } : item
    )));
  }

  return (
    <div
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(25, 25, 24, .42)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-share-title"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 22px 60px rgba(0,0,0,.2)',
        }}
      >
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h2 id="test-share-title" style={{ fontSize: 17, fontWeight: 650 }}>
              Compartilhar {formName}
            </h2>
            <p style={{ color: 'var(--text-2)', fontSize: 12, marginTop: 3 }}>
              Cada respondente recebe um link exclusivo vinculado a {patientName}.
            </p>
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

        {loading ? (
          <div style={{ padding: 38, textAlign: 'center', color: 'var(--text-3)' }}>
            <Loader2 className="anamnesis-spin" size={22} /> Carregando...
          </div>
        ) : (
          <>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                Novo link
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
              }}>
                <label style={{ fontSize: 12 }}>
                  Tipo de respondente *
                  <select
                    value={respondentType}
                    onChange={event => changeRespondentType(event.target.value)}
                    style={{
                      width: '100%', marginTop: 5, padding: '9px 10px',
                      border: '1px solid var(--border)', borderRadius: 8,
                      background: 'var(--surface)', color: 'var(--text)',
                    }}
                  >
                    {options.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12 }}>
                  Nome do respondente *
                  <input
                    value={respondentName}
                    onChange={event => setRespondentName(event.target.value)}
                    placeholder="Nome completo"
                    style={{
                      width: '100%', marginTop: 5, padding: '9px 10px',
                      border: '1px solid var(--border)', borderRadius: 8,
                    }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Vínculo com o paciente {!['self', 'patient'].includes(respondentType) && '*'}
                  <input
                    value={relationship}
                    onChange={event => setRelationship(event.target.value)}
                    placeholder="Ex.: mãe, pai, professora"
                    style={{
                      width: '100%', marginTop: 5, padding: '9px 10px',
                      border: '1px solid var(--border)', borderRadius: 8,
                    }}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={createLink}
                disabled={creating || options.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  marginTop: 14, padding: '9px 14px', borderRadius: 8,
                  color: '#fff', background: 'var(--accent)',
                  opacity: creating || options.length === 0 ? 0.55 : 1,
                }}
              >
                {creating
                  ? <Loader2 className="anamnesis-spin" size={14} />
                  : <Send size={14} />}
                Gerar link de resposta
              </button>
              {message && (
                <div style={{
                  marginTop: 12, padding: '9px 11px', borderRadius: 8,
                  fontSize: 12, color: message.startsWith('Link exclusivo')
                    ? 'var(--success)'
                    : 'var(--warning)',
                  background: message.startsWith('Link exclusivo')
                    ? 'var(--success-bg)'
                    : 'var(--warning-bg)',
                }}>
                  {message}
                </div>
              )}
            </div>

            <div style={{ padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                Links gerados ({links.length})
              </h3>
              {links.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Nenhum link foi gerado para este teste.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {links.map(link => {
                    const effectiveStatus = effectiveTestResponseStatus(link);
                    const status = STATUS[effectiveStatus] || STATUS.shared;
                    const canCopy = ['shared', 'in_progress'].includes(effectiveStatus);
                    return (
                      <article key={link.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        padding: '11px 12px', border: '1px solid var(--border)',
                        borderRadius: 9, background: 'var(--surface2)',
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 12 }}>{link.respondent_name}</strong>
                            <span style={{
                              fontSize: 10, padding: '2px 7px', borderRadius: 10,
                              color: status[1], background: status[2],
                            }}>
                              {status[0]}
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 3 }}>
                            {respondentLabel(link.respondent_type)}
                            {link.relationship ? ` · ${link.relationship}` : ''}
                            {' · '}{formatDate(link.created_at)}
                            {link.expires_at ? ` · vence em ${formatDate(link.expires_at)}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canCopy && (
                            <button
                              type="button"
                              onClick={() => copyLink(link)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 9px', border: '1px solid var(--border)',
                                borderRadius: 7, color: 'var(--accent)', fontSize: 11,
                              }}
                            >
                              {copiedId === link.id ? <Check size={12} /> : <Clipboard size={12} />}
                              {copiedId === link.id ? 'Copiado' : 'Copiar'}
                            </button>
                          )}
                          {canCopy && (
                            <button
                              type="button"
                              onClick={() => revokeLink(link)}
                              title="Revogar link"
                              aria-label={`Revogar link de ${link.respondent_name}`}
                              style={{
                                width: 30, height: 30, display: 'grid', placeItems: 'center',
                                borderRadius: 7, color: 'var(--text-3)',
                              }}
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
