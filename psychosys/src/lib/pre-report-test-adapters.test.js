import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAdaptedTestAnalysisText,
  generateAdaptedTestResultsText,
  getPreReportTestAdapter,
  listAdaptedTestResults,
} from './pre-report-test-adapters.js';

function result(testCode, outputs) {
  return { test_code: testCode, computed_scores: { outputs } };
}

test('adapta SCARED sem converter rastreio em diagnóstico', () => {
  const adapted = getPreReportTestAdapter(result('SCARED', {
    panic: { label: 'Pânico/somático', value: 4, classification: 'Não clínico' },
    total: { label: 'Total', value: 29, classification: 'Clínico' },
  }));

  assert.match(adapted.analysisText, /Total: 29, classificação Clínico/);
  assert.match(adapted.analysisText, /interpretados em conjunto/);
  assert.doesNotMatch(adapted.analysisText.toLowerCase(), /diagnóstico/);
  assert.equal(adapted.chartData[1].label, 'Total');
});

test('prioriza estilos parentais na análise do QEDP e preserva fatores no resultado', () => {
  const adapted = getPreReportTestAdapter(result('QEDP', {
    support_affection: {
      label: 'Suporte e afeto',
      value: 3.2,
      classification: 'Médio',
    },
    democratic: {
      label: 'Estilo democrático',
      value: 3.8,
      classification: 'Alto',
    },
    authoritarian: {
      label: 'Estilo autoritário',
      value: 2.1,
      classification: 'Baixo',
    },
    permissive: {
      label: 'Estilo permissivo',
      value: 2.8,
      classification: 'Médio',
    },
  }));

  assert.match(adapted.analysisText, /Estilo democrático: 3.8/);
  assert.match(adapted.resultText, /Suporte e afeto: 3.2/);
});

test('reúne somente testes com adaptadores e resultados calculados', () => {
  const evaluations = [{
    test_results: [
      result('SNAP_IV', {
        inattention: { label: 'Desatenção', value: 7, classification: 'Desatento' },
      }),
      result('WISC_IV', { total: { label: 'Total', value: 100 } }),
      { test_code: 'SDQ_PR', computed_scores: {} },
    ],
  }];

  assert.equal(listAdaptedTestResults(evaluations).length, 1);
  assert.match(generateAdaptedTestResultsText(evaluations), /SNAP-IV/);
  assert.match(generateAdaptedTestAnalysisText(evaluations), /Desatenção/);
});

test('adapta os novos testes para texto e gráficos do pré-laudo', () => {
  const adapted = getPreReportTestAdapter(result('WAIS_III', {
    full_iq: { label: 'Q.I. Total', value: 112, classification: 'Média superior' },
    verbal_iq: { label: 'Q.I. Verbal', value: 108, classification: 'Média' },
  }));

  assert.match(adapted.analysisText, /Q\.I\. Total: 112/);
  assert.match(adapted.resultText, /Média superior/);
  assert.deepEqual(adapted.chartData.map(item => item.value), [112, 108]);
});
