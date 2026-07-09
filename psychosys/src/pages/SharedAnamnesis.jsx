import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Keyboard, Loader2,
} from 'lucide-react';
import {
  getSharedAnamnesis, saveSharedAnamnesisDraft, submitSharedAnamnesis,
} from '../lib/supabase';

function hasAnswer(question, value) {
  if (!question.required) return true;
  if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function BrandLogo({ form, compact = false }) {
  const justify = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  }[form?.logo_alignment] || 'center';

  if (!form?.logo_data) {
    return <div style={{ color: 'var(--accent)', fontWeight: 650, fontSize: 14 }}>Lluria</div>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: justify, width: '100%' }}>
      <img
        src={form.logo_data}
        alt="Logotipo"
        style={{
          maxWidth: compact ? 150 : 240,
          maxHeight: compact ? 42 : 90,
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

function BrandFooter({ form }) {
  if (!form?.footer_line1 && !form?.footer_line2) return null;
  return (
    <div style={{ color: 'var(--text-3)', fontSize: 10, lineHeight: 1.45, textAlign: 'center' }}>
      {form.footer_line1 && <div>{form.footer_line1}</div>}
      {form.footer_line2 && <div>{form.footer_line2}</div>}
    </div>
  );
}

function QuestionInput({ question, value, onChange }) {
  const fieldStyle = {
    width: '100%',
    padding: '14px 4px',
    border: 'none',
    borderBottom: '2px solid var(--accent-border)',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 20,
  };

  if (question.type === 'textarea') {
    return (
      <div>
        <textarea
          autoFocus
          value={value || ''}
          rows={5}
          placeholder="Digite sua resposta..."
          onChange={event => onChange(event.target.value)}
          style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.55 }}
        />
        <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 11 }}>
          Pressione Ctrl + Enter para continuar
        </div>
      </div>
    );
  }

  if (question.type === 'text' || question.type === 'date') {
    return (
      <input
        autoFocus
        type={question.type === 'date' ? 'date' : 'text'}
        value={value || ''}
        placeholder={question.type === 'text' ? 'Digite sua resposta...' : undefined}
        onChange={event => onChange(event.target.value)}
        style={fieldStyle}
      />
    );
  }

  const selected = question.type === 'multi' && Array.isArray(value) ? value : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {(question.options || []).map((option, index) => {
        const checked = question.type === 'multi'
          ? selected.includes(option)
          : value === option;
        return (
          <label
            key={option}
            className="anamnesis-option"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              background: checked ? 'var(--accent-bg)' : 'var(--surface)',
              cursor: 'pointer',
              transition: 'border-color .15s ease, background .15s ease, transform .15s ease',
            }}
          >
            <span style={{
              width: 25,
              height: 25,
              borderRadius: 6,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
              background: checked ? 'var(--accent)' : 'var(--surface2)',
              color: checked ? '#fff' : 'var(--text-2)',
              fontSize: 11,
              fontWeight: 600,
            }}>
              {checked ? <Check size={14} /> : index + 1}
            </span>
            <input
              type={question.type === 'multi' ? 'checkbox' : 'radio'}
              name={question.id}
              value={option}
              checked={checked}
              onChange={() => {
                if (question.type === 'multi') {
                  onChange(
                    checked
                      ? selected.filter(item => item !== option)
                      : [...selected, option],
                  );
                } else {
                  onChange(option, true);
                }
              }}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <span style={{ paddingTop: 2, fontSize: 15, lineHeight: 1.45 }}>{option}</span>
          </label>
        );
      })}
      <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
        {question.type === 'multi'
          ? 'Você pode selecionar mais de uma opção. Pressione Enter para continuar.'
          : 'Use as teclas numéricas ou clique em uma opção.'}
      </div>
    </div>
  );
}

export default function SharedAnamnesis() {
  const token = window.location.pathname.split('/').filter(Boolean).pop();
  const headingRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  const hydratedRef = useRef(false);
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('idle');

  const steps = useMemo(() => (
    form?.questions?.flatMap((section, sectionIndex) => (
      section.questions.map((question, questionIndex) => ({
        ...question,
        sectionTitle: section.title,
        sectionIndex,
        questionIndex,
      }))
    )) || []
  ), [form]);

  const currentQuestion = steps[currentStep];
  const progress = steps.length ? ((currentStep + 1) / steps.length) * 100 : 0;
  const patientFirstName = form?.patient_nome?.split(' ')[0] || '';
  const answeredCount = steps.filter(question => hasAnswer(
    { ...question, required: true },
    responses[question.id],
  )).length;

  useEffect(() => {
    getSharedAnamnesis(token).then(({ data, error: loadError }) => {
      if (loadError || !data) {
        setError('Este link não é válido ou não está mais disponível.');
      } else {
        const totalQuestions = data.questions?.reduce(
          (total, section) => total + section.questions.length,
          0,
        ) || 0;
        setForm(data);
        setResponses(data.responses || {});
        setCurrentStep(Math.min(
          Math.max(Number(data.current_step) || 0, 0),
          Math.max(totalQuestions - 1, 0),
        ));
      }
      hydratedRef.current = true;
      setLoading(false);
    });
  }, [token]);

  useEffect(() => () => clearTimeout(autoAdvanceRef.current), []);

  useEffect(() => {
    if (!started || !hydratedRef.current || !form || form.status !== 'compartilhada') return undefined;

    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      const { data, error: saveError } = await saveSharedAnamnesisDraft(
        token,
        responses,
        currentStep,
      );
      setSaveState(!saveError && data ? 'saved' : 'error');
    }, 650);

    return () => window.clearTimeout(timer);
  }, [currentStep, form, responses, started, token]);

  useEffect(() => {
    if (!started) return;
    if (['text', 'textarea', 'date'].includes(currentQuestion?.type)) return;
    const timer = window.setTimeout(() => headingRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [currentQuestion?.type, currentStep, started]);

  const goBack = useCallback(() => {
    clearTimeout(autoAdvanceRef.current);
    setError('');
    setCurrentStep(step => Math.max(step - 1, 0));
  }, []);

  const submit = useCallback(async () => {
    const missing = steps.find(question => !hasAnswer(question, responses[question.id]));
    if (missing) {
      const missingIndex = steps.findIndex(question => question.id === missing.id);
      setCurrentStep(missingIndex);
      setError('Responda esta pergunta antes de enviar.');
      return;
    }

    setSending(true);
    setError('');
    const { data, error: submitError } = await submitSharedAnamnesis(token, responses);
    setSending(false);
    if (submitError || !data) {
      setError('Não foi possível enviar as respostas. Tente novamente.');
      return;
    }
    setSent(true);
  }, [responses, steps, token]);

  const goNext = useCallback(() => {
    if (!currentQuestion) return;
    if (!hasAnswer(currentQuestion, responses[currentQuestion.id])) {
      setError('Esta pergunta precisa ser respondida.');
      return;
    }
    setError('');
    if (currentStep === steps.length - 1) {
      submit();
      return;
    }
    setCurrentStep(step => Math.min(step + 1, steps.length - 1));
  }, [currentQuestion, currentStep, responses, steps.length, submit]);

  const setAnswer = useCallback((value, autoAdvance = false) => {
    if (!currentQuestion) return;
    setResponses(current => ({ ...current, [currentQuestion.id]: value }));
    setError('');
    clearTimeout(autoAdvanceRef.current);
    if (autoAdvance && currentStep < steps.length - 1) {
      autoAdvanceRef.current = window.setTimeout(() => {
        setCurrentStep(step => Math.min(step + 1, steps.length - 1));
      }, 260);
    }
  }, [currentQuestion, currentStep, steps.length]);

  useEffect(() => {
    if (!started || !currentQuestion) return undefined;

    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTextarea = tag === 'textarea';
      const isTextField = tag === 'input' && !['radio', 'checkbox'].includes(document.activeElement?.type);

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
        && optionIndex < (currentQuestion.options?.length || 0)
      ) {
        event.preventDefault();
        const option = currentQuestion.options[optionIndex];
        if (currentQuestion.type === 'multi') {
          const selected = Array.isArray(responses[currentQuestion.id])
            ? responses[currentQuestion.id]
            : [];
          setAnswer(
            selected.includes(option)
              ? selected.filter(item => item !== option)
              : [...selected, option],
          );
        } else {
          setAnswer(option, true);
        }
        return;
      }

      if (
        ['ArrowUp', 'ArrowDown'].includes(event.key)
        && currentQuestion.type === 'single'
        && currentQuestion.options?.length
      ) {
        event.preventDefault();
        const selectedIndex = currentQuestion.options.indexOf(responses[currentQuestion.id]);
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = Math.min(
          Math.max(selectedIndex + direction, 0),
          currentQuestion.options.length - 1,
        );
        setAnswer(currentQuestion.options[nextIndex]);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        goNext();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, goBack, goNext, responses, setAnswer, started]);

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

  if (sent) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="anamnesis-step" style={{ maxWidth: 540, textAlign: 'center' }}>
          <BrandLogo form={form} />
          <div style={{
            width: 68, height: 68, borderRadius: '50%', margin: '0 auto',
            display: 'grid', placeItems: 'center', background: 'var(--success-bg)',
          }}>
            <CheckCircle2 size={36} color="var(--success)" />
          </div>
          <h1 style={{ fontSize: 28, marginTop: 20 }}>Tudo pronto, {patientFirstName}.</h1>
          <p style={{ color: 'var(--text-2)', marginTop: 9, fontSize: 16 }}>
            Suas respostas foram enviadas ao profissional responsável.
          </p>
        </div>
      </main>
    );
  }

  if (!started) {
    const estimatedMinutes = Math.max(2, Math.ceil(steps.length * 0.35));
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="anamnesis-step" style={{ width: '100%', maxWidth: 660 }}>
          <BrandLogo form={form} />
          <h1 style={{ marginTop: 20, fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.15 }}>
            {form.nome}
          </h1>
          <p style={{ color: 'var(--text-2)', marginTop: 14, fontSize: 17, lineHeight: 1.6 }}>
            Olá, {patientFirstName}. Responda com tranquilidade: será apresentada uma pergunta por vez
            e seu progresso ficará salvo automaticamente.
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
          {answeredCount > 0 && (
            <div style={{
              marginTop: 20, padding: '10px 12px', borderRadius: 8,
              background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 13,
            }}>
              Encontramos {answeredCount} resposta{answeredCount !== 1 ? 's' : ''} salva{answeredCount !== 1 ? 's' : ''}.
              Você continuará do ponto em que parou.
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
            {answeredCount > 0 ? 'Continuar preenchimento' : 'Começar'}
            <ArrowRight size={17} />
          </button>
          <p style={{ marginTop: 10, color: 'var(--text-3)', fontSize: 11 }}>
            Pressione Enter para avançar
          </p>
          <div style={{ marginTop: 30 }}>
            <BrandFooter form={form} />
          </div>
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
          <div style={{ width: 170 }}>
            <BrandLogo form={form} compact />
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
        <section key={currentQuestion.id} className="anamnesis-step">
          <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            {currentQuestion.sectionTitle}
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
                {currentQuestion.label}
                {currentQuestion.required && <span style={{ color: 'var(--danger)' }}> *</span>}
              </h1>
              <QuestionInput
                question={currentQuestion}
                value={responses[currentQuestion.id]}
                onChange={setAnswer}
              />

              {error && (
                <div
                  role="alert"
                  style={{
                    marginTop: 14, padding: '9px 11px', borderRadius: 8,
                    background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12,
                  }}
                >
                  {error}
                </div>
              )}

              {(currentQuestion.type !== 'single' || currentStep === steps.length - 1) && (
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
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '12px 22px', borderTop: '1px solid var(--border)',
        background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(8px)',
      }}>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
          {currentStep + 1} de {steps.length}
        </span>
        <BrandFooter form={form} />
        <div style={{ display: 'flex', gap: 5, justifySelf: 'end' }}>
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
