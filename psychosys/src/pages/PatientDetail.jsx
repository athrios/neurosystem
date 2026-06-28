// pages/PatientDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  getPatient, getEvaluations, createEvaluation,
  updatePatient, deletePatient
} from '../lib/supabase';
import {
  ArrowLeft, Plus, ClipboardList, Calendar, ChevronRight,
  Edit2, Trash2, CheckCircle, Clock, X, AlertTriangle
} from 'lucide-react';

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

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const [pRes, eRes] = await Promise.all([
      getPatient(id),
      getEvaluations(id),
    ]);
    setPatient(pRes.data);
    setEvaluations(eRes.data || []);
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

      {/* Evaluations */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
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
