import { TestScoringError } from '../generic-test-engine.js';
import { sumItems } from './helpers.js';

function classify(value, thresholds, inverse = false) {
  if (inverse) {
    if (value >= thresholds.normal) return 'Normal';
    if (value === thresholds.borderline) return 'Limítrofe';
    return 'Anormal';
  }
  if (value >= thresholds.abnormal) return 'Anormal';
  if (value >= thresholds.borderline) return 'Limítrofe';
  return 'Normal';
}

export function calculateSdq(scoringSchema, responses) {
  if (!scoringSchema?.scales) {
    throw new TestScoringError('Configuração de escalas do SDQ ausente.');
  }

  const normalized = { ...responses };
  const reverseItems = new Set(scoringSchema.reverseItems || []);
  for (let item = 1; item <= 25; item += 1) {
    const key = `item_${item}`;
    const value = Number(responses[key]);
    if (!Number.isFinite(value)) {
      throw new TestScoringError(`O campo "${key}" não foi respondido.`);
    }
    normalized[key] = reverseItems.has(item) ? 2 - value : value;
  }

  const outputs = {};
  let total = 0;
  for (const [scaleId, scale] of Object.entries(scoringSchema.scales)) {
    const value = sumItems(normalized, scale.items);
    if (!scale.excludeFromTotal) total += value;
    outputs[scaleId] = {
      label: scale.label,
      value,
      classification: classify(value, scale.thresholds, scale.inverse),
    };
  }

  outputs.total = {
    label: 'Total de dificuldades',
    value: total,
    classification: classify(total, scoringSchema.totalThresholds),
  };

  const impactValues = (scoringSchema.impactItems || [])
    .map(item => responses[`impact_${item}`])
    .filter(value => value !== 'na' && value !== '' && value !== null && value !== undefined)
    .map(Number);
  if (impactValues.length) {
    const impact = impactValues.reduce((sum, value) => sum + value, 0);
    outputs.impact = {
      label: 'Suplemento de impacto',
      value: impact,
      classification: impact >= 2 ? 'Anormal' : impact === 1 ? 'Limítrofe' : 'Normal',
    };
  }

  return {
    engine: 'sdq-v1',
    engineVersion: '1',
    respondentType: responses.respondent_type,
    outputs,
  };
}
