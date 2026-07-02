// pages/PatientDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  getPatient, getEvaluations, createEvaluation,
  updatePatient, deletePatient, getAnamneses, getAnamnesesForReport
} from '../lib/supabase';
import {
  ArrowLeft, Plus, ClipboardList, Calendar, ChevronRight,
  Edit2, Trash2, CheckCircle, Clock, X, AlertTriangle, FileText
} from 'lucide-react';
import { generateRelevantAnamnesisText } from '../lib/pre-report-engine';

function calcIdade(dob) {
  if (!dob) return null;
  const d = new Date(dob + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  let meses = hoje.getMonth() - d.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  return `${anos}a ${meses}m`;
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-3)', fontSize: 12, width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text-3)' }}>
        {value || '—'}
      </span>
    </div>
  );
}

const ESCOLARIDADE = [
  'Ensino Pré-Escolar', 'Ensino Fundamental', 'Ensino Médio',
  'Ensino Superior', 'EJA - Educação de Jovens e Adultos',
  'FA - Ensino Fundamental de Adultos',
];

function EditPatientModal({ patient, onClose, onSaved }) {
  const [form, setForm] = useState({
    nome: patient.nome || '',
    data_nascimento: patient.data_nascimento || '',
    sexo: patient.sexo || 'Masculino',
    escolaridade: patient.escolaridade || '',
    instituicao: patient.instituicao || '',
    serie_ano: patient.serie_ano || '',
    lateralidade: patient.lateralidade || 'Destro',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (event) => {
    setForm(current => ({ ...current, [key]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    setSaving(true);
    setError('');
    const { data, error: updateError } = await updatePatient(patient.id, {
      ...form,
      nome: form.nome.trim(),
      data_nascimento: form.data_nascimento || null,
    });
    setSaving(false);

    if (updateError) {
      setError(`Não foi possível atualizar o paciente: ${updateError.message}`);
      return;
    }

    onSaved(data);
  }

  const fieldStyle = {
    width: '100%', padding: '8px 10px',
    border: '1px solid var(--border)', borderRadius: 8,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-patient-title"
      onClick={event => event.target === event.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 28,
        width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 20,
        }}>
          <h2 id="edit-patient-title" style={{ fontSize: 16, fontWeight: 600 }}>
            Editar paciente
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 14, borderRadius: 8,
            background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Nome completo *
            <input value={form.nome} onChange={set('nome')} style={{ ...fieldStyle, marginTop: 4 }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Data de nascimento
              <input
                type="date"
                value={form.data_nascimento}
                onChange={set('data_nascimento')}
                style={{ ...fieldStyle, marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Sexo
              <select value={form.sexo} onChange={set('sexo')} style={{ ...fieldStyle, marginTop: 4 }}>
                {['Masculino', 'Feminino', 'Outro'].map(option => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Escolaridade
              <select
                value={form.escolaridade}
                onChange={set('escolaridade')}
                style={{ ...fieldStyle, marginTop: 4 }}
              >
                {['', ...ESCOLARIDADE].map(option => (
                  <option key={option} value={option}>{option || 'Não informada'}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Série/Ano
              <input
                value={form.serie_ano}
                onChange={set('serie_ano')}
                style={{ ...fieldStyle, marginTop: 4 }}
              />
            </label>
          </div>

          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Instituição de ensino
            <input
              value={form.instituicao}
              onChange={set('instituicao')}
              style={{ ...fieldStyle, marginTop: 4 }}
            />
          </label>

          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Lateralidade
            <select
              value={form.lateralidade}
              onChange={set('lateralidade')}
              style={{ ...fieldStyle, marginTop: 4 }}
            >
              {['Destro', 'Sinistro', 'Ambidestro'].map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-2)',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{
              padding: '8px 18px', borderRadius: 8,
              background: 'var(--accent)', color: '#fff', fontWeight: 500,
            }}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [anamneses, setAnamneses] = useState([]);
  const [answeredAnamneses, setAnsweredAnamneses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const [pRes, eRes, aRes, answeredRes] = await Promise.all([
      getPatient(id),
      getEvaluations(id),
      getAnamneses(id),
      getAnamnesesForReport(id),
    ]);
    setPatient(pRes.data);
    setEvaluations(eRes.data || []);
    setAnamneses(aRes.data || []);
    setAnsweredAnamneses(answeredRes.data || []);
    setLoading(false);
  }

  async function handleNewEval() {
    setCreating(true);
    const { data, error } = await createEvaluation({
      patient_id: id,
      psicologo_id: profile.id,
      data_aplicacao: new Date().toISOString().split('T')[0],
      status: 'em_andamento',
    });
    setCreating(false);
    if (data) navigate(`/evaluations/${data.id}`);
  }

  async function handleDelete() {
    await deletePatient(id);
    navigate('/patients');
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text-3)', textAlign: 'center' }}>
        Carregando...
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ padding: 32 }}>
        <p>Paciente não encontrado</p>
        <button onClick={() => navigate('/patients')}>Voltar</button>
      </div>
    );
  }

  const canEdit = profile?.role === 'master' || patient.psicologo_id === profile?.id;
  const anamnesisResultText = generateRelevantAnamnesisText(patient, answeredAnamneses);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 880 }}>
      {/* Back */}
      <button
        onClick={() => navigate('/patients')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--text-2)', fontSize: 13, marginBottom: 20,
        }}
      >
        <ArrowLeft size={15} /> Pacientes
      </button>

      {/* Patient header */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 600, color: 'var(--accent)',
          }}>
            {patient.nome?.charAt(0)}
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>{patient.nome}</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
              {patient.data_nascimento && (
                <>
                  {new Date(patient.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {' · '}{calcIdade(patient.data_nascimento)}
                  {' · '}
                </>
              )}
              {patient.sexo}
            </p>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEditing(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid var(--border)', color: 'var(--accent)',
                fontSize: 12, background: 'var(--accent-bg)',
              }}
            >
              <Edit2 size={13} /> Editar
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid var(--border)', color: 'var(--danger)',
                fontSize: 12, background: 'var(--danger-bg)',
              }}
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Info card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '18px 20px',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dados cadastrais</h2>
          <InfoRow label="Escolaridade" value={patient.escolaridade} />
          <InfoRow label="Série/Ano" value={patient.serie_ano} />
          <InfoRow label="Instituição" value={patient.instituicao} />
          <InfoRow label="Lateralidade" value={patient.lateralidade} />
          {profile?.role === 'master' && (
            <InfoRow
              label="Psicólogo resp."
              value={patient.profiles?.nome}
            />
          )}
        </div>

        {/* Stats */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '18px 20px',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Resumo</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--bg)', borderRadius: 8,
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Avaliações</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)' }}>
                {evaluations.length}
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--bg)', borderRadius: 8,
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Concluídas</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--success)' }}>
                {evaluations.filter(e => e.status === 'concluida').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Escalas */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24,
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Escalas</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
              Questionários clínicos e formulários compartilhados
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => navigate(`/patients/${id}/escalas/new`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--accent)', color: '#fff',
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              }}
            >
              <Plus size={13} /> Escala
            </button>
          )}
        </div>

        {anamneses.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <ClipboardList size={30} color="var(--text-3)" style={{ marginBottom: 9 }} />
            <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Nenhuma escala criada</p>
            <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 3 }}>
              Use um dos modelos disponíveis ou crie um formulário personalizado.
            </p>
          </div>
        ) : (
          anamneses.map((anamnesis, index) => {
            const statusLabels = {
              rascunho: 'Rascunho',
              compartilhada: 'Aguardando resposta',
              respondida: 'Respondida',
              revisada: 'Revisada',
            };
            const completed = ['respondida', 'revisada'].includes(anamnesis.status);
            return (
              <button
                type="button"
                key={anamnesis.id}
                onClick={() => navigate(`/escalas/${anamnesis.id}`)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', textAlign: 'left', padding: '13px 20px',
                  borderBottom: index < anamneses.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: completed ? 'var(--success-bg)' : 'var(--accent-bg)',
                  }}>
                    {completed
                      ? <CheckCircle size={16} color="var(--success)" />
                      : <ClipboardList size={16} color="var(--accent)" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{anamnesis.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {statusLabels[anamnesis.status] || anamnesis.status}
                      {' · '}
                      {new Date(anamnesis.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                <ChevronRight size={15} color="var(--text-3)" />
              </button>
            );
          })
        )}
      </div>

      {/* Scale results */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '18px 20px', marginBottom: 24,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 16, marginBottom: 12,
        }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Resultado das escalas</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
              Texto-base para “Dados relevantes das escalas”
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/patients/${id}/pre-report`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 11px', borderRadius: 8,
              background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12,
            }}
          >
            <Edit2 size={13} /> Revisar texto
          </button>
        </div>
        <div style={{
          padding: 14, background: 'var(--surface2)', borderRadius: 8,
          whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.65, color: 'var(--text-2)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {anamnesisResultText}
        </div>
      </div>

      {/* Evaluations */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24,
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Avaliações</h2>
          {canEdit && (
            <button
              onClick={handleNewEval}
              disabled={creating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--accent)', color: '#fff',
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              }}
            >
              <Plus size={13} />
              {creating ? 'Criando...' : 'Nova avaliação'}
            </button>
          )}
        </div>

        {evaluations.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <ClipboardList size={36} color="var(--text-3)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Nenhuma avaliação ainda</p>
          </div>
        ) : (
          evaluations.map((ev, i) => {
            const tests = ev.test_results?.map(t => t.test_code.replace('_', '-')) || [];
            return (
              <div
                key={ev.id}
                onClick={() => navigate(`/evaluations/${ev.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 20px',
                  borderBottom: i < evaluations.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: ev.status === 'concluida' ? 'var(--success-bg)' : 'var(--warning-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {ev.status === 'concluida'
                      ? <CheckCircle size={16} color="var(--success)" />
                      : <Clock size={16} color="var(--warning)" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      Avaliação de {new Date(ev.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {tests.length > 0
                        ? `${tests.length} teste${tests.length !== 1 ? 's' : ''}: ${tests.join(', ')}`
                        : 'Nenhum teste aplicado ainda'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={15} color="var(--text-3)" />
              </div>
            );
          })
        )}
      </div>

      {/* Pre-report */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '18px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9,
            display: 'grid', placeItems: 'center', background: 'var(--accent-bg)',
          }}>
            <FileText size={19} color="var(--accent)" />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Pré-laudo</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
              Documento editável com identificação, escalas, avaliações, gráficos e conclusão
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/patients/${id}/pre-report`)}
          style={{
            padding: '8px 13px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 500,
          }}
        >
          Abrir pré-laudo
        </button>
      </div>

      {editing && (
        <EditPatientModal
          patient={patient}
          onClose={() => setEditing(false)}
          onSaved={(updatedPatient) => {
            setPatient(current => ({ ...current, ...updatedPatient }));
            setEditing(false);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 14, padding: 28,
            width: 380, boxShadow: 'var(--shadow-lg)',
          }}>
            <AlertTriangle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Excluir paciente?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
              Esta ação é permanente e excluirá <strong>{patient.nome}</strong> e todas as suas avaliações.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: 13,
              }}>Cancelar</button>
              <button onClick={handleDelete} style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 500,
              }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
