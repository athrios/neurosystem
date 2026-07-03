import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGenericTest,
  TestScoringError,
} from './generic-test-engine.js';

test('calcula operações declarativas e classificação sem executar código externo', () => {
  const result = calculateGenericTest({
    version: 1,
    outputs: [
      {
        id: 'total',
        label: 'Total',
        operation: 'sum',
        fields: ['a', 'b'],
        classificationRanges: [
          { max: 4, label: 'Baixo' },
          { min: 5, label: 'Esperado' },
        ],
      },
      {
        id: 'media',
        label: 'Média',
        operation: 'average',
        fields: ['a', 'b'],
        decimals: 1,
      },
    ],
  }, { a: 2, b: 3 });

  assert.equal(result.engine, 'generic-v1');
  assert.equal(result.outputs.total.value, 5);
  assert.equal(result.outputs.total.classification, 'Esperado');
  assert.equal(result.outputs.media.value, 2.5);
});

test('rejeita campo numérico ausente', () => {
  assert.throws(
    () => calculateGenericTest({
      version: 1,
      outputs: [{ id: 'total', operation: 'sum', fields: ['a', 'b'] }],
    }, { a: 1, b: '' }),
    error => error instanceof TestScoringError && error.message.includes('"b"')
  );
});

test('rejeita operações não autorizadas', () => {
  assert.throws(
    () => calculateGenericTest({
      version: 1,
      outputs: [{ id: 'total', operation: 'javascript', fields: ['a'] }],
    }, { a: 1 }),
    error => error instanceof TestScoringError && error.message.includes('não suportada')
  );
});
