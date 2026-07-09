import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRespondentIdentity,
  createPublicTestDefinition,
  effectiveTestResponseStatus,
  getPendingTestResponses,
  getRespondentOptions,
  isShareableTestForm,
  isThirdPartyTestForm,
} from './test-response-links.js';

test('libera compartilhamento para formulários não profissionais disponíveis', () => {
  assert.equal(isShareableTestForm({
    respondentType: 'parent',
    status: 'testing',
    available: true,
    metadata: { public_response_enabled: true },
  }), true);
  assert.equal(isShareableTestForm({
    respondentType: 'professional',
    status: 'active',
    available: true,
  }), false);
  assert.equal(isShareableTestForm({
    respondentType: 'patient',
    status: 'active',
    available: true,
    metadata: { public_response_enabled: true },
  }), true);
  assert.equal(isShareableTestForm({
    respondentType: 'patient',
    status: 'catalogued',
    available: false,
  }), false);
  assert.equal(isShareableTestForm({
    respondentType: 'parent',
    status: 'testing',
    available: true,
    metadata: { public_response_enabled: false },
  }), true);
});

test('identifica respondentes não profissionais como terceiros', () => {
  assert.equal(isThirdPartyTestForm({ respondentType: 'parent' }), true);
  assert.equal(isThirdPartyTestForm({ respondentType: 'teacher' }), true);
  assert.equal(isThirdPartyTestForm({ respondentType: 'other' }), true);
  assert.equal(isThirdPartyTestForm({ respondentType: 'patient' }), true);
  assert.equal(isThirdPartyTestForm({ respondentType: 'self' }), true);
  assert.equal(isThirdPartyTestForm({ respondentType: 'professional' }), false);
});

test('usa as opções de respondente definidas pelo próprio teste', () => {
  const options = getRespondentOptions({
    respondent_type: 'parent',
    administration_schema: {
      sections: [{
        fields: [{
          id: 'respondent_type',
          options: [
            { value: 'caregiver', label: 'Responsável' },
            { value: 'teacher', label: 'Professor' },
          ],
        }],
      }],
    },
  });

  assert.deepEqual(options, [
    { value: 'caregiver', label: 'Responsável' },
    { value: 'teacher', label: 'Professor' },
  ]);
});

test('identidade do link prevalece e não é perguntada novamente no formulário público', () => {
  const responses = applyRespondentIdentity(
    { respondent_name: 'Nome adulterado', item_1: '2' },
    {
      respondent_type: 'teacher',
      respondent_name: 'Maria Silva',
      relationship: 'Professora',
    },
  );
  assert.equal(responses.respondent_name, 'Maria Silva');

  const publicDefinition = createPublicTestDefinition({
    sections: [
      {
        id: 'respondent',
        fields: [
          { id: 'respondent_type' },
          { id: 'respondent_name' },
          { id: 'relationship' },
        ],
      },
      {
        id: 'items',
        fields: [{ id: 'item_1' }],
      },
    ],
  });

  assert.deepEqual(publicDefinition.sections.map(section => section.id), ['items']);
});

test('lista somente respostas pendentes do teste selecionado', () => {
  const pending = getPendingTestResponses([
    {
      id: 'latest',
      form_code: 'QEDP',
      status: 'submitted',
      responded_at: '2026-07-02T12:00:00Z',
    },
    {
      id: 'oldest',
      form_code: 'QEDP',
      status: 'submitted',
      responded_at: '2026-07-02T10:00:00Z',
    },
    { id: 'draft', form_code: 'QEDP', status: 'in_progress' },
    { id: 'reviewed', form_code: 'QEDP', status: 'reviewed' },
    { id: 'other-test', form_code: 'SNAP_IV', status: 'submitted' },
  ], 'QEDP');

  assert.deepEqual(pending.map(link => link.id), ['oldest', 'latest']);
});

test('considera expirado um link ativo cuja validade terminou', () => {
  const now = new Date('2026-07-02T12:00:00Z');
  assert.equal(effectiveTestResponseStatus({
    status: 'shared',
    expires_at: '2026-07-02T11:59:59Z',
  }, now), 'expired');
  assert.equal(effectiveTestResponseStatus({
    status: 'reviewed',
    expires_at: '2026-07-01T00:00:00Z',
  }, now), 'reviewed');
});
