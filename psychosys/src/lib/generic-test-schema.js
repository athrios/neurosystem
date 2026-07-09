const SUPPORTED_FIELD_TYPES = new Set([
  'number',
  'text',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'date',
  'time',
]);

export class TestSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TestSchemaError';
  }
}

function requireText(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TestSchemaError(`${path} deve ser um texto não vazio.`);
  }
  return value.trim();
}

export function isScoringPromptLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/^(?:\d+\s+)?(?:pontuacao|ponto|pontos|score) (?:do )?item$/) !== null;
}

function itemNumberFromFieldId(id) {
  const match = String(id || '').match(/^item_(\d+)$/);
  return match ? match[1] : null;
}

export function resolveFieldLabel(field, id) {
  const label = requireText(field.label, `${id}.label`);
  if (!isScoringPromptLabel(label.replace(/^\d+\.\s*/, ''))) return label;

  const questionText = typeof field.question_text === 'string'
    ? field.question_text.trim()
    : typeof field.questionText === 'string'
      ? field.questionText.trim()
      : '';

  if (questionText && !isScoringPromptLabel(questionText)) {
    const number = itemNumberFromFieldId(id);
    return number && !questionText.match(/^\d+\./)
      ? `${number}. ${questionText}`
      : questionText;
  }

  const number = itemNumberFromFieldId(id);
  return number ? `Item ${number}` : label;
}

function normalizeOptions(options, path) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new TestSchemaError(`${path} deve possuir ao menos uma opção.`);
  }

  const values = new Set();
  return options.map((option, index) => {
    const normalized = typeof option === 'object' && option !== null
      ? {
          value: String(option.value ?? ''),
          label: requireText(option.label, `${path}[${index}].label`),
        }
      : { value: String(option), label: String(option) };

    if (!normalized.value) {
      throw new TestSchemaError(`${path}[${index}].value não pode ser vazio.`);
    }
    if (values.has(normalized.value)) {
      throw new TestSchemaError(`${path} possui o valor duplicado "${normalized.value}".`);
    }
    values.add(normalized.value);
    return normalized;
  });
}

function normalizeField(field, path, knownIds) {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    throw new TestSchemaError(`${path} deve ser um objeto.`);
  }

  const id = requireText(field.id, `${path}.id`);
  if (knownIds.has(id)) {
    throw new TestSchemaError(`O campo "${id}" está duplicado.`);
  }
  knownIds.add(id);

  const type = field.type || 'text';
  if (!SUPPORTED_FIELD_TYPES.has(type)) {
    throw new TestSchemaError(`${path}.type possui o tipo não suportado "${type}".`);
  }

  const normalized = {
    id,
    type,
    label: resolveFieldLabel(field, id),
    helpText: typeof field.helpText === 'string' ? field.helpText : '',
    placeholder: typeof field.placeholder === 'string' ? field.placeholder : '',
    required: Boolean(field.required),
    readOnly: Boolean(field.readOnly),
    public: field.public !== false,
    defaultValue: field.defaultValue ?? (type === 'checkbox' ? false : ''),
    span: Number.isInteger(field.span) && field.span >= 1 && field.span <= 12
      ? field.span
      : 6,
  };

  if (type === 'number') {
    const hasMinimum = field.min !== null && field.min !== undefined && field.min !== '';
    const hasMaximum = field.max !== null && field.max !== undefined && field.max !== '';
    normalized.min = hasMinimum && Number.isFinite(Number(field.min)) ? Number(field.min) : null;
    normalized.max = hasMaximum && Number.isFinite(Number(field.max)) ? Number(field.max) : null;
    normalized.step = Number.isFinite(Number(field.step)) && Number(field.step) > 0
      ? Number(field.step)
      : 1;
    normalized.decimals = Number.isInteger(field.decimals) && field.decimals >= 0
      ? field.decimals
      : null;
    if (normalized.min !== null && normalized.max !== null && normalized.max < normalized.min) {
      throw new TestSchemaError(`${path}.max não pode ser menor que min.`);
    }
  }

  if (type === 'select' || type === 'radio') {
    normalized.options = normalizeOptions(field.options, `${path}.options`);
  }

  return normalized;
}

export function normalizeTestDefinition(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new TestSchemaError('administration_schema deve ser um objeto.');
  }
  if (schema.version !== 1) {
    throw new TestSchemaError(`Versão de formulário não suportada: ${schema.version ?? 'ausente'}.`);
  }
  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    throw new TestSchemaError('O formulário deve possuir ao menos uma seção.');
  }

  const sectionIds = new Set();
  const fieldIds = new Set();
  const sections = schema.sections.map((section, sectionIndex) => {
    const path = `sections[${sectionIndex}]`;
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw new TestSchemaError(`${path} deve ser um objeto.`);
    }

    const id = requireText(section.id, `${path}.id`);
    if (sectionIds.has(id)) {
      throw new TestSchemaError(`A seção "${id}" está duplicada.`);
    }
    sectionIds.add(id);

    if (!Array.isArray(section.fields) || section.fields.length === 0) {
      throw new TestSchemaError(`${path}.fields deve possuir ao menos um campo.`);
    }

    return {
      id,
      title: requireText(section.title, `${path}.title`),
      description: typeof section.description === 'string' ? section.description : '',
      fields: section.fields.map((field, fieldIndex) => (
        normalizeField(field, `${path}.fields[${fieldIndex}]`, fieldIds)
      )),
    };
  });

  return {
    version: 1,
    title: typeof schema.title === 'string' ? schema.title : '',
    instructions: typeof schema.instructions === 'string' ? schema.instructions : '',
    sections,
  };
}

export function createInitialTestValues(definition, savedValues = {}) {
  const values = {};
  for (const section of definition.sections) {
    for (const field of section.fields) {
      values[field.id] = Object.prototype.hasOwnProperty.call(savedValues, field.id)
        ? savedValues[field.id]
        : field.defaultValue;
    }
  }
  return values;
}

function isEmpty(value) {
  return value === '' || value === null || value === undefined;
}

export function validateTestValues(definition, values) {
  const errors = {};

  for (const section of definition.sections) {
    for (const field of section.fields) {
      const value = values[field.id];
      if (field.required && (isEmpty(value) || (field.type === 'checkbox' && value !== true))) {
        errors[field.id] = 'Campo obrigatório.';
        continue;
      }
      if (isEmpty(value)) continue;

      if (field.type === 'number') {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          errors[field.id] = 'Informe um número válido.';
        } else if (field.min !== null && number < field.min) {
          errors[field.id] = `O valor mínimo é ${field.min}.`;
        } else if (field.max !== null && number > field.max) {
          errors[field.id] = `O valor máximo é ${field.max}.`;
        }
      }

      if (field.options && !field.options.some(option => option.value === String(value))) {
        errors[field.id] = 'Selecione uma opção válida.';
      }
    }
  }

  return errors;
}

export function listTestFields(definition) {
  return definition.sections.flatMap(section => section.fields);
}
