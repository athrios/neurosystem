import { TestScoringError } from '../generic-test-engine.js';
import { sumItems } from './helpers.js';

function highResponseCount(responses, items) {
  return items.filter(item => Number(responses[`item_${item}`]) >= 2).length;
}

export function calculateSnapIv(scoringSchema, responses) {
  if (!scoringSchema?.scales) {
    throw new TestScoringError('Configuração de escalas do SNAP-IV ausente.');
  }

  const outputs = {};
  for (const [scaleId, scale] of Object.entries(scoringSchema.scales)) {
    const value = sumItems(responses, scale.items);
    const count = highResponseCount(responses, scale.items);
    outputs[scaleId] = {
      label: scale.label,
      value,
      classification: count >= scale.cutoffCount
        ? scale.positiveLabel
        : 'Não clínico',
      details: [
        { label: 'Respostas Bastante/Demais', value: `${count}/${scale.items.length}` },
        { label: 'Critério quantitativo', value: `${scale.cutoffCount}/${scale.items.length}` },
      ],
    };
  }

  const impulsivityItems = scoringSchema.impulsivityItems || [];
  const impulsivityCount = highResponseCount(responses, impulsivityItems);
  outputs.impulsivity = {
    label: 'Indicador qualitativo de impulsividade',
    value: impulsivityCount,
    classification: impulsivityCount >= 2 ? 'Sugestivo' : 'Não sugestivo',
    details: [{ label: 'Natureza', value: 'Análise qualitativa na planilha de origem' }],
  };

  return {
    engine: 'snap-iv-v1',
    engineVersion: '1',
    respondentType: responses.respondent_type,
    outputs,
  };
}
