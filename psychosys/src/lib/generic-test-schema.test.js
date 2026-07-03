import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialTestValues,
  normalizeTestDefinition,
  TestSchemaError,
  validateTestValues,
} from './generic-test-schema.js';

const validSchema = {
  version: 1,
  sections: [
    {
      id: 'scores',
      title: 'Pontuações',
      fields: [
        { id: 'first', label: 'Primeira medida', type: 'number', required: true, min: 0, max: 10 },
        { id: 'note', label: 'Observação', type: 'textarea', span: 12 },
        {
          id: 'choice',
          label: 'Escolha',
          type: 'select',
          options: [{ value: 'a', label: 'Alternativa A' }],
        },
      ],
    },
  ],
};

test('normaliza a definição e cria valores iniciais preservando dados salvos', () => {
  const definition = normalizeTestDefinition(validSchema);
  const values = createInitialTestValues(definition, { first: 7 });

  assert.equal(definition.sections[0].fields[0].min, 0);
  assert.equal(values.first, 7);
  assert.equal(values.note, '');
});

test('rejeita identificadores de campo duplicados', () => {
  const duplicated = structuredClone(validSchema);
  duplicated.sections[0].fields.push({ id: 'first', label: 'Duplicado', type: 'text' });

  assert.throws(
    () => normalizeTestDefinition(duplicated),
    error => error instanceof TestSchemaError && error.message.includes('duplicado')
  );
});

test('valida obrigatoriedade, limites numéricos e opções permitidas', () => {
  const definition = normalizeTestDefinition(validSchema);

  assert.deepEqual(validateTestValues(definition, {
    first: '',
    note: '',
    choice: 'inválida',
  }), {
    first: 'Campo obrigatório.',
    choice: 'Selecione uma opção válida.',
  });

  assert.deepEqual(validateTestValues(definition, {
    first: 12,
    note: '',
    choice: 'a',
  }), {
    first: 'O valor máximo é 10.',
  });
});
