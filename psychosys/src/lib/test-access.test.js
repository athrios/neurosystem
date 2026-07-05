import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditTestApplication } from './test-access.js';

const profile = { id: 'professional-1', role: 'professional' };
const ownedEvaluation = {
  psicologo_id: 'professional-1',
  status: 'concluida',
};

test('permite validar formulário testing mesmo em avaliação concluída', () => {
  assert.equal(canEditTestApplication({
    evaluation: ownedEvaluation,
    profile,
    form: { implementation_status: 'testing' },
  }), true);
});

test('mantém formulário clínico concluído e avaliação alheia em somente leitura', () => {
  assert.equal(canEditTestApplication({
    evaluation: ownedEvaluation,
    profile,
    form: { implementation_status: 'active' },
  }), false);

  assert.equal(canEditTestApplication({
    evaluation: { psicologo_id: 'professional-2', status: 'em_andamento' },
    profile,
    form: { implementation_status: 'testing' },
  }), false);
});
