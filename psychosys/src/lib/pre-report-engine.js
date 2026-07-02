function firstName(patient) {
  return patient?.nome?.trim().split(/\s+/)[0] || 'O paciente';
}

function ageYears(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) years -= 1;
  return years;
}

function scoreOf(answer) {
  if (typeof answer !== 'string') return null;
  const bracket = answer.match(/\[(\d+)]/);
  if (bracket) return Number(bracket[1]);
  const trailing = answer.match(/\((\d+)\)\s*$/);
  if (trailing) return Number(trailing[1]);
  const leading = answer.match(/^\s*(\d+)\s*(?:=|\(|$)/);
  return leading ? Number(leading[1]) : null;
}

function questionsOf(record) {
  return (record.questions || []).flatMap(section => section.questions || []);
}

function answerEntries(record) {
  const byId = new Map(questionsOf(record).map(question => [question.id, question]));
  return Object.entries(record.responses || {}).map(([id, answer]) => ({
    question: byId.get(id),
    answer,
  })).filter(entry => entry.question);
}

function classifyHad(score) {
  if (score <= 7) return 'improvável';
  if (score <= 11) return 'possível';
  return 'provável';
}

function hadResult(patient, record) {
  const scores = Array.from({ length: 14 }, (_, index) => (
    scoreOf(record.responses?.[`had-${index + 1}`])
  ));
  const anxiety = [0, 2, 4, 6, 8, 10, 12].reduce(
    (total, index) => total + (scores[index] ?? 0),
    0,
  );
  const depression = [1, 3, 5, 7, 9, 11, 13].reduce(
    (total, index) => total + (scores[index] ?? 0),
    0,
  );
  return `Na Escala HAD, ${firstName(patient)} obteve ${anxiety} pontos no eixo de ansiedade, `
    + `classificado na faixa ${classifyHad(anxiety)}, e ${depression} pontos no eixo de depressão, `
    + `classificado na faixa ${classifyHad(depression)}.`;
}

function summedResult(patient, record, maximum, label) {
  const values = answerEntries(record)
    .flatMap(({ answer }) => Array.isArray(answer) ? [] : [scoreOf(answer)])
    .filter(Number.isFinite);
  const total = values.reduce((sum, value) => sum + value, 0);
  return `No ${label}, ${firstName(patient)} apresentou escore total de ${total} pontos`
    + (maximum ? `, de um máximo possível de ${maximum}` : '')
    + '. A interpretação clínica deste resultado deve considerar a entrevista, a observação e os demais instrumentos.';
}

function groupedFrequencyResult(patient, record) {
  const sections = (record.questions || []).map(section => {
    const values = (section.questions || [])
      .map(question => scoreOf(record.responses?.[question.id]))
      .filter(Number.isFinite);
    if (!values.length) return null;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return `${section.title}: média ${average.toFixed(1).replace('.', ',')} de 4`;
  }).filter(Boolean);
  return `${firstName(patient)} respondeu ao Questionário de Funcionamento Executivo no Cotidiano. `
    + `Os indicadores por domínio foram: ${sections.join('; ')}.`;
}

function divaResult(patient, record) {
  const response = record.responses || {};
  const count = (suffix, prefix) => Object.entries(response).filter(
    ([id, value]) => id.startsWith(`diva-${prefix}`) && id.endsWith(suffix) && value === 'Sim',
  ).length;
  const adultAttention = count('-adult', 'a');
  const childAttention = count('-child', 'a');
  const adultHyper = count('-adult', 'hi');
  const childHyper = count('-child', 'hi');
  const impacts = Object.entries(response)
    .filter(([id, value]) => id.startsWith('diva-impact-') && Array.isArray(value) && value.length)
    .length;
  return `Na entrevista DIVA-5, ${firstName(patient)} assinalou presença de ${adultAttention} de 9 `
    + `sintomas de desatenção na idade adulta e ${childAttention} de 9 na infância; `
    + `${adultHyper} de 9 sintomas de hiperatividade/impulsividade na idade adulta e `
    + `${childHyper} de 9 na infância. Foram informados prejuízos em ${impacts} área(s) de funcionamento. `
    + 'Esses dados constituem relato clínico e não estabelecem diagnóstico isoladamente.';
}

function asrsResult(patient, record) {
  const response = record.responses || {};
  const elevated = prefix => Object.entries(response).filter(([id, answer]) => (
    id.startsWith(prefix) && Number.isFinite(scoreOf(answer)) && scoreOf(answer) >= 3
  )).length;
  return `Na ASRS-18, ${firstName(patient)} indicou frequência elevada em `
    + `${elevated('asrs-a-')} de 9 itens de desatenção e `
    + `${elevated('asrs-b-')} de 9 itens de hiperatividade/impulsividade.`;
}

export function resultForAnamnesis(patient, record) {
  switch (record.template_key) {
    case 'had':
      return hadResult(patient, record);
    case 'hamilton':
      return summedResult(patient, record, 56, 'questionário de ansiedade de Hamilton');
    case 'funcoes-executivas':
      return groupedFrequencyResult(patient, record);
    case 'tpoc':
      return summedResult(patient, record, 72, 'questionário de rastreio de traços obsessivo-compulsivos');
    case 'diva-5':
      return divaResult(patient, record);
    case 'asrs-18':
      return asrsResult(patient, record);
    default:
      return `${firstName(patient)} respondeu ao formulário “${record.nome}”. As respostas encontram-se registradas para revisão profissional.`;
  }
}

export function generateFormResultsText(patient, records) {
  if (!records.length) return 'Não há formulários respondidos até o momento.';
  return records.map(record => resultForAnamnesis(patient, record)).join('\n\n');
}

export function generateRelevantAnamnesisText(patient, records) {
  const age = ageYears(patient?.data_nascimento);
  const opening = `${firstName(patient)}${age !== null ? ` tem ${age} anos` : ''}`
    + `${patient?.escolaridade ? ` e possui escolaridade informada como ${patient.escolaridade}` : ''}.`;

  const openAnswers = records.flatMap(record => answerEntries(record)
    .filter(({ question, answer }) => (
      ['text', 'textarea'].includes(question.type)
      && typeof answer === 'string'
      && answer.trim()
    ))
    .map(({ question, answer }) => `${question.label} ${answer.trim()}`));

  const instrumentSummary = records.length
    ? `Foram obtidas informações por meio dos seguintes formulários: ${records.map(record => record.nome).join(', ')}.`
    : 'Até o momento, não há escalas respondidas.';

  const reported = openAnswers.length
    ? `Nas respostas abertas, foram registrados os seguintes dados: ${openAnswers.join(' ')}`
    : 'Os dados estruturados dos formulários devem ser integrados à entrevista clínica pelo profissional.';

  return `${opening}\n\n${instrumentSummary}\n\n${reported}`;
}

const TEST_NAMES = {
  WISC_IV: 'Escala de Inteligência Wechsler para Crianças - WISC-IV',
  WAIS_III: 'Escala de Inteligência Wechsler para Adultos - WAIS-III',
  WASI: 'Escala Wechsler Abreviada de Inteligência - WASI',
  RAVLT: 'Teste de Aprendizagem Auditivo-Verbal de Rey - RAVLT',
  TRILHAS: 'Teste de Trilhas',
  STROOP: 'Teste de Stroop',
  D2_R: 'Teste D2-R',
  CBCL: 'Child Behavior Checklist - CBCL',
};

export function generateProcedureText(evaluations, anamneses) {
  const tests = [...new Set(evaluations.flatMap(evaluation => (
    evaluation.test_results?.map(result => TEST_NAMES[result.test_code] || result.test_code.replaceAll('_', '-')) || []
  )))];
  const forms = anamneses.map(record => record.nome);
  const instruments = [...tests, ...forms];
  if (!instruments.length) return 'Descreva os procedimentos, sessões e instrumentos utilizados.';
  return `Como instrumentos técnicos de coleta de informações foram utilizados: ${instruments.join('; ')}.`;
}

export function generateAnalysisText(patient, evaluations) {
  const wiscResults = evaluations.flatMap(evaluation => (
    evaluation.test_results?.filter(result => result.test_code === 'WISC_IV') || []
  ));
  if (!wiscResults.length) {
    return 'A análise dos resultados deverá integrar os dados quantitativos, qualitativos e comportamentais obtidos durante a avaliação.';
  }

  return wiscResults.map(result => {
    const scores = result.computed_scores || {};
    const total = scores.qiTotal;
    const indices = Object.entries(scores.indexScores || {})
      .filter(([, value]) => value?.qi)
      .map(([code, value]) => `${code} = ${value.qi} (${value.classificacao || 'sem classificação'})`);
    return `${firstName(patient)} foi submetido(a) à Escala de Inteligência Wechsler. `
      + `${total?.qi ? `O resultado global foi QI ${total.qi} (${total.classificacao || 'sem classificação'}). ` : ''}`
      + `${indices.length ? `Os índices obtidos foram: ${indices.join('; ')}.` : ''}`;
  }).join('\n\n');
}

export function generateSummaryText(patient, anamnesisText, formResultsText, evaluations) {
  const evaluationCount = evaluations.length;
  return `${firstName(patient)} participou do processo de avaliação, composto por ${evaluationCount} `
    + `sessão(ões) de avaliação registrada(s). Os dados das escalas, observações clínicas e resultados dos `
    + 'instrumentos foram reunidos neste pré-laudo e devem ser interpretados de forma integrada pelo profissional.\n\n'
    + `${anamnesisText}\n\n${formResultsText}`;
}
