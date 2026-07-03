import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, ImagePlus,
  Printer, RefreshCw, Save, Trash2,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '../App';
import LogoEditorModal from '../components/LogoEditorModal';
import {
  getAnamnesesForReport, getEvaluations, getPatient, getPreReport,
  savePreReport, updateProfile,
} from '../lib/supabase';
import {
  generateAnalysisText,
  generateFormResultsText,
  generateProcedureText,
  generateRelevantAnamnesisText,
  generateSummaryText,
} from '../lib/pre-report-engine';
import { listAdaptedTestResults } from '../lib/pre-report-test-adapters';

const EMPTY_REPORT = {
  description_demand: '',
  anamnesis_text: '',
  procedure_notes: '',
  comments: '',
  analysis_notes: '',
  form_results_text: '',
  summary: '',
  conclusion: '',
  referrals: '',
  status: 'rascunho',
};

function formatDate(date) {
  if (!date) return 'Não informado';
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
}

function age(date) {
  if (!date) return 'Não informada';
  const birth = new Date(`${date}T00:00:00`);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) years -= 1;
  return `${years} anos`;
}

function ReportSection({ number, title, field, value, onChange, children, placeholder }) {
  return (
    <section style={{ marginTop: 26, breakInside: 'avoid-page' }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
        {number}) {title.toUpperCase()}
      </h2>
      {field && (
        <>
          <textarea
            className="report-edit-field"
            value={value}
            rows={Math.max(4, Math.min(13, (value?.split('\n').length || 1) + 3))}
            placeholder={placeholder}
            onChange={event => onChange(field, event.target.value)}
            style={{
              width: '100%', resize: 'vertical', padding: 12,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface2)', lineHeight: 1.65, fontSize: 13,
            }}
          />
          <div className="report-print-text">
            {(value || placeholder || '').split('\n').map((paragraph, index) => (
              <p key={`${field}-${index}`} style={{ marginBottom: 8 }}>{paragraph || '\u00a0'}</p>
            ))}
          </div>
        </>
      )}
      {children}
    </section>
  );
}

function WiscChart({ result }) {
  const data = Object.entries(result.computed_scores?.indexScores || {})
    .filter(([, value]) => value?.qi)
    .map(([index, value]) => ({ index, qi: value.qi, fullMark: 160 }));
  if (!data.length) return null;
  return (
    <div style={{
      height: 310, marginTop: 16, border: '1px solid var(--border)',
      borderRadius: 10, padding: 12, breakInside: 'avoid-page',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
        Perfil dos índices cognitivos - WISC-IV
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <RadarChart data={data}>
          <PolarGrid stroke="#D8D5CC" />
          <PolarAngleAxis dataKey="index" tick={{ fontSize: 11 }} />
          <Radar dataKey="qi" stroke="#534AB7" fill="#534AB7" fillOpacity={0.24} strokeWidth={2} />
          <Tooltip formatter={value => [value, 'QI']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TestProfileChart({ adapted }) {
  if (!adapted.chartData.length) return null;
  const height = Math.max(210, adapted.chartData.length * 38 + 70);
  return (
    <div style={{
      height, marginTop: 16, border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 10px 8px',
      breakInside: 'avoid-page',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
        Perfil de resultados - {adapted.shortName}
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={adapted.chartData}
          layout="vertical"
          margin={{ top: 4, right: 28, bottom: 4, left: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E5DD" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value, _name, item) => [
              `${value}${item.payload.classification ? ` · ${item.payload.classification}` : ''}`,
              'Escore',
            ]}
          />
          <Bar dataKey="value" fill="#534AB7" radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PreReport() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { profile, setProfile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [anamneses, setAnamneses] = useState([]);
  const [report, setReport] = useState(EMPTY_REPORT);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoSource, setLogoSource] = useState('');
  const [branding, setBranding] = useState({
    logo_data: '',
    logo_alignment: 'center',
    footer_line1: '',
    footer_line2: '',
  });

  useEffect(() => {
    if (!profile) return;
    setBranding({
      logo_data: profile.logo_data || '',
      logo_alignment: profile.logo_alignment || 'center',
      footer_line1: profile.footer_line1 || '',
      footer_line2: profile.footer_line2 || '',
    });
  }, [profile]);

  const generated = useMemo(() => {
    if (!patient) return EMPTY_REPORT;
    const anamnesisText = generateRelevantAnamnesisText(patient, anamneses);
    const formResults = generateFormResultsText(patient, anamneses, evaluations);
    return {
      anamnesis_text: anamnesisText,
      procedure_notes: generateProcedureText(evaluations, anamneses),
      analysis_notes: generateAnalysisText(patient, evaluations),
      form_results_text: formResults,
      summary: generateSummaryText(patient, anamnesisText, formResults, evaluations),
    };
  }, [anamneses, evaluations, patient]);

  useEffect(() => {
    async function load() {
      const [patientResult, evaluationResult, anamnesisResult, reportResult] = await Promise.all([
        getPatient(patientId),
        getEvaluations(patientId),
        getAnamnesesForReport(patientId),
        getPreReport(patientId),
      ]);
      const loadedPatient = patientResult.data;
      const loadedEvaluations = evaluationResult.data || [];
      const loadedAnamneses = anamnesisResult.data || [];
      setPatient(loadedPatient);
      setEvaluations(loadedEvaluations);
      setAnamneses(loadedAnamneses);

      if (reportResult.data) {
        setRecordId(reportResult.data.id);
        setReport({ ...EMPTY_REPORT, ...reportResult.data });
      } else if (loadedPatient) {
        const anamnesisText = generateRelevantAnamnesisText(loadedPatient, loadedAnamneses);
        const formResults = generateFormResultsText(
          loadedPatient,
          loadedAnamneses,
          loadedEvaluations,
        );
        setReport({
          ...EMPTY_REPORT,
          anamnesis_text: anamnesisText,
          procedure_notes: generateProcedureText(loadedEvaluations, loadedAnamneses),
          analysis_notes: generateAnalysisText(loadedPatient, loadedEvaluations),
          form_results_text: formResults,
          summary: generateSummaryText(
            loadedPatient,
            anamnesisText,
            formResults,
            loadedEvaluations,
          ),
        });
      }
      setLoading(false);
    }
    load();
  }, [patientId]);

  function change(field, value) {
    setReport(current => ({ ...current, [field]: value }));
    setMessage('');
  }

  function refreshGenerated() {
    setReport(current => ({ ...current, ...generated }));
    setMessage('Conteúdos automáticos atualizados. Revise antes de salvar.');
  }

  async function save() {
    setSaving(true);
    const fields = Object.fromEntries(Object.keys(EMPTY_REPORT).map(key => [key, report[key] || '']));
    const [reportResult, profileResult] = await Promise.all([
      savePreReport(patientId, profile.id, fields),
      updateProfile(profile.id, branding),
    ]);
    setSaving(false);
    if (reportResult.error || profileResult.error) {
      setMessage(`Não foi possível salvar: ${(reportResult.error || profileResult.error).message}`);
      return;
    }
    setRecordId(reportResult.data.id);
    setReport(current => ({ ...current, ...reportResult.data }));
    setProfile(profileResult.data);
    setMessage('Pré-laudo salvo.');
  }

  function handleLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setMessage('Use uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 800 * 1024) {
      setMessage('O logotipo deve ter no máximo 800 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoSource(reader.result);
      setMessage('');
    };
    reader.readAsDataURL(file);
  }

  const testResults = evaluations.flatMap(evaluation => evaluation.test_results || []);
  const adaptedTestResults = listAdaptedTestResults(evaluations);
  const logoJustify = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  }[branding.logo_alignment] || 'center';

  if (loading) return <div style={{ padding: 32, color: 'var(--text-3)' }}>Carregando pré-laudo...</div>;
  if (!patient) return <div style={{ padding: 32 }}>Paciente não encontrado.</div>;

  return (
    <div className="report-page" style={{ padding: '24px 28px 60px', maxWidth: 980, margin: '0 auto' }}>
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <button
          onClick={() => navigate(`/patients/${patientId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 13 }}
        >
          <ArrowLeft size={15} /> {patient.nome}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={refreshGenerated}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
            }}
          >
            <RefreshCw size={14} /> Atualizar automáticos
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              borderRadius: 8, background: 'var(--accent)', color: '#fff',
            }}
          >
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
            }}
          >
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {message && (
        <div className="no-print" style={{
          padding: '8px 11px', marginBottom: 12, borderRadius: 8,
          background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12,
        }}>
          {message}
        </div>
      )}

      <section className="no-print" style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 16, marginBottom: 14,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Identidade visual</h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(220px, .8fr) 1.2fr',
          gap: 18, alignItems: 'start',
        }}>
          <div>
            <div style={{
              minHeight: 86, display: 'flex', alignItems: 'center',
              justifyContent: logoJustify,
              padding: 10, border: '1px dashed var(--border-strong)', borderRadius: 8,
            }}>
              {branding.logo_data
                ? <img src={branding.logo_data} alt="Prévia do logotipo" style={{ maxWidth: '100%', maxHeight: 72 }} />
                : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Nenhum logotipo</span>}
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 10px', borderRadius: 7,
                background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
              }}>
                <ImagePlus size={14} /> Escolher imagem
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} hidden />
              </label>
              {branding.logo_data && (
                <button
                  type="button"
                  onClick={() => setBranding(current => ({ ...current, logo_data: '' }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontSize: 12 }}
                >
                  <Trash2 size={13} /> Remover
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
              {[
                ['left', AlignLeft, 'Esquerda'],
                ['center', AlignCenter, 'Centro'],
                ['right', AlignRight, 'Direita'],
              ].map(([value, Icon, label]) => (
                <button
                  type="button"
                  key={value}
                  title={label}
                  onClick={() => setBranding(current => ({ ...current, logo_alignment: value }))}
                  style={{
                    width: 34, height: 30, display: 'grid', placeItems: 'center',
                    borderRadius: 7,
                    border: `1px solid ${branding.logo_alignment === value ? 'var(--accent)' : 'var(--border)'}`,
                    background: branding.logo_alignment === value ? 'var(--accent-bg)' : 'transparent',
                    color: branding.logo_alignment === value ? 'var(--accent)' : 'var(--text-2)',
                  }}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Primeira linha do rodapé
              <input
                value={branding.footer_line1}
                maxLength={140}
                onChange={event => setBranding(current => ({ ...current, footer_line1: event.target.value }))}
                placeholder="Ex.: Clínica · Endereço"
                style={{
                  display: 'block', width: '100%', marginTop: 4, padding: '8px 9px',
                  border: '1px solid var(--border)', borderRadius: 7,
                }}
              />
            </label>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Segunda linha do rodapé
              <input
                value={branding.footer_line2}
                maxLength={140}
                onChange={event => setBranding(current => ({ ...current, footer_line2: event.target.value }))}
                placeholder="Ex.: Telefone · E-mail"
                style={{
                  display: 'block', width: '100%', marginTop: 4, padding: '8px 9px',
                  border: '1px solid var(--border)', borderRadius: 7,
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <article className="report-document" style={{
        background: '#fff', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)', padding: '42px 54px', color: '#1A1A18',
      }}>
        <header style={{ marginBottom: 28 }}>
          {branding.logo_data && (
            <div style={{
              display: 'flex',
              justifyContent: logoJustify,
              marginBottom: 18,
            }}>
              <img
                src={branding.logo_data}
                alt="Logotipo"
                style={{ maxWidth: 260, maxHeight: 100, objectFit: 'contain' }}
              />
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 20 }}>
            {profile?.nome} · {profile?.crp ? `CRP ${profile.crp}` : 'Registro profissional não informado'}
          </div>
          <h1 style={{ fontSize: 19, letterSpacing: '.02em' }}>PRÉ-LAUDO DE AVALIAÇÃO NEUROPSICOLÓGICA</h1>
          <p style={{ color: '#777', fontSize: 11, marginTop: 5 }}>
            Documento em elaboração - requer revisão e assinatura profissional
          </p>
          </div>
        </header>

        <ReportSection number="1" title="Identificação do paciente">
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '8px 22px', fontSize: 12, lineHeight: 1.5,
          }}>
            <div><strong>Nome:</strong> {patient.nome}</div>
            <div><strong>Data de nascimento:</strong> {formatDate(patient.data_nascimento)}</div>
            <div><strong>Idade:</strong> {age(patient.data_nascimento)}</div>
            <div><strong>Sexo:</strong> {patient.sexo || 'Não informado'}</div>
            <div><strong>Escolaridade:</strong> {patient.escolaridade || 'Não informada'}</div>
            <div><strong>Série/Ano:</strong> {patient.serie_ano || 'Não informado'}</div>
            <div><strong>Instituição:</strong> {patient.instituicao || 'Não informada'}</div>
            <div><strong>Lateralidade:</strong> {patient.lateralidade || 'Não informada'}</div>
          </div>
        </ReportSection>

        <ReportSection
          number="2"
          title="Descrição da demanda"
          field="description_demand"
          value={report.description_demand}
          onChange={change}
          placeholder="Descreva a queixa principal, o contexto da solicitação e o objetivo da avaliação."
        />
        <ReportSection
          number="3"
          title="Dados relevantes das escalas"
          field="anamnesis_text"
          value={report.anamnesis_text}
          onChange={change}
        />
        <ReportSection
          number="4"
          title="Procedimento"
          field="procedure_notes"
          value={report.procedure_notes}
          onChange={change}
          placeholder="Informe número de sessões, duração, técnicas e outros procedimentos."
        />
        <ReportSection
          number="5"
          title="Comentários"
          field="comments"
          value={report.comments}
          onChange={change}
          placeholder="Registre comportamento, colaboração, estratégias e observações durante as sessões."
        />
        <ReportSection
          number="6"
          title="Análise dos resultados"
          field="analysis_notes"
          value={report.analysis_notes}
          onChange={change}
        >
          {testResults.filter(result => result.test_code === 'WISC_IV').map((result, index) => (
            <WiscChart key={`wisc-chart-${index}`} result={result} />
          ))}
          {adaptedTestResults.map((adapted, index) => (
            <TestProfileChart
              key={`${adapted.code}-chart-${index}`}
              adapted={adapted}
            />
          ))}
          <h3 style={{ fontSize: 13, margin: '22px 0 8px' }}>
            Resultados dos testes realizados por formulários
          </h3>
          <textarea
            className="report-edit-field"
            value={report.form_results_text}
            rows={8}
            onChange={event => change('form_results_text', event.target.value)}
            style={{
              width: '100%', resize: 'vertical', padding: 12,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface2)', lineHeight: 1.65, fontSize: 13,
            }}
          />
          <div className="report-print-text">
            {report.form_results_text.split('\n').map((paragraph, index) => (
              <p key={`form-result-${index}`} style={{ marginBottom: 8 }}>{paragraph || '\u00a0'}</p>
            ))}
          </div>
        </ReportSection>
        <ReportSection number="7" title="Resumo" field="summary" value={report.summary} onChange={change} />
        <ReportSection
          number="8"
          title="Conclusão"
          field="conclusion"
          value={report.conclusion}
          onChange={change}
          placeholder="Redija a integração clínica e as hipóteses conclusivas após revisar todos os dados."
        />
        <ReportSection
          number="9"
          title="Encaminhamentos"
          field="referrals"
          value={report.referrals}
          onChange={change}
          placeholder="Registre recomendações, encaminhamentos e plano de acompanhamento."
        />

        <footer style={{ marginTop: 46, textAlign: 'center', fontSize: 12 }}>
          <div style={{ width: 280, borderTop: '1px solid #555', margin: '60px auto 8px' }} />
          <strong>{profile?.nome}</strong>
          <div>{profile?.crp ? `CRP ${profile.crp}` : 'Registro profissional não informado'}</div>
        </footer>
        {(branding.footer_line1 || branding.footer_line2) && (
          <div className="report-custom-footer" style={{
            marginTop: 28, paddingTop: 8, borderTop: '1px solid #555',
            color: '#555', fontSize: 10, lineHeight: 1.5, textAlign: 'center',
          }}>
            {branding.footer_line1 && <div>{branding.footer_line1}</div>}
            {branding.footer_line2 && <div>{branding.footer_line2}</div>}
          </div>
        )}
      </article>

      {logoSource && (
        <LogoEditorModal
          source={logoSource}
          onCancel={() => setLogoSource('')}
          onApply={(croppedLogo) => {
            setBranding(current => ({ ...current, logo_data: croppedLogo }));
            setLogoSource('');
            setMessage('Logotipo ajustado. Clique em Salvar para aplicar.');
          }}
        />
      )}
    </div>
  );
}
