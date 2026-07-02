// pages/WiscIV.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  getEvaluation, getTestResult, saveTestResult,
  getWiscNormTables, getWiscIndexTables
} from '../lib/supabase';
import {
  calcWiscIV, calcIdadeFormatada, SUBTESTS, INDICES, classifyQI
} from '../lib/wisc-engine';
import {
  ArrowLeft, Save, RefreshCw, Info, CheckCircle, AlertTriangle, BarChart2
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

// ============================================================
// SUBCOMPONENTS
// ============================================================

function Badge({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20,
      background: bg || '#F1EFE8', color: color || 'var(--text-2)',
    }}>
      {label}
    </span>
  );
}

function ClassifBadge({ label }) {
  const MAP = {
    'Muito Superior':  { bg: '#E1F5EE', color: '#1D9E75' },
    'Superior':        { bg: '#9FE1CB', color: '#085041' },
    'Média Superior':  { bg: '#E6F1FB', color: '#185FA5' },
    'Média':           { bg: '#F1EFE8', color: '#5F5E5A' },
    'Média Inferior':  { bg: '#FAEEDA', color: '#BA7517' },
    'Limítrofe':       { bg: '#FAECE7', color: '#993C1D' },
    'Deficitário':     { bg: '#FCEBEB', color: '#A32D2D' },
  };
  const style = MAP[label] || { bg: '#F1EFE8', color: '#888' };
  return <Badge label={label || '—'} {...style} />;
}

function SubtestRow({ st, value, onChange, score, disabled }) {
  const isCore = st.core;
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 12px', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{st.nome}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>({st.abrev})</span>
          {!isCore && <Badge label="sup." />}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
          Índice: {st.indice}
        </div>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        <input
          type="number"
          min="0" max="200"
          value={value ?? ''}
          onChange={e => onChange(st.code, e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
          style={{
            width: 60, padding: '5px 8px', textAlign: 'center',
            border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 13, fontWeight: 500,
            background: disabled ? 'var(--bg)' : 'var(--surface)',
          }}
        />
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
        {score?.pp ?? '—'}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-2)' }}>
        {Number.isFinite(score?.z) ? score.z.toFixed(2) : '—'}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-2)' }}>
        {Number.isFinite(score?.percentil) ? `${score.percentil.toFixed(1)}%` : '—'}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <ClassifBadge label={score?.classif} />
      </td>
    </tr>
  );
}

function IndexCard({ idx, data }) {
  if (!data) return null;
  const qi = data.qi;
  const classif = qi !== null ? classifyQI(qi) : null;
  
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
      borderLeft: `4px solid ${classif?.color || 'var(--border)'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{idx.code}</div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>{idx.nome}</div>
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: classif?.color || 'var(--text)' }}>
          {qi ?? '—'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>QI</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--text-3)' }}>Soma PP</span>
          <span style={{ fontWeight: 500 }}>{data.soma ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--text-3)' }}>Percentil</span>
          <span style={{ fontWeight: 500 }}>{data.percentil ?? '—'}</span>
        </div>
        {data.ic95 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--text-3)' }}>IC 95%</span>
            <span style={{ fontWeight: 500 }}>{data.ic95}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--text-3)' }}>Interpretável</span>
          <span style={{ fontWeight: 500, color: data.interpretavel ? 'var(--success)' : 'var(--danger)' }}>
            {data.interpretavel === null ? '—' : data.interpretavel ? 'Sim' : 'Não'}
          </span>
        </div>
        {classif && <ClassifBadge label={classif.label} />}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function WiscIV() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [evaluation, setEvaluation] = useState(null);
  const [normTables, setNormTables] = useState(null);
  const [indexTables, setIndexTables] = useState(null);
  const [rawScores, setRawScores] = useState({});
  const [computed, setComputed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [normLoading, setNormLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [evalId]);

  useEffect(() => {
    if (normTables && indexTables && evaluation && Object.keys(rawScores).length > 0) {
      recalculate();
    }
  }, [rawScores, normTables, indexTables]);

  async function loadAll() {
    setLoading(true);
    const [eRes, tRes] = await Promise.all([
      getEvaluation(evalId),
      getTestResult(evalId, 'WISC_IV'),
    ]);
    
    setEvaluation(eRes.data);
    
    if (tRes.data?.raw_scores) {
      setRawScores(tRes.data.raw_scores);
    }

    // Load normative data
    setNormLoading(true);
    const [nTables, iTables] = await Promise.all([
      getWiscNormTables(),
      getWiscIndexTables(),
    ]);
    
    setNormTables(nTables);
    setIndexTables(iTables);
    setNormLoading(false);
    setLoading(false);
  }

  function recalculate() {
    if (!evaluation?.patients?.data_nascimento || !evaluation?.data_aplicacao) return;
    if (!normTables || !indexTables) return;

    const result = calcWiscIV(
      rawScores,
      evaluation.patients.data_nascimento,
      evaluation.data_aplicacao,
      normTables,
      indexTables
    );
    
    setComputed(result);
  }

  function handleScoreChange(code, value) {
    setRawScores(prev => ({ ...prev, [code]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!computed) return;
    setSaving(true);
    
    await saveTestResult(evalId, 'WISC_IV', rawScores, computed, {
      data_aplicacao: evaluation.data_aplicacao,
    });
    
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleClear() {
    setRawScores({});
    setComputed(null);
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-3)', textAlign: 'center' }}>Carregando...</div>;
  }

  if (!evaluation) {
    return <div style={{ padding: 32 }}>Avaliação não encontrada</div>;
  }

  const patient = evaluation.patients;
  const idadeTexto = patient?.data_nascimento
    ? calcIdadeFormatada(patient.data_nascimento, evaluation.data_aplicacao).texto
    : '—';
  const idade = patient?.data_nascimento
    ? calcIdadeFormatada(patient.data_nascimento, evaluation.data_aplicacao)
    : null;
  const idadeValida = idade && idade.anos >= 6 && idade.anos <= 16;

  const canEdit = idadeValida &&
    (profile?.role === 'master' || evaluation.psicologo_id === profile?.id);

  // Radar chart data
  const radarData = computed?.indexScores ? INDICES.map(idx => ({
    idx: idx.code,
    value: computed.indexScores[idx.code]?.qi ?? 0,
    fullMark: 160,
  })) : [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate(`/evaluations/${evalId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 13, marginBottom: 14 }}
        >
          <ArrowLeft size={15} /> Avaliação
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>WISC-IV</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
              {patient?.nome} · {idadeTexto}
              {computed?.erro && (
                <span style={{ color: 'var(--danger)', marginLeft: 8 }}>
                  ⚠ {computed.erro}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {normLoading && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>
                Carregando normas...
              </span>
            )}
            <button
              onClick={handleClear}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: 12,
              }}
            >
              <RefreshCw size={13} /> Limpar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !computed || computed.erro}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 16px', borderRadius: 8,
                background: saved ? 'var(--success)' : 'var(--accent)',
                color: '#fff', fontSize: 13, fontWeight: 500,
                opacity: (!computed || computed.erro) ? 0.5 : 1,
              }}
            >
              {saved ? <><CheckCircle size={13} /> Salvo!</> : <><Save size={13} /> {saving ? 'Salvando...' : 'Salvar'}</>}
            </button>
          </div>
        </div>
      </div>

      {!idadeValida && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 16px', marginBottom: 20,
          background: 'var(--warning-bg)', border: '1px solid #FAC775',
          borderRadius: 8, fontSize: 12, color: 'var(--warning)',
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>WISC-IV não aplicável para esta idade.</strong>
            <div style={{ marginTop: 2 }}>
              O paciente possui {idadeTexto}; a faixa normativa é de 6:0 a 16:11 anos.
              Confirme a data de nascimento no cadastro do paciente ou selecione um teste adequado à idade.
            </div>
          </div>
        </div>
      )}

      {/* Results summary */}
      {computed && !computed.erro && (
        <div style={{ marginBottom: 24 }}>
          {/* QI Total */}
          {computed.qiTotal?.qi && (
            <div style={{
              background: 'var(--accent)', color: '#fff',
              borderRadius: 12, padding: '16px 24px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div>
                <div style={{ fontSize: 11, opacity: .8, marginBottom: 2 }}>Q.I. TOTAL</div>
                <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
                  {computed.qiTotal.qi}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,.3)', paddingLeft: 20 }}>
                <div style={{ fontSize: 11, opacity: .8 }}>Classificação</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                  {computed.qiTotal.classif?.label ?? '—'}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,.3)', paddingLeft: 20 }}>
                <div style={{ fontSize: 11, opacity: .8 }}>Percentil</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                  {computed.qiTotal.percentil ?? '—'}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,.3)', paddingLeft: 20 }}>
                <div style={{ fontSize: 11, opacity: .8 }}>IC 95%</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                  {computed.qiTotal.ic95 ?? '—'}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,.3)', paddingLeft: 20 }}>
                <div style={{ fontSize: 11, opacity: .8 }}>Interpretável?</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                  {computed.qiTotal.interpretavel === null ? '—'
                    : computed.qiTotal.interpretavel ? 'Sim' : 'Não'}
                </div>
              </div>
            </div>
          )}

          {/* Index cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            {INDICES.map(idx => (
              <IndexCard key={idx.code} idx={idx} data={computed.indexScores[idx.code]} />
            ))}
          </div>

          {/* Radar chart */}
          {radarData.some(d => d.value > 0) && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '16px 20px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Perfil por Índice</h3>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Valores em pontos compostos (QI)</p>
              </div>
              <div style={{ flex: 1, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="idx" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                    <Radar name="QI" dataKey="value" stroke="#534AB7" fill="#534AB7" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip formatter={(v) => [v, 'QI']} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Reference line at 100 */}
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                <div style={{ marginBottom: 6 }}>📏 Referência</div>
                <div style={{ padding: '4px 8px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4 }}>
                  Média = 100
                </div>
                <div style={{ padding: '4px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                  DP = 15
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtest input table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 20,
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Subtestes</h2>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Digite os pontos brutos — os escores são calculados automaticamente
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                Subteste
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                Pts Brutos
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                Pts Pond.
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                Z-score
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                Percentil
              </th>
              <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                Classificação
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Core subtests header */}
            <tr style={{ background: 'var(--accent-bg)' }}>
              <td colSpan={6} style={{ padding: '4px 12px', fontSize: 10, color: 'var(--accent)', fontWeight: 600, letterSpacing: '.06em' }}>
                SUBTESTES PRINCIPAIS
              </td>
            </tr>
            {SUBTESTS.filter(s => s.core).map(st => (
              <SubtestRow
                key={st.code}
                st={st}
                value={rawScores[st.code]}
                onChange={handleScoreChange}
                score={computed?.subtestScores?.[st.code]}
                disabled={!canEdit || normLoading}
              />
            ))}
            {/* Supplementary */}
            <tr style={{ background: 'var(--bg)' }}>
              <td colSpan={6} style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '.06em' }}>
                SUBTESTES SUPLEMENTARES
              </td>
            </tr>
            {SUBTESTS.filter(s => !s.core).map(st => (
              <SubtestRow
                key={st.code}
                st={st}
                value={rawScores[st.code]}
                onChange={handleScoreChange}
                score={computed?.subtestScores?.[st.code]}
                disabled={!canEdit || normLoading}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Info note */}
      <div style={{
        display: 'flex', gap: 10, padding: '12px 16px',
        background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
        borderRadius: 8, fontSize: 12, color: 'var(--accent)',
      }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          Classificação baseada em: <strong>Guilmette et al. (2020)</strong> — American Academy of Clinical Neuropsychology.
          Dados normativos: WISC-IV Standardization Brazilian Sample.
          Faixa etária coberta: <strong>6:0 a 16:11 anos</strong>.
        </div>
      </div>
    </div>
  );
}
