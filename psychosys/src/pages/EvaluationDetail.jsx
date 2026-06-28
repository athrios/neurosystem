// pages/EvaluationDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getEvaluation, saveTestResult, supabase, updateEvaluation } from '../lib/supabase';
import {
  ArrowLeft, Brain, CheckCircle, Clock, ChevronRight,
  FileText, Calendar, User, BarChart2
} from 'lucide-react';

// Todos os testes disponíveis agora e no futuro
const TESTS = [
  {
    code: 'WISC_IV', name: 'WISC-IV', desc: 'Escala de Inteligência Wechsler para Crianças',
    category: 'Eficiência Intelectual', ageRange: '6-16 anos', route: 'wisc-iv', available: true,
  },
  {
    code: 'WAIS_III', name: 'WAIS-III', desc: 'Escala de Inteligência Wechsler para Adultos',
    category: 'Eficiência Intelectual', ageRange: '>16 anos', route: null, available: false,
  },
  {
    code: 'WASI', name: 'WASI', desc: 'Escala Abreviada de Inteligência de Wechsler',
    category: 'Eficiência Intelectual', ageRange: '6-89 anos', route: null, available: false,
  },
  {
    code: 'RAVLT', name: 'RAVLT', desc: 'Teste de Aprendizagem Auditivo-Verbal de Rey',
    category: 'Memória', ageRange: '6+ anos', route: null, available: false,
  },
  {
    code: 'TRILHAS', name: 'Trilhas', desc: 'Teste de Trilhas (Trail Making Test)',
    category: 'Função Executiva', ageRange: 'variado', route: null, available: false,
  },
  {
    code: 'STROOP', name: 'STROOP', desc: 'Teste de Cores e Palavras de Stroop',
    category: 'Função Executiva', ageRange: 'variado', route: null, available: false,
  },
  {
    code: 'CBCL', name: 'CBCL', desc: 'Child Behavior Checklist - 6 a 18 anos',
    category: 'Comportamento', ageRange: '6-18 anos', route: null, available: false,
  },
  {
    code: 'D2_R', name: 'D2-R', desc: 'Teste de Atenção Concentrada D2-R',
    category: 'Atenção', ageRange: '8+ anos', route: null, available: false,
  },
];

const CATEGORY_COLORS = {
  'Eficiência Intelectual': '#534AB7',
  'Memória': '#378ADD',
  'Função Executiva': '#D85A30',
  'Atenção': '#BA7517',
  'Comportamento': '#D4537E',
  'Linguagem': '#1D9E75',
};

function calcIdade(dob) {
  if (!dob) return null;
  const d = new Date(dob + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  let meses = hoje.getMonth() - d.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  return `${anos}a ${meses}m`;
}

export default function EvaluationDetail() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [evaluation, setEvaluation] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [evalId]);

  async function load() {
    const [eRes, tRes] = await Promise.all([
      getEvaluation(evalId),
      supabase.from('test_results').select('test_code, computed_scores, updated_at')
        .eq('evaluation_id', evalId),
    ]);
    setEvaluation(eRes.data);
    setTestResults(tRes.data || []);
    setLoading(false);
  }

  async function markComplete() {
    await updateEvaluation(evalId, { status: 'concluida' });
    load();
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-3)' }}>Carregando...</div>;
  if (!evaluation) return <div style={{ padding: 32 }}>Avaliação não encontrada</div>;

  const patient = evaluation.patients;
  const psicologo = evaluation.profiles;
  const appliedTests = new Set(testResults.map(t => t.test_code));
  const canEdit = profile?.role === 'master' || evaluation.psicologo_id === profile?.id;

  // Group tests by category
  const byCategory = {};
  for (const t of TESTS) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      {/* Back */}
      <button
        onClick={() => navigate(`/patients/${patient?.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}
      >
        <ArrowLeft size={15} /> {patient?.nome}
      </button>

      {/* Header */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '18px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1 style={{ fontSize: 17, fontWeight: 600 }}>
              Avaliação — {new Date(evaluation.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR')}
            </h1>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
              background: evaluation.status === 'concluida' ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: evaluation.status === 'concluida' ? 'var(--success)' : 'var(--warning)',
              border: `1px solid ${evaluation.status === 'concluida' ? '#9FE1CB' : '#FAC775'}`,
            }}>
              {evaluation.status === 'concluida' ? '✓ Concluída' : '· Em andamento'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, color: 'var(--text-2)', fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={12} /> {patient?.nome}
              {patient?.data_nascimento && ` · ${calcIdade(patient.data_nascimento)}`}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Brain size={12} /> {psicologo?.nome} ({psicologo?.crp || 'CRP —'})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && evaluation.status !== 'concluida' && testResults.length > 0 && (
            <button
              onClick={markComplete}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: 'var(--success-bg)', color: 'var(--success)',
                border: '1px solid #9FE1CB',
              }}
            >
              <CheckCircle size={13} /> Concluir
            </button>
          )}
        </div>
      </div>

      {/* Tests applied summary */}
      {testResults.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-2)' }}>
            TESTES APLICADOS ({testResults.length})
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {testResults.map(t => {
              const info = TESTS.find(x => x.code === t.test_code);
              return (
                <div
                  key={t.test_code}
                  onClick={() => info?.route && navigate(`/evaluations/${evalId}/${info.route}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                    fontSize: 12, fontWeight: 500,
                    cursor: info?.route ? 'pointer' : 'default',
                  }}
                >
                  <CheckCircle size={12} />
                  {info?.name || t.test_code.replace('_', '-')}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Test list by category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(byCategory).map(([cat, tests]) => (
          <div key={cat} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '11px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: CATEGORY_COLORS[cat] || '#888',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {cat}
              </span>
            </div>

            {tests.map((t, i) => {
              const applied = appliedTests.has(t.code);
              const result = testResults.find(r => r.test_code === t.code);

              return (
                <div
                  key={t.code}
                  onClick={() => {
                    if (!canEdit && !applied) return;
                    if (t.available && t.route) navigate(`/evaluations/${evalId}/${t.route}`);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: i < tests.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: t.available ? 'pointer' : 'default',
                    opacity: !t.available ? 0.5 : 1,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => t.available && (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: applied ? 'var(--success-bg)' : 'var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {applied
                        ? <CheckCircle size={15} color="var(--success)" />
                        : <FileText size={15} color="var(--text-3)" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.name}
                        {!t.available && (
                          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
                            em breve
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                        {t.desc} · {t.ageRange}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {applied && result?.computed_scores?.qiTotal?.qi && (
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                        background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 6,
                      }}>
                        QI {result.computed_scores.qiTotal.qi}
                      </span>
                    )}
                    {t.available && <ChevronRight size={14} color="var(--text-3)" />}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
