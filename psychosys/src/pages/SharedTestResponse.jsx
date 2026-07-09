import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Keyboard,
  Loader2,
} from 'lucide-react';
import {
  getSharedTestResponse,
  saveSharedTestResponseDraft,
  submitSharedTestResponse,
} from '../lib/test-catalog';
import {
  createInitialTestValues,
  normalizeTestDefinition,
  validateTestValues,
} from '../lib/generic-test-schema';
import {
  applyRespondentIdentity,
  createPublicTestDefinition,
  respondentLabel,
} from '../lib/test-response-links';

function hasAnswer(field, value) {
  if (!field.required) return true;
  if (field.type === 'checkbox') return value === true;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function PublicField({ field, value, onChange }) {
  const inputStyle = {
    width: '100%',
    padding: '14px 4px',
    border: 'none',
    borderBottom: '2px solid var(--accent-border)',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 20,
  };

  if (field.type === 'radio' || field.type === 'select') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {field.options.map((option, index) => {
          const selected = String(value ?? '') === option.value;
          return (
            <label
              key={option.value}
              className="anamnesis-option"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                background: selected ? 'var(--accent-bg)' : 'var(--surface)',
                transition: 'border-color .15s ease, background .15s ease, transform .15s ease',
              }}
            >
              <span style={{
                width: 25, height: 25, borderRadius: 6, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: selected ? 'var(--accent)' : 'var(--surface2)',
                color: selected ? '#fff' : 'var(--text-2)',
                fontSize: 11, fontWeight: 600,
              }}>
                {selected ? <Check size={14} /> : index + 1}
              </span>
              <input
                type="radio"
                name={field.id}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value, true)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
              <span style={{ paddingTop: 2, fontSize: 15, lineHeight: 1.45 }}>
                {option.label}
              </span>
            </label>
          );
        })}
        <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
          Use as teclas numéricas ou clique em uma opção.
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 14, border: '1px solid var(--border)',
        borderRadius: 10, cursor: 'pointer',
      }}>
        <input
          autoFocus
          type="checkbox"
          checked={value === true}
          onChange={event => onChange(event.target.checked)}
        />
        <span>Confirmo</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        autoFocus
        value={value ?? ''}
        rows={5}
        placeholder={field.placeholder || 'Digite sua resposta...'}
        onChange={event => onChange(event.target.value)}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
      />
    );
  }

  return (
    <input
      autoFocus
      type={field.type}
      value={value ?? ''}
      placeholder={field.placeholder || (field.type === 'text' ? 'Digite sua resposta...' : undefined)}
      min={field.type === 'number' && field.min !== null ? field.min : undefined}
      max={field.type === 'number' && field.max !== null ? field.max : undefined}
      step={field.type === 'number' ? field.step : undefined}
      onChange={event => onChange(event.target.value)}
      style={inputStyle}
    />
  );
}

export default function SharedTestResponse() {
  const { token } = useParams();
  const headingRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  const hydratedRef = useRef(false);
  const [form, setForm] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('idle');

  const steps = useMemo(() => (
    definition?.sections.flatMap(section => (
      section.fields.map(field => ({
        ...field,
        sectionTitle: section.title,
      }))
    )) || []
  ), [definition]);

  const currentField = steps[currentStep];
  const progress = steps.length ? ((currentStep + 1) / steps.length) * 100 : 0;

  useEffect(() => {
    let active = true;
    getSharedTestResponse(token).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !data) {
        setError('Este link não é válido ou não está mais disponível.');
        setLoading(false);
        return;
      }

      try {
        const normalized = normalizeTestDefinition(data.administration_schema);
        const publicDefinition = createPublicTestDefinition(normalized, {
          requireRespondentName: !data.respondent_name,
        });
        const identifiedResponses = applyRespondentIdentity(data.responses, data);
        const initialValues = createInitialTestValues(normalized, identifiedResponses);
        const publicFieldCount = publicDefinition.sections.reduce(
          (total, section) => total + section.fields.length,
          0,
        );

        setForm(data);
        setDefinition(publicDefinition);
        setResponses(initialValues);
        setCurrentStep(Math.min(
          Math.max(Number(data.current_step) || 0, 0),
          Math.max(publicFieldCount - 1, 0),
        ));
        setSent(data.status === 'submitted');
      } catch {
        setError('O formulário deste teste está indisponível.');
      }
      hydratedRef.current = true;
      setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => () => clearTimeout(autoAdvanceRef.current), []);

  useEffect(() => {
    if (!started || !hydratedRef.current || !form || sent) return undefined;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      const identified = applyRespondentIdentity(responses, form);
      const { data, error: saveError } = await saveSharedTestResponseDraft(
        token,
        identified,
        currentStep,
      );
      setSaveState(!saveError && data === true ? 'saved' : 'error');
    }, 650);
    return () => window.clearTimeout(timer);
  }, [currentStep, form, responses, sent, started, token]);

  useEffect(() => {
    if (!started || !currentField || !['radio', 'select'].includes(currentField.type)) return;
    const timer = window.setTimeout(() => headingRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [currentField, currentStep, started]);

  const goBack = useCallback(() => {
    clearTimeout(autoAdvanceRef.current);
    setError('');
    setCurrentStep(step => Math.max(step - 1, 0));
  }, []);

  const submit = useCallback(async () => {
    const validationErrors = validateTestValues(definition, responses);
    const missingId = Object.keys(validationErrors)[0];
    if (missingId) {
      setCurrentStep(steps.findIndex(field => field.id === missingId));
      setError('Responda esta pergunta antes de enviar.');
      return;
    }

    setSending(true);
    setError('');
    const identified = applyRespondentIdentity(responses, form);
    const { data, error: submitError } = await submitSharedTestResponse(token, identified);
    setSending(false);
    if (submitError || data !== true) {
      setError('Não foi possível enviar as respostas. Tente novamente.');
      return;
    }
    setSent(true);
  }, [definition, form, responses, steps, token]);

  const goNext = useCallback(() => {
    if (!currentField) return;
    if (!hasAnswer(currentField, responses[currentField.id])) {
      setError('Esta pergunta precisa ser respondida.');
      return;
    }
    setError('');
    if (currentStep === steps.length - 1) {
      submit();
      return;
    }
    setCurrentStep(step => Math.min(step + 1, steps.length - 1));
  }, [currentField, currentStep, responses, steps.length, submit]);

  const setAnswer = useCallback((value, autoAdvance = false) => {
    if (!currentField) return;
    setResponses(current => ({ ...current, [currentField.id]: value }));
    setError('');
    clearTimeout(autoAdvanceRef.current);
    if (autoAdvance && currentStep < steps.length - 1) {
      autoAdvanceRef.current = window.setTimeout(() => {
        setCurrentStep(step => Math.min(step + 1, steps.length - 1));
      }, 260);
    }
  }, [currentField, currentStep, steps.length]);

  useEffect(() => {
    if (!started || !currentField) return undefined;

    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTextarea = tag === 'textarea';
      const isTextField = tag === 'input'
        && !['radio', 'checkbox'].includes(document.activeElement?.type);

      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        goBack();
        return;
      }
      if (isTextarea && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        goNext();
        return;
      }
      if (isTextField && event.key === 'Enter') {
        event.preventDefault();
        goNext();
        return;
      }
      if (isTextarea || isTextField) return;

      const optionIndex = Number(event.key) - 1;
      if (
        Number.isInteger(optionIndex)
        && optionIndex >= 0
        && optionIndex < (currentField.options?.length || 0)
      ) {
        event.preventDefault();
        setAnswer(currentField.options[optionIndex].value, true);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        goNext();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentField, goBack, goNext, setAnswer, started]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        <Loader2 className="anamnesis-spin" size={28} /> Carregando formulário...
      </div>
    );
  }

  if (error && !form) {
    return (
      <div style={{ maxWidth: 560, margin: '70px auto', padding: 28, textAlign: 'center' }}>
        <h1 style={{ fontSize: 18 }}>Formulário indisponível</h1>
        <p style={{ marginTop: 8, color: 'var(--text-2)' }}>{error}</p>
      </div>
    );
  }

  const displayRespondentName = form?.respondent_name || responses.respondent_name || 'respondente';

  if (sent) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="anamnesis-step" style={{ maxWidth: 540, textAlign: 'center' }}>
          <div style={{ color: 'var(--accent)', fontWeight: 650, fontSize: 14 }}>Lluria</div>
          <div style={{
            width: 68, height: 68, borderRadius: '50%', margin: '28px auto 0',
            display: 'grid', placeItems: 'center', background: 'var(--success-bg)',
          }}>
            <CheckCircle2 size={36} color="var(--success)" />
          </div>
          <h1 style={{ fontSize: 28, marginTop: 20 }}>Respostas enviadas.</h1>
          <p style={{ color: 'var(--text-2)', marginTop: 9, fontSize: 16 }}>
            Obrigado, {displayRespondentName}. O profissional responsável já pode revisar o formulário.
          </p>
        </div>
      </main>
    );
  }

  if (!started) {
    const estimatedMinutes = Math.max(2, Math.ceil(steps.length * 0.3));
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="anamnesis-step" style={{ width: '100%', maxWidth: 660 }}>
          <div style={{ color: 'var(--accent)', fontWeight: 650, fontSize: 14 }}>Lluria</div>
          <h1 style={{ marginTop: 20, fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.15 }}>
            {form.form_name}
          </h1>
          <p style={{ color: 'var(--text-2)', marginTop: 14, fontSize: 17, lineHeight: 1.6 }}>
            Olá, {displayRespondentName}. Este formulário se refere a {form.patient_name}.
            Você foi identificado como {respondentLabel(form.respondent_type).toLowerCase()}
            {form.relationship ? ` (${form.relationship})` : ''}.
          </p>
          <p style={{ color: 'var(--text-2)', marginTop: 10, fontSize: 14, lineHeight: 1.55 }}>
            Será apresentada uma pergunta por vez e o progresso ficará salvo automaticamente.
          </p>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24,
            color: 'var(--text-3)', fontSize: 13,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock3 size={15} /> aproximadamente {estimatedMinutes} min
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Keyboard size={15} /> navegação por teclado
            </span>
          </div>
          {form.implementation_status === 'testing' && (
            <div style={{
              marginTop: 20, padding: '10px 12px', borderRadius: 8,
              background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12,
            }}>
              Formulário em validação interna.
            </div>
          )}
          <button
            type="button"
            onClick={() => setStarted(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 28, padding: '12px 20px', borderRadius: 9,
              background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600,
            }}
          >
            Começar <ArrowRight size={17} />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '18px 22px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 10,
        }}>
          <div style={{ color: 'var(--accent)', fontWeight: 650, fontSize: 13 }}>
            {form.form_name}
          </div>
          <span aria-live="polite" style={{ color: 'var(--text-3)', fontSize: 11 }}>
            {saveState === 'saving' && 'Salvando...'}
            {saveState === 'saved' && 'Progresso salvo'}
            {saveState === 'error' && 'Não foi possível salvar agora'}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress)}
          style={{ height: 4, borderRadius: 4, background: 'var(--border)' }}
        >
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 4,
            background: 'var(--accent)', transition: 'width .3s ease',
          }} />
        </div>
      </header>

      <div style={{
        flex: 1, width: '100%', maxWidth: 760,
        margin: '0 auto', padding: 'clamp(34px, 8vh, 80px) 24px 40px',
      }}>
        <section key={currentField.id} className="anamnesis-step">
          <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            {currentField.sectionTitle}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--text-3)', fontSize: 13, paddingTop: 7 }}>
              {currentStep + 1} →
            </span>
            <div style={{ flex: 1 }}>
              <h1
                ref={headingRef}
                tabIndex="-1"
                style={{
                  outline: 'none', fontSize: 'clamp(22px, 4vw, 31px)',
                  lineHeight: 1.3, fontWeight: 600, marginBottom: 25,
                }}
              >
                {currentField.label}
                {currentField.required && <span style={{ color: 'var(--danger)' }}> *</span>}
              </h1>
              <PublicField
                field={currentField}
                value={responses[currentField.id]}
                onChange={setAnswer}
              />

              {error && (
                <div role="alert" style={{
                  marginTop: 14, padding: '9px 11px', borderRadius: 8,
                  background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12,
                }}>
                  {error}
                </div>
              )}

              {(!['radio', 'select'].includes(currentField.type)
                || currentStep === steps.length - 1) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={sending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '10px 16px', borderRadius: 8,
                      background: 'var(--accent)', color: '#fff', fontWeight: 600,
                    }}
                  >
                    {sending && <Loader2 className="anamnesis-spin" size={15} />}
                    {currentStep === steps.length - 1 ? 'Enviar respostas' : 'Continuar'}
                    {!sending && <ArrowRight size={15} />}
                  </button>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                    pressione Enter ↵
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer style={{
        display: 'grid', gridTemplateColumns: '1fr auto',
        alignItems: 'center', padding: '12px 22px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(8px)',
      }}>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
          {currentStep + 1} de {steps.length}
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0}
            aria-label="Pergunta anterior"
            style={{
              width: 36, height: 32, display: 'grid', placeItems: 'center',
              borderRadius: 7, border: '1px solid var(--border)',
              color: currentStep === 0 ? 'var(--text-3)' : 'var(--accent)',
            }}
          >
            <ArrowLeft size={15} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={sending}
            aria-label="Próxima pergunta"
            style={{
              width: 36, height: 32, display: 'grid', placeItems: 'center',
              borderRadius: 7, background: 'var(--accent)', color: '#fff',
            }}
          >
            <ArrowRight size={15} />
          </button>
        </div>
      </footer>
    </main>
  );
}
