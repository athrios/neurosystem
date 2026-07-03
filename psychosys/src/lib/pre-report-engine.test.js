import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAnalysisText,
  generateFormResultsText,
  generateProcedureText,
} from './pre-report-engine.js';

const evaluations = [{
  test_results: [{
    test_code: 'SNAP_IV',
    computed_scores: {
      outputs: {
        inattention: {
          label: 'Desatenção',
          value: 18,
          classification: 'Desatento',
        },
        hyperactivity: {
          label: 'Hiperatividade',
          value: 8,
          classification: 'Não clínico',
        },
      },
    },
  }],
}];

test('integra teste adaptado aos campos automáticos do pré-laudo', () => {
  const patient = { nome: 'Paciente Teste' };
  assert.match(generateProcedureText(evaluations, []), /SNAP-IV/);
  assert.match(generateAnalysisText(patient, evaluations), /Desatenção: 18/);
  assert.match(generateFormResultsText(patient, [], evaluations), /classificação Desatento/);
});

