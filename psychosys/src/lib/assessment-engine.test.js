import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAssessment } from './test-engines/assessment.js';

test('assessment-v1 soma itens, aplica inversão e consulta norma aproximada', () => {
  const result = calculateAssessment({
    version: 1,
    norms: {
      profileField: 'norm_profile',
      profiles: {
        sample: {
          label: 'Amostra',
          tables: {
            scale: {
              standardLabel: 'Escore T',
              standardUnit: 'T',
              rows: [[0, 40, 16], [3, 50, 50], [6, 60, 84]],
            },
          },
        },
      },
    },
    scales: [{
      id: 'scale',
      label: 'Escala',
      fields: ['item_1', 'item_2'],
      reverseFields: ['item_2'],
      reverseBase: 3,
    }],
  }, {
    norm_profile: 'sample',
    item_1: '2',
    item_2: '1',
  });

  assert.equal(result.outputs.scale.raw, 4);
  assert.equal(result.outputs.scale.value, 50);
  assert.equal(result.outputs.scale.percentile, 50);
});

test('assessment-v1 calcula composições a partir de escores informados', () => {
  const result = calculateAssessment({
    version: 1,
    scales: [
      { id: 'a', label: 'A', entryField: 'a' },
      { id: 'b', label: 'B', entryField: 'b' },
    ],
    composites: [{
      id: 'total',
      label: 'Total',
      sources: [{ scale: 'a' }, { scale: 'b' }],
      table: {
        standardLabel: 'QI',
        standardUnit: 'QI',
        rows: [[10, 85, 16], [20, 100, 50], [30, 115, 84]],
      },
    }],
  }, { a: 12, b: 9 });

  assert.equal(result.outputs.total.raw, 21);
  assert.equal(result.outputs.total.value, 100);
});
