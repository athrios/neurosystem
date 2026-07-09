// pages/EvaluationDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getEvaluation, supabase, updateEvaluation } from '../lib/supabase';
import {
  getCalculationRuns,
  getDeletedAppliedTests,
  getTestCatalog,
  getTestResponseLinks,
} from '../lib/test-catalog';
import { isRenderableTestEngine } from '../lib/test-engine-registry';
import {
  getPendingTestResponses,
  isShareableTestForm,
  respondentLabel,
} from '../lib/test-response-links';
import TestDeleteDialog from '../components/test-form/TestDeleteDialog';
import DeletedTestsDialog from '../components/test-form/DeletedTestsDialog';
import TestRestoreDialog from '../components/test-form/TestRestoreDialog';
import TestShareDialog from '../components/test-form/TestShareDialog';
import {
  ArchiveRestore, ArrowLeft, Brain, CheckCircle, ChevronRight, FileText, History,
  Search, Share2, Trash2, User, X
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

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

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

function formatDateTime(value) {
  if (!value) return 'data não informada';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeCalculationOutputs(run) {
  const outputs = run.result_summary?.outputs || run.result_payload?.outputs || {};
  return Object.values(outputs)
    .slice(0, 3)
    .map(output => {
      const parts = [
        output.label,
        output.value != null ? output.value : null,
        output.unit,
        output.classification,
      ].filter(Boolean);
      return parts.join(' · ');
    })
    .join(' | ') || 'Resultado registrado';
}

function normalizeCatalogRow(row) {
  const specializedRoute = row.engine_key === 'wisc-iv' ? 'wisc-iv' : null;
  return {
    code: row.form_code,
    name: row.form_name,
    desc: row.description
      || (row.instrument_name !== row.form_name ? row.instrument_name : 'Instrumento catalogado'),
    category: row.category_name,
    categoryCode: row.category_code,
    minAgeMonths: row.min_age_months,
    maxAgeMonths: row.max_age_months,
    engineKey: row.engine_key,
    respondentType: row.respondent_type,
    metadata: row.metadata || {},
    route: specializedRoute,
    status: row.implementation_status,
    available: ['active', 'testing'].includes(row.implementation_status)
      && (Boolean(specializedRoute) || isRenderableTestEngine(row.engine_key)),
  };
}

function getTestPath(evaluationId, test) {
  if (!test?.available) return null;
  if (isRenderableTestEngine(test.engineKey)) {
    return `/evaluations/${evaluationId}/tests/${test.code}`;
  }
  return test.route ? `/evaluations/${evaluationId}/${test.route}` : null;
}

export default function EvaluationDetail() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [evaluation, setEvaluation] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [tests, setTests] = useState([]);
  const [testResponseLinks, setTestResponseLinks] = useState([]);
  const [calculationRuns, setCalculationRuns] = useState([]);
  const [deletedTests, setDeletedTests] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [calculationRunsError, setCalculationRunsError] = useState('');
  const [deletedTestsError, setDeletedTestsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingTest, setDeletingTest] = useState(null);
  const [showDeletedTests, setShowDeletedTests] = useState(false);
  const [restoringTest, setRestoringTest] = useState(null);
  const [sharingTest, setSharingTest] = useState(null);
  const [testQuery, setTestQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

  useEffect(() => { load(); }, [evalId]);

  async function load() {
    setLoading(true);
    const [
      evaluationResult,
      testResultsResult,
      catalogResult,
      responseLinksResult,
      calculationRunsResult,
      deletedTestsResult,
    ] = await Promise.all([
      getEvaluation(evalId),
      supabase.from('test_results').select('test_code, computed_scores, updated_at')
        .eq('evaluation_id', evalId),
      getTestCatalog(),
      getTestResponseLinks(evalId),
      getCalculationRuns(evalId),
      getDeletedAppliedTests(evalId),
    ]);

    setEvaluation(evaluationResult.data);
    setTestResults(testResultsResult.data || []);
    setTestResponseLinks(responseLinksResult.data || []);
    if (calculationRunsResult.error) {
      setCalculationRuns([]);
      setCalculationRunsError(
        `Não foi possível carregar o histórico de cálculos: ${calculationRunsResult.error.message}`
      );
    } else {
      setCalculationRuns(calculationRunsResult.data || []);
      setCalculationRunsError('');
    }
    if (deletedTestsResult.error) {
      setDeletedTests([]);
      setDeletedTestsError(
        `Não foi possível carregar a lixeira: ${deletedTestsResult.error.message}`
      );
    } else {
      setDeletedTests(deletedTestsResult.data || []);
      setDeletedTestsError('');
    }
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
  const normalizedQuery = normalizeSearchText(testQuery);
  const categories = Array.from(
    new Map(tests.map(test => [test.categoryCode, test.category])).entries()
  ).sort(([, first], [, second]) => first.localeCompare(second, 'pt-BR'));
  const filteredTests = tests.filter(test => {
    const matchesQuery = !normalizedQuery || normalizeSearchText([
      test.name,
      test.code,
      test.desc,
      test.category,
    ].join(' ')).includes(normalizedQuery);
    const matchesCategory =
      categoryFilter === 'all' || test.categoryCode === categoryFilter;
    const applied = appliedTests.has(test.code);
    const matchesAvailability =
      availabilityFilter === 'all'
      || (availabilityFilter === 'available' && test.available)
      || (availabilityFilter === 'applied' && applied)
      || (availabilityFilter === 'not-applied' && !applied)
      || (availabilityFilter === 'unavailable' && !test.available);
    return matchesQuery && matchesCategory && matchesAvailability;
  });
  const hasActiveFilters =
    Boolean(testQuery) || categoryFilter !== 'all' || availabilityFilter !== 'all';
  const pendingDeletedTests = deletedTests.filter(test => !test.restored_at).length;

  // Group tests by category
  const byCategory = {};
  for (const test of filteredTests) {
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
              const path = getTestPath(evalId, info);
              return (
                <div
                  key={t.test_code}
                  onClick={() => path && navigate(path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                    fontSize: 12, fontWeight: 500,
                    cursor: path ? 'pointer' : 'default',
                  }}
                >
                  <CheckCircle size={12} />
                  {info?.name || t.test_code.replace('_', '-')}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setDeletingTest({
                          code: t.test_code,
                          name: info?.name || t.test_code.replace('_', '-'),
                        });
                      }}
                      aria-label={`Excluir ${info?.name || t.test_code}`}
                      title="Excluir teste aplicado"
                      style={{
                        width: 22, height: 22, display: 'grid', placeItems: 'center',
                        marginLeft: 2, borderRadius: 6,
                        color: 'var(--danger)', background: 'var(--danger-bg)',
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(calculationRuns.length > 0 || calculationRunsError) && (
        <section style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 20,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginBottom: 10,
          }}>
            <h2 style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
            }}>
              <History size={14} color="var(--accent)" />
              Histórico de cálculos
            </h2>
            {calculationRuns.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {calculationRuns.length} execução{calculationRuns.length === 1 ? '' : 'ões'}
              </span>
            )}
          </div>

          {calculationRunsError ? (
            <div style={{
              padding: '9px 11px', borderRadius: 8,
              color: 'var(--warning)', background: 'var(--warning-bg)', fontSize: 11,
            }}>
              {calculationRunsError}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {calculationRuns.map(run => {
                const respondent = Array.isArray(run.test_response_links)
                  ? run.test_response_links[0]
                  : run.test_response_links;
                const form = testsByCode.get(run.instrument_id);
                const responseLinkId = run.respondent_id || run.meta?.response_link_id;
                const respondentName =
                  respondent?.respondent_name
                  || run.meta?.respondent_name
                  || 'Respondente sem nome';
                const respondentType =
                  respondent?.respondent_type
                  || run.meta?.respondent_type
                  || 'other';
                return (
                  <article
                    key={run.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(150px, .9fr) minmax(150px, .9fr) minmax(220px, 1.4fr) auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 9,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Data do cálculo
                      </div>
                      <strong style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {formatDateTime(run.calculated_at)}
                      </strong>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Respondente
                      </div>
                      <strong style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {respondentName}
                      </strong>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                        {respondentLabel(respondentType)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {form?.name || run.instrument_id}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 1 }}>
                        {summarizeCalculationOutputs(run)}
                      </div>
                    </div>
                    {responseLinkId && (
                      <button
                        type="button"
                        onClick={() => navigate(
                          `/evaluations/${evalId}/tests/${run.instrument_id}?responseLink=${responseLinkId}`
                        )}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 9px', borderRadius: 7,
                          border: '1px solid var(--accent-border)',
                          color: 'var(--accent)', background: 'var(--accent-bg)',
                          fontSize: 11, fontWeight: 550,
                        }}
                      >
                        Visualizar
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
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

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 10,
      }}>
        <h2 style={{
          fontSize: 12, fontWeight: 650, color: 'var(--text-2)',
          textTransform: 'uppercase', letterSpacing: '.04em',
        }}>
          Catálogo de testes
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowDeletedTests(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 10px', borderRadius: 8,
              color: 'var(--accent)', background: 'var(--accent-bg)',
              border: '1px solid var(--accent-border)',
              fontSize: 11, fontWeight: 600,
            }}
          >
            <ArchiveRestore size={13} />
            Testes excluídos
            {pendingDeletedTests > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px',
                display: 'grid', placeItems: 'center', borderRadius: 9,
                color: '#fff', background: 'var(--accent)', fontSize: 9,
              }}>
                {pendingDeletedTests}
              </span>
            )}
          </button>
        )}
      </div>

      {deletedTestsError && (
        <div style={{
          padding: '9px 11px', marginBottom: 12, borderRadius: 8,
          color: 'var(--warning)', background: 'var(--warning-bg)', fontSize: 11,
        }}>
          {deletedTestsError}
        </div>
      )}

      {!catalogError && tests.length > 0 && (
        <section
          aria-label="Filtros do catálogo de testes"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) minmax(170px, .55fr) minmax(170px, .55fr)',
            gap: 10,
          }}>
            <label style={{ position: 'relative' }}>
              <span style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: 'var(--text-2)', marginBottom: 6,
              }}>
                BUSCAR TESTE
              </span>
              <Search
                size={15}
                aria-hidden="true"
                style={{
                  position: 'absolute', left: 11, bottom: 10,
                  color: 'var(--text-3)', pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                value={testQuery}
                onChange={event => setTestQuery(event.target.value)}
                placeholder="Nome, sigla ou descrição"
                aria-label="Buscar teste por nome, sigla ou descrição"
                style={{
                  width: '100%', height: 36, padding: '8px 34px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)',
                  outline: 'none',
                }}
              />
              {testQuery && (
                <button
                  type="button"
                  onClick={() => setTestQuery('')}
                  aria-label="Limpar busca"
                  title="Limpar busca"
                  style={{
                    position: 'absolute', right: 7, bottom: 7,
                    width: 22, height: 22, display: 'grid', placeItems: 'center',
                    color: 'var(--text-3)', borderRadius: 6,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </label>

            <label>
              <span style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: 'var(--text-2)', marginBottom: 6,
              }}>
                DOMÍNIO
              </span>
              <select
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                aria-label="Filtrar testes por domínio"
                style={{
                  width: '100%', height: 36, padding: '8px 10px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)',
                }}
              >
                <option value="all">Todos os domínios</option>
                {categories.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </label>

            <label>
              <span style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: 'var(--text-2)', marginBottom: 6,
              }}>
                SITUAÇÃO
              </span>
              <select
                value={availabilityFilter}
                onChange={event => setAvailabilityFilter(event.target.value)}
                aria-label="Filtrar testes por situação"
                style={{
                  width: '100%', height: 36, padding: '8px 10px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)',
                }}
              >
                <option value="all">Todas as situações</option>
                <option value="available">Disponíveis</option>
                <option value="applied">Já aplicados</option>
                <option value="not-applied">Ainda não aplicados</option>
                <option value="unavailable">Indisponíveis</option>
              </select>
            </label>
          </div>

          <div style={{
            minHeight: 24, marginTop: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', gap: 12,
            color: 'var(--text-3)', fontSize: 11,
          }}>
            <span>
              {filteredTests.length === tests.length
                ? `${tests.length} teste${tests.length === 1 ? '' : 's'} no catálogo`
                : `${filteredTests.length} de ${tests.length} testes encontrados`}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setTestQuery('');
                  setCategoryFilter('all');
                  setAvailabilityFilter('all');
                }}
                style={{
                  color: 'var(--accent)', fontSize: 11, fontWeight: 550,
                  padding: '3px 6px', borderRadius: 6,
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </section>
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
              const path = getTestPath(evalId, t);
              const canShare = canEdit && isShareableTestForm(t);
              const pendingResponses = getPendingTestResponses(testResponseLinks, t.code);
              const nextPendingResponse = pendingResponses[0];
              const canReview = canEdit && Boolean(nextPendingResponse);

              return (
                <div
                  key={t.code}
                  onClick={() => {
                    if (!canEdit && !applied) return;
                    if (canOpen && path) navigate(path);
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
                      <div style={{
                        fontSize: 13, fontWeight: 500, display: 'flex',
                        alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      }}>
                        {t.name}
                        <span style={{
                          fontSize: 10, color: status.color, background: status.background,
                          padding: '1px 6px', borderRadius: 10, fontWeight: 500,
                        }}>
                        {status.label}
                      </span>
                        {isShareableTestForm(t) && (
                          <span
                            aria-label={`${t.name} é compartilhável por link`}
                            title="Compartilhável por link"
                            style={{
                              display: 'inline-grid', placeItems: 'center',
                              width: 20, height: 20, borderRadius: 10,
                              background: 'var(--accent-bg)',
                              border: '1px solid var(--accent-border)',
                              fontSize: 11,
                            }}
                          >
                            🔗
                          </span>
                        )}
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
                    {canReview && (
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          navigate(
                            `/evaluations/${evalId}/tests/${t.code}?responseLink=${nextPendingResponse.id}`
                          );
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 9px', borderRadius: 7,
                          color: '#fff', background: 'var(--success)',
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        <CheckCircle size={12} />
                        Revisar resposta{pendingResponses.length > 1 ? ` (${pendingResponses.length})` : ''}
                      </button>
                    )}
                    {canShare && (
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          setSharingTest(t);
                        }}
                        aria-label={`Parametrizar compartilhamento de ${t.name}`}
                        title="Parametrizar e compartilhar"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 9px',
                          borderRadius: 7,
                          border: '1px solid var(--accent-border)',
                          color: 'var(--accent)', background: 'var(--accent-bg)',
                          fontSize: 11, fontWeight: 550,
                        }}
                      >
                        <Share2 size={12} />
                        Compartilhar
                      </button>
                    )}
                    {applied && canEdit && (
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          setDeletingTest({ code: t.code, name: t.name });
                        }}
                        aria-label={`Excluir ${t.name}`}
                        title="Excluir teste aplicado"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 9px', borderRadius: 7,
                          border: '1px solid #F7C1C1',
                          color: 'var(--danger)', background: 'var(--danger-bg)',
                          fontSize: 11, fontWeight: 550,
                        }}
                      >
                        <Trash2 size={12} />
                        Excluir
                      </button>
                    )}
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
        {!catalogError && tests.length > 0 && filteredTests.length === 0 && (
          <div style={{
            padding: '32px 20px', textAlign: 'center',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-3)',
          }}>
            <Search size={22} style={{ marginBottom: 8 }} />
            <div style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 550 }}>
              Nenhum teste encontrado
            </div>
            <div style={{ fontSize: 11, marginTop: 3 }}>
              Ajuste a busca ou limpe os filtros para ver todo o catálogo.
            </div>
          </div>
        )}
      </div>

      {deletingTest && (
        <TestDeleteDialog
          evaluationId={evalId}
          test={deletingTest}
          onClose={() => setDeletingTest(null)}
          onDeleted={() => {
            setDeletingTest(null);
            load();
          }}
        />
      )}

      {showDeletedTests && (
        <DeletedTestsDialog
          deletedTests={deletedTests}
          tests={tests}
          onClose={() => setShowDeletedTests(false)}
          onRestore={setRestoringTest}
        />
      )}

      {restoringTest && (
        <TestRestoreDialog
          test={restoringTest}
          onClose={() => setRestoringTest(null)}
          onRestored={() => {
            setRestoringTest(null);
            load();
          }}
        />
      )}

      {sharingTest && (
        <TestShareDialog
          evaluationId={evalId}
          formCode={sharingTest.code}
          formName={sharingTest.name}
          patientName={patient?.nome || 'paciente'}
          onClose={() => setSharingTest(null)}
        />
      )}
    </div>
  );
}
