const TEST_CONFIG = {
  SCARED: {
    name: 'Screen for Child Anxiety Related Emotional Disorders (SCARED)',
    shortName: 'SCARED',
    primaryOutputs: ['total'],
    chartLabels: {
      panic: 'Pânico/somático',
      generalized_anxiety: 'Ansiedade generalizada',
      separation_anxiety: 'Ansiedade de separação',
      social_anxiety: 'Ansiedade social',
      school_avoidance: 'Evitação escolar',
      total: 'Total',
    },
  },
  SDQ_PR: {
    name: 'Questionário de Capacidades e Dificuldades (SDQ)',
    shortName: 'SDQ',
    primaryOutputs: ['total', 'impact'],
    chartLabels: {
      emotional: 'Sintomas emocionais',
      conduct: 'Conduta',
      hyperactivity: 'Hiperatividade',
      peer: 'Relacionamento',
      prosocial: 'Pró-social',
      total: 'Total de dificuldades',
      impact: 'Impacto',
    },
  },
  SNAP_IV: {
    name: 'SNAP-IV',
    shortName: 'SNAP-IV',
    primaryOutputs: ['inattention', 'hyperactivity', 'oppositional', 'impulsivity'],
    chartLabels: {
      inattention: 'Desatenção',
      hyperactivity: 'Hiperatividade',
      oppositional: 'Desafiador',
      impulsivity: 'Impulsividade',
    },
  },
  QEDP: {
    name: 'Questionário de Estilos e Dimensões Parentais (QEDP)',
    shortName: 'QEDP',
    primaryOutputs: ['democratic', 'authoritarian', 'permissive'],
    chartLabels: {
      support_affection: 'Suporte e afeto',
      regulation: 'Regulação',
      autonomy: 'Autonomia',
      physical_coercion: 'Coerção física',
      verbal_hostility: 'Hostilidade verbal',
      punishment: 'Punição',
      indulgence: 'Indulgência',
      democratic: 'Democrático',
      authoritarian: 'Autoritário',
      permissive: 'Permissivo',
    },
  },
};

function outputText(output) {
  if (!output || output.value === null || output.value === undefined) return null;
  const classification = output.classification
    ? `, classificação ${output.classification}`
    : '';
  return `${output.label}: ${output.value}${output.unit ? ` ${output.unit}` : ''}${classification}`;
}

function selectedOutputEntries(outputs, ids) {
  return ids
    .map(id => [id, outputs[id]])
    .filter(([, output]) => output?.value !== null && output?.value !== undefined);
}

function analysisFor(config, outputs) {
  const primary = selectedOutputEntries(outputs, config.primaryOutputs)
    .map(([, output]) => outputText(output))
    .filter(Boolean);
  if (!primary.length) return '';

  const prefix = config.shortName === 'QEDP'
    ? `Na aplicação do ${config.shortName}, os estilos parentais apresentaram`
    : `Na aplicação do ${config.shortName}, foram obtidos`;
  return `${prefix}: ${primary.join('; ')}. `
    + 'Os achados devem ser interpretados em conjunto com a entrevista, a observação clínica e os demais instrumentos.';
}

export function getPreReportTestAdapter(result) {
  const config = TEST_CONFIG[result?.test_code];
  const outputs = result?.computed_scores?.outputs;
  if (!config || !outputs || typeof outputs !== 'object' || !Object.keys(outputs).length) {
    return null;
  }

  const allResults = Object.values(outputs).map(outputText).filter(Boolean);
  const chartData = Object.entries(outputs)
    .filter(([, output]) => Number.isFinite(Number(output?.value)))
    .map(([id, output]) => ({
      id,
      label: config.chartLabels[id] || output.label || id,
      value: Number(output.value),
      classification: output.classification || '',
    }));

  return {
    code: result.test_code,
    name: config.name,
    shortName: config.shortName,
    analysisText: analysisFor(config, outputs),
    resultText: `${config.name}: ${allResults.join('; ')}.`,
    chartData,
  };
}

export function listAdaptedTestResults(evaluations) {
  return (evaluations || [])
    .flatMap(evaluation => evaluation.test_results || [])
    .map(getPreReportTestAdapter)
    .filter(Boolean);
}

export function generateAdaptedTestResultsText(evaluations) {
  const adapted = listAdaptedTestResults(evaluations);
  if (!adapted.length) return '';
  return adapted.map(item => item.resultText).join('\n\n');
}

export function generateAdaptedTestAnalysisText(evaluations) {
  const adapted = listAdaptedTestResults(evaluations);
  if (!adapted.length) return '';
  return adapted.map(item => item.analysisText).filter(Boolean).join('\n\n');
}

export const PRE_REPORT_TEST_NAMES = Object.fromEntries(
  Object.entries(TEST_CONFIG).map(([code, config]) => [code, config.name])
);

