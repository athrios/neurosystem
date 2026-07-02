import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, Clipboard, FilePlus2,
  GripVertical, Plus, Save, Send, Trash2,
} from 'lucide-react';
import { useAuth } from '../App';
import {
  createAnamnesis, getAnamnesis, getPatient, updateAnamnesis,
} from '../lib/supabase';
import {
  ANAMNESIS_TEMPLATES, cloneTemplate, countTemplateQuestions,
} from '../data/anamnesisTemplates';

const QUESTION_TYPES = [
  ['single', 'Escolha única'],
  ['multi', 'Múltiplas escolhas'],
  ['text', 'Resposta curta'],
  ['textarea', 'Resposta longa'],
  ['date', 'Data'],
];

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraft() {
  return {
    key: null,
    name: 'Nova escala',
    description: 'Questionário personalizado.',
    sections: [{
      id: newId('section'),
      title: 'Perguntas',
      questions: [{
        id: newId('question'),
        type: 'textarea',
        label: 'Digite a pergunta',
        required: false,
        options: [],
      }],
    }],
  };
}

function QuestionEditor({ question, number, response, onChange, onRemove, onMoveUp, onMoveDown }) {
  const hasOptions = question.type === 'single' || question.type === 'multi';
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10,
      background: 'var(--surface)', padding: 14,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <GripVertical size={16} color="var(--text-3)" style={{ marginTop: 9, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 10 }}>
            <textarea
              aria-label={`Pergunta ${number}`}
              value={question.label}
              rows={2}
              onChange={event => onChange({ ...question, label: event.target.value })}
              style={{
                width: '100%', resize: 'vertical', padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 8, lineHeight: 1.4,
              }}
            />
            <select
              value={question.type}
              onChange={event => onChange({
                ...question,
                type: event.target.value,
                options: ['single', 'multi'].includes(event.target.value)
                  ? question.options
                  : [],
              })}
              style={{
                height: 38, padding: '0 9px',
                border: '1px solid var(--border)', borderRadius: 8,
              }}
            >
              {QUESTION_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {hasOptions && (
            <label style={{ display: 'block', marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
              Opções — uma por linha
              <textarea
                value={(question.options || []).join('\n')}
                rows={Math.min(6, Math.max(2, question.options?.length || 2))}
                onChange={event => onChange({
                  ...question,
                  options: event.target.value.split('\n').filter(Boolean),
                })}
                style={{
                  display: 'block', width: '100%', resize: 'vertical',
                  marginTop: 4, padding: '8px 10px',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}
              />
            </label>
          )}

          {response !== undefined && (
            <div style={{
              marginTop: 10, padding: '9px 11px', borderRadius: 8,
              background: 'var(--success-bg)', color: 'var(--text)', fontSize: 12,
            }}>
              <strong>Resposta:</strong>{' '}
              {Array.isArray(response) ? response.join('; ') : String(response || 'Não respondida')}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginTop: 10,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={question.required}
                onChange={event => onChange({ ...question, required: event.target.checked })}
              />
              Obrigatória
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={onMoveUp} aria-label="Mover pergunta para cima" title="Mover para cima">
                <ChevronUp size={16} />
              </button>
              <button type="button" onClick={onMoveDown} aria-label="Mover pergunta para baixo" title="Mover para baixo">
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remover pergunta"
                title="Remover"
                style={{ color: 'var(--danger)', marginLeft: 4 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnamnesisEditor() {
  const { patientId, anamnesisId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [draft, setDraft] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(anamnesisId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    async function load() {
      if (anamnesisId) {
        const { data, error: loadError } = await getAnamnesis(anamnesisId);
        if (loadError) {
          setError(loadError.message);
        } else {
          setRecord(data);
          setPatient({ id: data.patient_id, nome: data.patients?.nome });
          if (data.status !== 'rascunho') {
            setShareLink(`${window.location.origin}/escala/${data.share_token}`);
          }
          setDraft({
            key: data.template_key,
            name: data.nome,
            description: '',
            sections: data.questions || [],
          });
        }
        setLoading(false);
        return;
      }

      const { data } = await getPatient(patientId);
      setPatient(data);
    }
    load();
  }, [anamnesisId, patientId]);

  const questionCount = useMemo(
    () => draft?.sections.reduce((total, section) => total + section.questions.length, 0) || 0,
    [draft],
  );

  function chooseTemplate(template) {
    const copy = cloneTemplate(template);
    setDraft(copy);
    setMessage('');
  }

  function updateSection(sectionIndex, changes) {
    setDraft(current => ({
      ...current,
      sections: current.sections.map((section, index) => (
        index === sectionIndex ? { ...section, ...changes } : section
      )),
    }));
  }

  function updateQuestion(sectionIndex, questionIndex, question) {
    const section = draft.sections[sectionIndex];
    updateSection(sectionIndex, {
      questions: section.questions.map((item, index) => (
        index === questionIndex ? question : item
      )),
    });
  }

  function moveQuestion(sectionIndex, questionIndex, direction) {
    const section = draft.sections[sectionIndex];
    const target = questionIndex + direction;
    if (target < 0 || target >= section.questions.length) return;
    const questions = [...section.questions];
    [questions[questionIndex], questions[target]] = [questions[target], questions[questionIndex]];
    updateSection(sectionIndex, { questions });
  }

  function addQuestion(sectionIndex) {
    const section = draft.sections[sectionIndex];
    updateSection(sectionIndex, {
      questions: [...section.questions, {
        id: newId('question'),
        type: 'textarea',
        label: 'Nova pergunta',
        required: false,
        options: [],
      }],
    });
  }

  function addSection() {
    setDraft(current => ({
      ...current,
      sections: [...current.sections, {
        id: newId('section'),
        title: 'Nova seção',
        questions: [],
      }],
    }));
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('Informe um nome para a escala.');
      return null;
    }
    if (!questionCount) {
      setError('Inclua pelo menos uma pergunta.');
      return null;
    }

    setSaving(true);
    setError('');
    const payload = {
      nome: draft.name.trim(),
      template_key: draft.key,
      questions: draft.sections,
    };
    const result = record
      ? await updateAnamnesis(record.id, payload)
      : await createAnamnesis({
        ...payload,
        patient_id: patient.id,
        psicologo_id: profile.id,
      });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return null;
    }

    setRecord(result.data);
    setMessage('Escala salva.');
    if (!anamnesisId) navigate(`/escalas/${result.data.id}`, { replace: true });
    return result.data;
  }

  async function share() {
    const saved = await save();
    if (!saved) return;
    const shareUpdates = {
      shared_at: saved.shared_at || new Date().toISOString(),
    };
    if (saved.status === 'rascunho') shareUpdates.status = 'compartilhada';
    const { data, error: updateError } = await updateAnamnesis(saved.id, shareUpdates);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setRecord(data);
    const link = `${window.location.origin}/escala/${data.share_token}`;
    setShareLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link de preenchimento copiado.');
    } catch {
      setMessage('Link criado. Use o botão Copiar link abaixo.');
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setMessage('Link de preenchimento copiado.');
    } catch {
      setMessage('Selecione e copie o link exibido.');
    }
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-3)' }}>Carregando escala...</div>;
  }

  if (!draft) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        <button
          onClick={() => navigate(`/patients/${patientId}`)}
          style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-2)', fontSize: 13 }}
        >
          <ArrowLeft size={15} /> {patient?.nome || 'Paciente'}
        </button>

        <div style={{ margin: '24px 0' }}>
          <h1 style={{ fontSize: 22, fontWeight: 650 }}>Nova escala</h1>
          <p style={{ color: 'var(--text-2)', marginTop: 4 }}>
            Escolha um modelo mapeado ou comece um questionário do zero.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {ANAMNESIS_TEMPLATES.map(template => (
            <button
              type="button"
              key={template.key}
              onClick={() => chooseTemplate(template)}
              style={{
                textAlign: 'left', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 12, padding: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{template.shortName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {countTemplateQuestions(template)} perguntas · {template.sections.length} seções
                  </div>
                </div>
                <Clipboard size={20} color="var(--accent)" />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 12 }}>
                {template.description}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                {template.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '3px 7px', borderRadius: 20,
                    background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 10,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            style={{
              textAlign: 'left', background: 'transparent',
              border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 18,
              minHeight: 150,
            }}
          >
            <FilePlus2 size={22} color="var(--accent)" />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>Criar nova</div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              Monte um questionário personalizado desde o início.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px 60px', maxWidth: 1050 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 18, marginBottom: 20,
      }}>
        <button
          onClick={() => record
            ? navigate(`/patients/${record.patient_id}`)
            : setDraft(null)}
          style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-2)', fontSize: 13 }}
        >
          <ArrowLeft size={15} /> {record ? patient?.nome : 'Modelos'}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: '1px solid var(--border)',
              background: 'var(--surface)', borderRadius: 8, fontSize: 12,
            }}
          >
            <Save size={14} /> {saving ? 'Salvando...' : record ? 'Salvar' : 'Criar escala'}
          </button>
          <button
            type="button"
            onClick={share}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: 'var(--accent)',
              color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 500,
            }}
          >
            <Send size={14} /> {record ? 'Compartilhar link' : 'Salvar e compartilhar'}
          </button>
        </div>
      </div>

      {(message || error) && (
        <div style={{
          padding: '9px 12px', marginBottom: 14, borderRadius: 8,
          background: error ? 'var(--danger-bg)' : 'var(--success-bg)',
          color: error ? 'var(--danger)' : 'var(--success)', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          {!error && <Check size={14} />} {error || message}
        </div>
      )}

      {shareLink && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: 12, marginBottom: 14, borderRadius: 9,
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
        }}>
          <input
            readOnly
            value={shareLink}
            onFocus={event => event.target.select()}
            aria-label="Link público da escala"
            style={{
              minWidth: 0, flex: 1, padding: '8px 9px',
              border: '1px solid var(--accent-border)', borderRadius: 7,
              background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={copyShareLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 11px', borderRadius: 7,
              background: 'var(--accent)', color: '#fff', fontSize: 12,
            }}
          >
            <Clipboard size={13} /> Copiar link
          </button>
        </div>
      )}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 16,
      }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)' }}>
          Nome da escala
          <input
            value={draft.name}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            style={{
              display: 'block', width: '100%', marginTop: 4,
              padding: '9px 11px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 17, fontWeight: 600,
            }}
          />
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
          {questionCount} perguntas · As alterações deste paciente não modificam o modelo original.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {draft.sections.map((section, sectionIndex) => (
          <section
            key={section.id}
            style={{
              border: '1px solid var(--border)', borderRadius: 12,
              background: 'var(--surface2)', padding: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input
                aria-label={`Nome da seção ${sectionIndex + 1}`}
                value={section.title}
                onChange={event => updateSection(sectionIndex, { title: event.target.value })}
                style={{
                  flex: 1, padding: '7px 9px', border: '1px solid var(--border)',
                  borderRadius: 8, fontWeight: 600, background: 'var(--surface)',
                }}
              />
              <button
                type="button"
                onClick={() => setDraft(current => ({
                  ...current,
                  sections: current.sections.filter((_, index) => index !== sectionIndex),
                }))}
                aria-label="Remover seção"
                style={{ color: 'var(--danger)', padding: 6 }}
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {section.questions.map((question, questionIndex) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  number={questionIndex + 1}
                  response={record?.responses?.[question.id]}
                  onChange={updated => updateQuestion(sectionIndex, questionIndex, updated)}
                  onRemove={() => updateSection(sectionIndex, {
                    questions: section.questions.filter((_, index) => index !== questionIndex),
                  })}
                  onMoveUp={() => moveQuestion(sectionIndex, questionIndex, -1)}
                  onMoveDown={() => moveQuestion(sectionIndex, questionIndex, 1)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => addQuestion(sectionIndex)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                marginTop: 12, color: 'var(--accent)', fontSize: 12,
              }}
            >
              <Plus size={14} /> Adicionar pergunta
            </button>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 16, padding: '9px 14px',
          border: '1px dashed var(--accent-border)', borderRadius: 8,
          color: 'var(--accent)', fontSize: 12,
        }}
      >
        <Plus size={14} /> Adicionar seção
      </button>

    </div>
  );
}
