import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeTestDefinition } from './generic-test-schema.js';
import { calculateAssessment } from './test-engines/assessment.js';
import { createPublicTestDefinition } from './test-response-links.js';

const definitionsPath = fileURLToPath(
  new URL('../../data/test-definitions/pending-tests.json', import.meta.url)
);
const definitions = JSON.parse(readFileSync(definitionsPath, 'utf8'));

function sampleValue(field) {
  if (field.options?.length) return field.options[0].value;
  if (field.type === 'number') return field.min ?? 0;
  if (field.type === 'checkbox') return true;
  if (field.type === 'date') return '2026-07-05';
  return 'Teste';
}

test('o lote pendente contém os 13 formulários esperados e esquemas válidos', () => {
  assert.equal(Object.keys(definitions).length, 13);

  for (const [code, configuration] of Object.entries(definitions)) {
    const definition = normalizeTestDefinition(configuration.administration);
    const responses = Object.fromEntries(
      definition.sections.flatMap(section => (
        section.fields.map(field => [field.id, sampleValue(field)])
      ))
    );
    const result = calculateAssessment(configuration.scoring, responses);
    assert.ok(Object.keys(result.outputs).length > 0, `${code} deve produzir resultados`);
  }
});

test('campos normativos exclusivos do profissional não são expostos no link público', () => {
  for (const configuration of Object.values(definitions)) {
    if (configuration.metadata.public_response_enabled !== true) continue;
    const definition = normalizeTestDefinition(configuration.administration);
    const publicDefinition = createPublicTestDefinition(definition);
    const publicIds = publicDefinition.sections.flatMap(section => (
      section.fields.map(field => field.id)
    ));
    assert.equal(publicIds.includes('norm_profile'), false);
    assert.equal(publicIds.includes('respondent_name'), false);
    assert.equal(publicIds.includes('relationship'), false);
  }
});

test('reproduz inversões e composições dos formulários respondidos por terceiros', () => {
  const cases = [
    {
      code: 'ETDAH_AD',
      itemValue: '0',
      expected: { inattention: 0, impulsivity: 0, emotional: 0, self_regulation: 60, hyperactivity: 0 },
    },
    {
      code: 'ETDAH_CRI_AD',
      itemValue: '1',
      expected: { hyperactivity: 12, attention: 10, total: 22 },
    },
    {
      code: 'ETDAH_PAIS',
      itemValue: '1',
      expected: {
        emotional_regulation: 19,
        hyperactivity_impulsivity: 13,
        adaptive_behavior: 84,
        attention: 17,
        total: 133,
      },
    },
    {
      code: 'ETDAH_2_PROF',
      itemValue: '1',
      expected: {
        attention: 60,
        hyperactivity_impulsivity: 27,
        learning: 48,
        social_behavior: 16,
        total: 151,
      },
    },
    {
      code: 'IEP',
      itemValue: '1',
      expected: {
        positive_monitoring: 6,
        moral_behavior: 6,
        inconsistent_punishment: 6,
        neglect: 6,
        relaxed_discipline: 6,
        negative_monitoring: 6,
        physical_abuse: 6,
        parenting_index: -18,
      },
    },
    {
      code: 'SRS_2_ADULTOS',
      itemValue: '1',
      expected: {
        social_awareness: 12,
        social_cognition: 12,
        social_communication: 18,
        social_motivation: 9,
        restricted_repetitive: 0,
        total: 51,
      },
    },
  ];

  for (const testCase of cases) {
    const configuration = definitions[testCase.code];
    const definition = normalizeTestDefinition(configuration.administration);
    const responses = Object.fromEntries(
      definition.sections.flatMap(section => section.fields.map(field => [
        field.id,
        field.id.startsWith('item_') ? testCase.itemValue : sampleValue(field),
      ]))
    );
    const result = calculateAssessment(configuration.scoring, responses);
    for (const [outputId, raw] of Object.entries(testCase.expected)) {
      assert.equal(
        result.outputs[outputId].raw,
        raw,
        `${testCase.code}.${outputId}`
      );
    }
  }
});
