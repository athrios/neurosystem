import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  CheckCircle,
  Loader2,
  Lock,
  Save,
} from 'lucide-react';
import { useAuth } from '../App';
import GenericResults from '../components/test-form/GenericResults';
import GenericSection from '../components/test-form/GenericSection';
import {
  createInitialTestValues,
  normalizeTestDefinition,
  validateTestValues,
} from '../lib/generic-test-schema';
import { getTestEngine } from '../lib/test-engine-registry';
import {
  getTestForm,
  getTestResponseLink,
  saveStructuredTestResult,
  updateTestResponseLink,
} from '../lib/test-catalog';
import { respondentLabel } from '../lib/test-response-links';
import { getEvaluation, getTestResult } from '../lib/supabase';

function formatPatientAge(dateOfBirth, applicationDate) {
  if (!dateOfBirth || !applicationDate) return 'idade não informada';
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const application = new Date(`${applicationDate}T00:00:00`);
  let years = application.getFullYear() - birth.getFullYear();
  let months = application.getMonth() - birth.getMonth();
  if (application.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}a ${months}m`;
}

function errorMessage(error, fallback) {
  return error?.message || fallback;
}

export default function GenericTest() {
  const { evalId, formCode } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const responseLinkId = searchParams.get('responseLink');

  const [evaluation, setEvaluation] = useState(null);
  const [form, setForm] = useState(null);
  const [responseLink, setResponseLink] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [computed, setComputed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    load();
  }, [evalId, formCode, responseLinkId]);

  async function load() {
    setLoading(true);
    setPageError('');

    const [evaluationResult, formResult, resultResult, responseLinkResult] = await Promise.all([
      getEvaluation(evalId),
      getTestForm(formCode),
      getTestResult(evalId, formCode),
      responseLinkId
        ? getTestResponseLink(responseLinkId)
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (evaluationResult.error || !evaluationResult.data) {
      setPageError(errorMessage(evaluationResult.error, 'Avaliação não encontrada.'));
      setLoading(false);
      return;
    }
    if (formResult.error || !formResult.data) {
      setPageError(errorMessage(formResult.error, 'Formulário não encontrado no catálogo.'));
      setLoading(false);
      return;
    }
    if (
      responseLinkId
      && (
        responseLinkResult.error
        || !responseLinkResult.data
        || responseLinkResult.data.evaluation_id !== evalId
        || responseLinkResult.data.form_code !== formCode
      )
    ) {
      setPageError('A resposta compartilhada não pertence a este teste ou não está disponível.');
      setLoading(false);
      return;
    }

    const loadedForm = formResult.data;
    if (
      !loadedForm.active
      || !['active', 'testing'].includes(loadedForm.implementation_status)
    ) {
      setPageError('Este formulário ainda não foi liberado para uso clínico.');
      setLoading(false);
      return;
    }
    if (!getTestEngine(loadedForm.engine_key)) {
      setPageError(`O motor "${loadedForm.engine_key || 'não informado'}" não está disponível.`);
      setLoading(false);
      return;
    }

    try {
      const loadedDefinition = normalizeTestDefinition(loadedForm.administration_schema);
      const loadedResponseLink = responseLinkResult.data;
      const savedValues = loadedResponseLink?.responses || resultResult.data?.raw_scores || {};
      const resultBelongsToLink = !loadedResponseLink
        || resultResult.data?.meta?.response_link_id === loadedResponseLink.id;
      setEvaluation(evaluationResult.data);
      setForm(loadedForm);
      setResponseLink(loadedResponseLink);
      setDefinition(loadedDefinition);
      setValues(createInitialTestValues(
        loadedDefinition,
        savedValues
      ));
      setComputed(
        resultBelongsToLink && Object.keys(resultResult.data?.computed_scores || {}).length
          ? resultResult.data.computed_scores
          : null
      );
      setDirty(false);
    } catch (error) {
      setPageError(errorMessage(error, 'A definição do formulário é inválida.'));
    }

    setLoading(false);
  }

  const engine = useMemo(
    () => getTestEngine(form?.engine_key),
    [form?.engine_key]
  );

  function handleChange(fieldId, value) {
    setValues(previous => ({ ...previous, [fieldId]: value }));
    setFieldErrors(previous => {
      if (!previous[fieldId]) return previous;
      const next = { ...previous };
      delete next[fieldId];
      return next;
    });
    setComputed(null);
    setDirty(true);
    setMessage('');
  }

  async function persist(resultStatus, computedScores) {
    setSaving(true);
    setMessage('');
    const result = await saveStructuredTestResult({
      evaluationId: evalId,
      formCode,
      rawScores: values,
      computedScores,
      meta: {
        form_name: form.name,
        data_aplicacao: evaluation.data_aplicacao,
        administration_schema_version: definition.version,
        ...(responseLink ? {
          response_link_id: responseLink.id,
          respondent_type: responseLink.respondent_type,
          respondent_name: responseLink.respondent_name,
          relationship: responseLink.relationship,
          responded_at: responseLink.responded_at,
        } : {}),
      },
      resultStatus,
      resultVersion: form.definition_version,
      scoringEngineVersion: engine.version,
    });
    setSaving(false);

    if (result.error) {
      setMessage(`Não foi possível salvar: ${result.error.message}`);
      return false;
    }

    if (responseLink && resultStatus === 'scored') {
      const reviewResult = await updateTestResponseLink(responseLink.id, {
        status: 'reviewed',
        reviewed_at: new Date().toISOString(),
      });
      if (reviewResult.error) {
        setMessage(`Resultado salvo, mas não foi possível marcar a resposta como revisada: ${reviewResult.error.message}`);
        return false;
      }
      setResponseLink(current => ({ ...current, status: 'reviewed' }));
    }

    setDirty(false);
    setMessage(resultStatus === 'draft' ? 'Rascunho salvo.' : 'Resultado calculado e salvo.');
    return true;
  }

  async function handleSaveDraft() {
    if (!canEdit) return;
    await persist('draft', {});
  }

  async function handleCalculate() {
    if (!canEdit) return;
    const errors = validateTestValues(definition, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setMessage('Revise os campos destacados antes de calcular.');
      const firstField = document.getElementById(Object.keys(errors)[0]);
      firstField?.focus();
      return;
    }

    try {
      const result = engine.calculate(form.scoring_schema, values, {
        patient: evaluation.patients,
        evaluation,
        form,
      });
      setComputed(result);
      await persist('scored', result);
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível calcular o resultado.'));
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text-3)', textAlign: 'center' }}>
        <Loader2 className="anamnesis-spin" size={24} style={{ marginBottom: 8 }} />
        <div>Carregando formulário...</div>
      </div>
    );
  }

  if (pageError || !evaluation || !form || !definition) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760 }}>
        <button
          onClick={() => navigate(`/evaluations/${evalId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 13, marginBottom: 18 }}
        >
          <ArrowLeft size={15} /> Avaliação
        </button>
        <div style={{
          padding: 16, borderRadius: 'var(--radius)',
          color: 'var(--danger)', background: 'var(--danger-bg)',
          border: '1px solid #F7C1C1',
        }}>
          {pageError || 'Formulário indisponível.'}
        </div>
      </div>
    );
  }

  const patient = evaluation.patients;
  const canEdit = evaluation.status !== 'concluida'
    && (profile?.role === 'master' || evaluation.psicologo_id === profile?.id);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1050 }}>
      <button
        onClick={() => navigate(`/evaluations/${evalId}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 13, marginBottom: 14 }}
      >
        <ArrowLeft size={15} /> Avaliação
      </button>

      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 20, marginBottom: 20,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>{form.name}</h1>
            {!canEdit && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, color: 'var(--text-3)',
                padding: '2px 7px', borderRadius: 10, background: 'var(--surface2)',
              }}>
                <Lock size={10} /> somente leitura
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
            {patient?.nome} · {formatPatientAge(
              patient?.data_nascimento,
              evaluation.data_aplicacao
            )}
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
            Aplicação em {new Date(`${evaluation.data_aplicacao}T00:00:00`).toLocaleDateString('pt-BR')}
            {' · '}Definição v{form.definition_version}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSaveDraft}
            disabled={!canEdit || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              color: 'var(--text-2)', background: 'var(--surface)',
              border: '1px solid var(--border)', opacity: !canEdit || saving ? 0.5 : 1,
            }}
          >
            {saving ? <Loader2 className="anamnesis-spin" size={14} /> : <Save size={14} />}
            Salvar rascunho
          </button>
          <button
            onClick={handleCalculate}
            disabled={!canEdit || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 13px', borderRadius: 8,
              color: '#fff', background: 'var(--accent)',
              opacity: !canEdit || saving ? 0.5 : 1,
            }}
          >
            {saving ? <Loader2 className="anamnesis-spin" size={14} /> : <Calculator size={14} />}
            Calcular e salvar
          </button>
        </div>
      </header>

      {definition.instructions && (
        <div style={{
          padding: '12px 15px', marginBottom: 16,
          borderRadius: 9, background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          color: 'var(--text-2)', fontSize: 12, whiteSpace: 'pre-wrap',
        }}>
          {definition.instructions}
        </div>
      )}

      {form.implementation_status === 'testing' && (
        <div style={{
          padding: '12px 15px', marginBottom: 16,
          borderRadius: 9, background: 'var(--warning-bg)',
          border: '1px solid #FAC775',
          color: 'var(--warning)', fontSize: 12, fontWeight: 500,
        }}>
          Formulário em validação. Não utilize este resultado para finalidade clínica.
        </div>
      )}

      {responseLink && (
        <div style={{
          padding: '12px 15px', marginBottom: 16,
          borderRadius: 9, background: 'var(--success-bg)',
          border: '1px solid #9FE1CB',
          color: 'var(--text-2)', fontSize: 12,
        }}>
          <strong>Resposta compartilhada:</strong> {responseLink.respondent_name}
          {' · '}{respondentLabel(responseLink.respondent_type)}
          {responseLink.relationship ? ` · ${responseLink.relationship}` : ''}
          {responseLink.status === 'reviewed' ? ' · revisada' : ' · aguardando revisão'}
        </div>
      )}

      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 12px', marginBottom: 14, borderRadius: 8,
          color: message.includes('salv') && !message.includes('Não')
            ? 'var(--success)'
            : 'var(--warning)',
          background: message.includes('salv') && !message.includes('Não')
            ? 'var(--success-bg)'
            : 'var(--warning-bg)',
          fontSize: 12,
        }}>
          {!message.includes('Não') && !message.includes('Revise') && <CheckCircle size={13} />}
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GenericResults result={computed} />
        {definition.sections.map(section => (
          <GenericSection
            key={section.id}
            section={section}
            values={values}
            errors={fieldErrors}
            onChange={handleChange}
            disabled={!canEdit || saving}
          />
        ))}
      </div>

      {dirty && canEdit && (
        <p style={{ marginTop: 10, fontSize: 11, color: 'var(--warning)', textAlign: 'right' }}>
          Existem alterações ainda não salvas.
        </p>
      )}
    </div>
  );
}
