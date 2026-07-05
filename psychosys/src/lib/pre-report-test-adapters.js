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
  BRIEF_P: {
    name: 'Inventário de Avaliação Comportamental de Funções Executivas — Pré-escolar (BRIEF-P)',
    shortName: 'BRIEF-P',
    primaryOutputs: ['inhibition', 'shift', 'emotional_control', 'working_memory', 'planning'],
    chartLabels: {},
  },
  BRIEF_2: {
    name: 'Inventário de Avaliação Comportamental de Funções Executivas — Segunda Edição (BRIEF-2)',
    shortName: 'BRIEF-2',
    primaryOutputs: [
      'inhibition', 'self_monitoring', 'shift', 'emotional_control', 'initiative',
      'working_memory', 'planning', 'task_monitoring', 'materials',
    ],
    chartLabels: {},
  },
  CBCL: {
    name: 'Child Behavior Checklist — 6 a 18 anos (CBCL)',
    shortName: 'CBCL',
    primaryOutputs: [
      'anxiety_depression', 'withdrawal', 'somatic', 'social',
      'thought', 'attention', 'disruptive', 'aggressive',
    ],
    chartLabels: {},
  },
  ETDAH_AD: {
    name: 'Escala de Transtorno do Déficit de Atenção e Hiperatividade — Adultos (E-TDAH-AD)',
    shortName: 'E-TDAH-AD',
    primaryOutputs: ['inattention', 'impulsivity', 'emotional', 'self_regulation', 'hyperactivity'],
    chartLabels: {},
  },
  ETDAH_CRI_AD: {
    name: 'Escala de Transtorno do Déficit de Atenção e Hiperatividade — Crianças e Adolescentes',
    shortName: 'E-TDAH-CriAd',
    primaryOutputs: ['total', 'hyperactivity', 'attention'],
    chartLabels: {},
  },
  ETDAH_PAIS: {
    name: 'Escala de Transtorno do Déficit de Atenção e Hiperatividade — Pais',
    shortName: 'E-TDAH-Pais',
    primaryOutputs: [
      'total', 'emotional_regulation', 'hyperactivity_impulsivity',
      'adaptive_behavior', 'attention',
    ],
    chartLabels: {},
  },
  ETDAH_2_PROF: {
    name: 'Escala de Transtorno do Déficit de Atenção e Hiperatividade — Professores',
    shortName: 'E-TDAH-2',
    primaryOutputs: [
      'total', 'attention', 'hyperactivity_impulsivity', 'learning', 'social_behavior',
    ],
    chartLabels: {},
  },
  IEP: {
    name: 'Inventário de Estilos Parentais (IEP)',
    shortName: 'IEP',
    primaryOutputs: ['parenting_index'],
    chartLabels: {},
  },
  SRS_2_ADULTOS: {
    name: 'Escala de Responsividade Social — Segunda Edição — Adultos',
    shortName: 'SRS-2 Adultos',
    primaryOutputs: ['total', 'social_interaction', 'restricted_repetitive'],
    chartLabels: {},
  },
  SRS_2_ESCOLAR: {
    name: 'Escala de Responsividade Social — Segunda Edição — Escolar',
    shortName: 'SRS-2 Escolar',
    primaryOutputs: ['total', 'social_interaction', 'restricted_repetitive'],
    chartLabels: {},
  },
  SRS_2_PRE_ESCOLAR: {
    name: 'Escala de Responsividade Social — Segunda Edição — Pré-escolar',
    shortName: 'SRS-2 Pré-escolar',
    primaryOutputs: ['total', 'social_interaction', 'restricted_repetitive'],
    chartLabels: {},
  },
  WAIS_III: {
    name: 'Escala Wechsler de Inteligência para Adultos — Terceira Edição (WAIS-III)',
    shortName: 'WAIS-III',
    primaryOutputs: [
      'full_iq', 'verbal_iq', 'performance_iq', 'verbal_comprehension',
      'perceptual_organization', 'working_memory', 'processing_speed',
    ],
    chartLabels: {},
  },
  WASI: {
    name: 'Escala Wechsler Abreviada de Inteligência (WASI)',
    shortName: 'WASI',
    primaryOutputs: ['full_iq_4', 'full_iq_2', 'verbal_iq', 'performance_iq'],
    chartLabels: {},
  },
};

function outputText(output) {
  if (!output || output.value === null || output.value === undefined) return null;
  const normativeDetails = [
    output.standard !== null
      && output.standard !== undefined
      && String(output.standard) !== String(output.value)
      ? `escore padronizado ${output.standard}`
      : null,
    output.percentile !== null && output.percentile !== undefined
      ? `percentil ${output.percentile}`
      : null,
  ].filter(Boolean);
  const classification = output.classification
    ? `, classificação ${output.classification}`
    : '';
  const normative = normativeDetails.length ? ` (${normativeDetails.join(', ')})` : '';
  return `${output.label}: ${output.value}${output.unit ? ` ${output.unit}` : ''}${normative}${classification}`;
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
