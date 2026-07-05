import { TestScoringError } from '../generic-test-engine.js';

function toNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TestScoringError(`Informe um valor numérico válido para "${label}".`);
  }
  return number;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeLookupValue(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : value;
}

function lookupFloor(rows, raw) {
  const numericRows = (rows || [])
    .filter(row => Number.isFinite(Number(row?.[0])))
    .sort((left, right) => Number(left[0]) - Number(right[0]));
  if (!numericRows.length) return null;

  let match = numericRows[0];
  for (const row of numericRows) {
    if (Number(row[0]) > raw) break;
    match = row;
  }
  return {
    raw: Number(match[0]),
    standard: normalizeLookupValue(match[1]),
    percentile: match[2] ?? null,
    classification: match[3] ?? null,
    confidenceInterval: match[4] ?? null,
  };
}

function classify(value, ranges = []) {
  if (!Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  const range = ranges.find(item => (
    (item.min == null || numeric >= Number(item.min))
    && (item.max == null || numeric <= Number(item.max))
  ));
  return range?.label || null;
}

function scoreItem(fieldId, scale, responses) {
  const value = toNumber(responses[fieldId], fieldId);
  if (scale.reverseFields?.includes(fieldId)) {
    return Number(scale.reverseBase) - value;
  }
  return value + Number(scale.offset || 0);
}

function calculateScale(scale, responses) {
  if (scale.entryField) {
    return toNumber(responses[scale.entryField], scale.label);
  }
  if (!Array.isArray(scale.fields) || !scale.fields.length) {
    throw new TestScoringError(`A escala "${scale.id}" não possui campos de origem.`);
  }
  return sum(scale.fields.map(fieldId => scoreItem(fieldId, scale, responses)));
}

function sourceValue(source, calculatedScales, responses) {
  const weight = Number.isFinite(Number(source.weight)) ? Number(source.weight) : 1;
  if (source.field) return toNumber(responses[source.field], source.field) * weight;
  const scale = calculatedScales[source.scale];
  if (!scale) {
    throw new TestScoringError(`A composição depende da escala inexistente "${source.scale}".`);
  }
  const property = source.score || 'raw';
  const value = scale[property];
  if (!Number.isFinite(Number(value))) {
    throw new TestScoringError(
      `A composição depende de "${source.scale}" sem ${property} numérico.`
    );
  }
  return Number(value) * weight;
}

function selectedProfile(scoringSchema, responses) {
  const norms = scoringSchema.norms;
  if (!norms) return null;
  const profileId = norms.profileField
    ? String(responses[norms.profileField] || '')
    : norms.defaultProfile;
  if (!profileId || !norms.profiles?.[profileId]) {
    throw new TestScoringError('Selecione a tabela normativa antes de calcular.');
  }
  return norms.profiles[profileId];
}

function resultOutput(label, raw, lookup, config = {}) {
  const standard = lookup?.standard;
  const standardIsNumeric = Number.isFinite(Number(standard));
  const primary = standardIsNumeric && config.primary !== 'raw'
    ? Number(standard)
    : raw;
  const unit = standardIsNumeric && config.primary !== 'raw'
    ? (config.standardUnit || 'escore')
    : (config.rawUnit || 'pontos brutos');
  const classification = lookup?.classification
    || classify(
      config.classificationSource === 'raw' ? raw : primary,
      config.classificationRanges
    );
  const details = [
    { label: 'Pontos brutos', value: raw },
    standard != null ? {
      label: config.standardLabel || 'Escore padronizado',
      value: standard,
    } : null,
    lookup?.percentile != null ? {
      label: 'Percentil',
      value: lookup.percentile,
    } : null,
    lookup?.confidenceInterval != null ? {
      label: 'Intervalo de confiança',
      value: lookup.confidenceInterval,
    } : null,
  ].filter(Boolean);

  return {
    label,
    value: round(primary, config.decimals ?? 2),
    unit,
    classification,
    details,
    raw,
    standard: standard ?? null,
    percentile: lookup?.percentile ?? null,
  };
}

export function calculateAssessment(scoringSchema, responses) {
  if (!scoringSchema || scoringSchema.version !== 1) {
    throw new TestScoringError('Configuração de correção assessment-v1 inválida.');
  }
  if (!Array.isArray(scoringSchema.scales) || !scoringSchema.scales.length) {
    throw new TestScoringError('O teste não possui escalas configuradas.');
  }

  const profile = selectedProfile(scoringSchema, responses);
  const calculatedScales = {};
  const outputs = {};

  for (const scale of scoringSchema.scales) {
    const raw = calculateScale(scale, responses);
    const table = profile?.tables?.[scale.id];
    const lookup = table ? lookupFloor(table.rows, raw) : null;
    const standard = lookup?.standard;
    calculatedScales[scale.id] = {
      raw,
      standard: Number.isFinite(Number(standard)) ? Number(standard) : standard,
      percentile: lookup?.percentile ?? null,
    };
    outputs[scale.id] = resultOutput(scale.label || scale.id, raw, lookup, {
      ...scoringSchema.outputDefaults,
      ...table,
      ...scale.output,
    });
  }

  for (const composite of scoringSchema.composites || []) {
    const values = (composite.sources || []).map(source => (
      sourceValue(source, calculatedScales, responses)
    ));
    if (!values.length) {
      throw new TestScoringError(`A composição "${composite.id}" não possui fontes.`);
    }
    const raw = composite.operation === 'average'
      ? sum(values) / values.length
      : sum(values);
    const table = profile?.tables?.[composite.id] || composite.table;
    const lookup = table ? lookupFloor(table.rows, raw) : null;
    const standard = lookup?.standard;
    calculatedScales[composite.id] = {
      raw,
      standard: Number.isFinite(Number(standard)) ? Number(standard) : standard,
      percentile: lookup?.percentile ?? null,
    };
    outputs[composite.id] = resultOutput(composite.label || composite.id, raw, lookup, {
      ...scoringSchema.outputDefaults,
      ...table,
      ...composite.output,
    });
  }

  return {
    engine: 'assessment-v1',
    engineVersion: '1',
    normativeProfile: profile?.label || null,
    outputs,
  };
}
