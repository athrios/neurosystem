import { TestScoringError } from '../generic-test-engine.js';
import {
  averageItems,
  normDetails,
  round,
} from './helpers.js';

function factorOutput(label, value, norm) {
  return {
    label,
    value: round(value, 2),
    classification: normDetails(value, norm.mean, norm.sd)
      .find(detail => detail.label === 'Classificação normativa')?.value || null,
    details: normDetails(value, norm.mean, norm.sd),
  };
}

export function calculateQedp(scoringSchema, responses) {
  if (!scoringSchema?.factors || !scoringSchema?.styles) {
    throw new TestScoringError('Configuração de fatores do QEDP ausente.');
  }

  const outputs = {};
  const factorValues = {};
  for (const [factorId, factor] of Object.entries(scoringSchema.factors)) {
    const value = averageItems(responses, factor.items);
    factorValues[factorId] = value;
    outputs[factorId] = factorOutput(factor.label, value, factor.norm);
  }

  for (const [styleId, style] of Object.entries(scoringSchema.styles)) {
    const values = style.factors.map(factorId => factorValues[factorId]);
    const value = values.reduce((sum, current) => sum + current, 0) / values.length;
    outputs[styleId] = factorOutput(style.label, value, style.norm);
  }

  return {
    engine: 'qedp-v1',
    engineVersion: '1',
    respondentType: 'parent',
    outputs,
  };
}
