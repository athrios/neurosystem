import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeTestDefinition } from './generic-test-schema.js';
import { calculateScared } from './test-engines/scared.js';
import { calculateSdq } from './test-engines/sdq.js';
import { calculateSnapIv } from './test-engines/snap-iv.js';
import { calculateQedp } from './test-engines/qedp.js';

const configs = JSON.parse(
  fs.readFileSync(
    new URL('../../data/test-definitions/four-tests.json', import.meta.url),
    'utf8'
  )
);

function numberedResponses(count, value, extra = {}) {
  return {
    ...extra,
    ...Object.fromEntries(
      Array.from({ length: count }, (_, index) => [`item_${index + 1}`, value])
    ),
  };
}

test('os quatro formulários possuem schemas de administração válidos', () => {
  const expectedFields = {
    SCARED: 43,
    SDQ_PR: 32,
    SNAP_IV: 28,
    QEDP: 34,
  };

  for (const [code, config] of Object.entries(configs)) {
    const definition = normalizeTestDefinition(config.administration);
    const count = definition.sections.reduce(
      (total, section) => total + section.fields.length,
      0
    );
    assert.equal(count, expectedFields[code], code);
  }
});

test('SCARED reproduz subescalas, total e norma por idade/sexo', () => {
  const result = calculateScared(
    configs.SCARED.scoring,
    numberedResponses(41, 1, { respondent_type: 'self' }),
    {
      patient: { sexo: 'Feminino', data_nascimento: '2015-01-01' },
      evaluation: { data_aplicacao: '2025-01-01' },
    }
  );

  assert.equal(result.outputs.panic.value, 13);
  assert.equal(result.outputs.generalized_anxiety.value, 9);
  assert.equal(result.outputs.total.value, 41);
  assert.equal(result.outputs.total.classification, 'Clínico');
  assert.ok(result.outputs.total.details.some(detail => detail.label === 'Z-score'));
});

test('SDQ aplica inversão de itens e pontos de corte da planilha', () => {
  const responses = numberedResponses(25, 0, {
    respondent_type: 'caregiver',
    ...Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`impact_${index + 1}`, 'na'])),
  });
  const result = calculateSdq(configs.SDQ_PR.scoring, responses);

  assert.equal(result.outputs.conduct.value, 2);
  assert.equal(result.outputs.peer.value, 4);
  assert.equal(result.outputs.peer.classification, 'Limítrofe');
  assert.equal(result.outputs.prosocial.classification, 'Anormal');
  assert.equal(result.outputs.total.value, 10);
  assert.equal(result.outputs.total.classification, 'Normal');
});

test('SNAP-IV conta respostas Bastante/Demais conforme os critérios', () => {
  const result = calculateSnapIv(
    configs.SNAP_IV.scoring,
    numberedResponses(26, 2, { respondent_type: 'teacher' })
  );

  assert.equal(result.outputs.inattention.value, 18);
  assert.equal(result.outputs.inattention.classification, 'Desatento');
  assert.equal(result.outputs.hyperactivity.classification, 'Hiperativo');
  assert.equal(result.outputs.oppositional.classification, 'Clínico');
  assert.equal(result.outputs.impulsivity.value, 3);
  assert.equal(result.outputs.impulsivity.classification, 'Sugestivo');
});

test('QEDP calcula fatores e estilos pela média dos itens', () => {
  const result = calculateQedp(
    configs.QEDP.scoring,
    numberedResponses(32, 3)
  );

  assert.equal(result.outputs.support_affection.value, 3);
  assert.equal(result.outputs.punishment.value, 3);
  assert.equal(result.outputs.democratic.value, 3);
  assert.equal(result.outputs.authoritarian.value, 3);
  assert.equal(result.outputs.permissive.value, 3);
  assert.ok(result.outputs.democratic.details.some(detail => detail.label === 'Percentil'));
});
