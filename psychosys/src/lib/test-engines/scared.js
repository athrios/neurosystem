import { TestScoringError } from '../generic-test-engine.js';
import {
  ageInYears,
  normDetails,
  sumItems,
} from './helpers.js';

function normativeGroup(patient, evaluation, norms) {
  if (patient?.sexo !== 'Masculino' && patient?.sexo !== 'Feminino') return null;
  const age = ageInYears(patient?.data_nascimento, evaluation?.data_aplicacao);
  if (age === null) return null;
  const ageGroup = age >= 9 && age <= 11
    ? 'child'
    : age >= 12 && age <= 18
      ? 'adolescent'
      : null;
  if (!ageGroup) return null;
  const sex = patient.sexo === 'Masculino' ? 'male' : 'female';
  return norms?.[ageGroup]?.[sex] || null;
}

export function calculateScared(scoringSchema, responses, context = {}) {
  const scales = scoringSchema?.scales;
  if (!scales || typeof scales !== 'object') {
    throw new TestScoringError('Configuração de subescalas do SCARED ausente.');
  }

  const group = responses.respondent_type === 'self'
    ? normativeGroup(context.patient, context.evaluation, scoringSchema.norms)
    : null;
  const outputs = {};
  let total = 0;

  for (const [scaleId, scale] of Object.entries(scales)) {
    const value = sumItems(responses, scale.items);
    total += value;
    outputs[scaleId] = {
      label: scale.label,
      value,
      classification: value >= scale.cutoff ? 'Clínico' : 'Não clínico',
      details: [
        { label: 'Nota de corte', value: scale.cutoff },
        ...(group?.[scaleId]
          ? normDetails(value, group[scaleId].mean, group[scaleId].sd)
          : []),
      ],
    };
  }

  const totalConfig = scoringSchema.total;
  outputs.total = {
    label: totalConfig.label || 'Total',
    value: total,
    classification: total >= totalConfig.cutoff ? 'Clínico' : 'Não clínico',
    details: [
      { label: 'Nota de corte', value: totalConfig.cutoff },
      ...(group?.total
        ? normDetails(total, group.total.mean, group.total.sd)
        : []),
    ],
  };

  return {
    engine: 'scared-v1',
    engineVersion: '1',
    respondentType: responses.respondent_type,
    outputs,
  };
}
