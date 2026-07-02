// pages/EvaluationDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getEvaluation, supabase, updateEvaluation } from '../lib/supabase';
import { getTestCatalog } from '../lib/test-catalog';
import {
  ArrowLeft, Brain, CheckCircle, ChevronRight, FileText, User
} from 'lucide-react';

const CATEGORY_COLORS = {
  INTELLIGENCE: '#534AB7',
  ATTENTION: '#BA7517',
  MEMORY: '#378ADD',
  EXECUTIVE: '#D85A30',
  LANGUAGE: '#1D9E75',
  ACADEMIC: '#0F6E56',
  BEHAVIOR: '#D4537E',
  PERSONALITY: '#7F77DD',
  DEVELOPMENT: '#3B8C6E',
  VISUOCONSTRUCTION: '#D9730D',
  NEUROPSYCHOLOGY: '#5F5E5A',
};

const IMPLEMENTATION_STATUS = {
  active: { label: 'disponível', color: 'var(--success)', background: 'var(--success-bg)' },
  catalogued: { label: 'catalogado', color: 'var(--text-3)', background: 'var(--bg)' },
  modeling: { label: 'em desenvolvimento', color: 'var(--warning)', background: 'var(--warning-bg)' },
  testing: { label: 'em validação', color: 'var(--accent)', background: 'var(--accent-bg)' },
  retired: { label: 'inativo', color: 'var(--text-3)', background: 'var(--bg)' },
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

function calcIdadeAnos(dob, dataAplicacao) {
  if (!dob || !dataAplicacao) return null;
  const nascimento = new Date(`${dob}T00:00:00`);
  const aplicacao = new Date(`${dataAplicacao}T00:00:00`);
  let anos = aplicacao.getFullYear() - nascimento.getFullYear();
  const aniversarioAindaNaoOcorreu =
    aplicacao.getMonth() < nascimento.getMonth() ||
    (aplicacao.getMonth() === nascimento.getMonth() &&
      aplicacao.getDate() < nascimento.getDate());
  if (aniversarioAindaNaoOcorreu) anos--;
  return anos;
}

function formatAgeValue(months) {
  if (!Number.isFinite(months)) return null;
  if (months % 12 === 0) return `${months / 12} anos`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return years ? `${years}a ${remainder}m` : `${remainder} meses`;
}

function formatAgeRange(test) {
  if (test.code === 'WISC_IV') return '6–16 anos';

  const minimum = formatAgeValue(test.minAgeMonths);
  const maximum = formatAgeValue(test.maxAgeMonths);
  if (minimum && maximum) return `${minimum}–${maximum}`;
  if (minimum) return `a partir de ${minimum}`;
  if (maximum) return `até ${maximum}`;
  return 'faixa etária conforme manual';
}

function normalizeCatalogRow(row) {
  return {
    code: row.form_code,
    name: row.form_name,
    desc: row.description
      || (row.instrument_name !== row.form_name ? row.instrument_name : 'Instrumento catalogado'),
    category: row.category_name,
    categoryCode: row.category_code,
    minAgeMonths: row.min_age_months,
    maxAgeMonths: row.max_age_months,
    route: row.engine_key,
    status: row.implementation_status,
    available: row.implementation_status === 'active' && Boolean(row.engine_key),
  };
}

export default function EvaluationDetail() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [evaluation, setEvaluation] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [tests, setTests] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [evalId]);

  async function load() {
    setLoading(true);
    const [evaluationResult, testResultsResult, catalogResult] = await Promise.all([
      getEvaluation(evalId),
      supabase.from('test_results').select('test_code, computed_scores, updated_at')
        .eq('evaluation_id', evalId),
      getTestCatalog(),
    ]);

    setEvaluation(evaluationResult.data);
    setTestResults(testResultsResult.data || []);
    if (catalogResult.error) {
      setTests([]);
      setCatalogError(`Não foi possível carregar o catálogo de testes: ${catalogResult.error.message}`);
    } else {
      setTests((catalogResult.data || []).map(normalizeCatalogRow));
      setCatalogError('');
    }
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
  const idadeNaAplicacao = calcIdadeAnos(
    patient?.data_nascimento,
    evaluation.data_aplicacao
  );
  const appliedTests = new Set(testResults.map(t => t.test_code));
  const canEdit = profile?.role === 'master' || evaluation.psicologo_id === profile?.id;
  const testsByCode = new Map(tests.map(test => [test.code, test]));

  // Group tests by category
  const byCategory = {};
  for (const test of tests) {
    const key = `${test.categoryCode}:${test.category}`;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(test);
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
              const info = testsByCode.get(t.test_code);
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

      {catalogError && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          borderRadius: 'var(--radius)',
          color: 'var(--danger)', background: 'var(--danger-bg)',
          border: '1px solid #F7C1C1', fontSize: 12,
        }}>
          {catalogError}
        </div>
      )}

      {/* Test list by category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(byCategory).map(([categoryKey, categoryTests]) => {
          const [categoryCode, categoryName] = categoryKey.split(':');
          return (
          <div key={categoryKey} style={{
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
                background: CATEGORY_COLORS[categoryCode] || '#888',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {categoryName}
              </span>
            </div>

            {categoryTests.map((t, i) => {
              const applied = appliedTests.has(t.code);
              const result = testResults.find(r => r.test_code === t.code);
              const foraDaFaixaWisc = t.code === 'WISC_IV' &&
                (idadeNaAplicacao === null || idadeNaAplicacao < 6 || idadeNaAplicacao > 16);
              const canOpen = t.available && (applied || !foraDaFaixaWisc);
              const status = IMPLEMENTATION_STATUS[t.status] || IMPLEMENTATION_STATUS.catalogued;

              return (
                <div
                  key={t.code}
                  onClick={() => {
                    if (!canEdit && !applied) return;
                    if (canOpen && t.route) navigate(`/evaluations/${evalId}/${t.route}`);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: i < categoryTests.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: canOpen ? 'pointer' : 'default',
                    opacity: canOpen ? 1 : 0.68,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => canOpen && (e.currentTarget.style.background = 'var(--bg)')}
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
                        <span style={{
                          fontSize: 10, color: status.color, background: status.background,
                          padding: '1px 6px', borderRadius: 10, fontWeight: 500,
                        }}>
                          {status.label}
                        </span>
                        {foraDaFaixaWisc && !applied && (
                          <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 500 }}>
                            fora da faixa etária
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                        {t.desc} · {formatAgeRange(t)}
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
                    {canOpen && <ChevronRight size={14} color="var(--text-3)" />}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );
}
