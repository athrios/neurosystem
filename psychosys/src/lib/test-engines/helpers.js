import { TestScoringError } from '../generic-test-engine.js';

export function numberResponse(responses, fieldId) {
  const raw = responses[fieldId];
  if (raw === '' || raw === null || raw === undefined || raw === 'na') {
    throw new TestScoringError(`O campo "${fieldId}" não foi respondido.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new TestScoringError(`O campo "${fieldId}" não possui valor numérico.`);
  }
  return value;
}

export function sumItems(responses, items, prefix = 'item_') {
  return items.reduce(
    (total, item) => total + numberResponse(responses, `${prefix}${item}`),
    0
  );
}

export function averageItems(responses, items, prefix = 'item_') {
  return sumItems(responses, items, prefix) / items.length;
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const approximation = 1 - (
    (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1)
    * t
    * Math.exp(-x * x)
  );
  return sign * approximation;
}

export function normalPercentile(zScore) {
  return round(50 * (1 + erf(zScore / Math.sqrt(2))), 2);
}

export function zClassification(zScore) {
  if (zScore >= 2) return 'Muito Superior';
  if (zScore >= 1.333) return 'Superior';
  if (zScore >= 0.667) return 'Média Superior';
  if (zScore >= -0.666) return 'Média';
  if (zScore >= -1.333) return 'Média Inferior';
  if (zScore >= -2) return 'Limítrofe';
  return 'Deficitário';
}

export function ageInYears(dateOfBirth, applicationDate) {
  if (!dateOfBirth || !applicationDate) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const application = new Date(`${applicationDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(application.getTime())) return null;

  let years = application.getFullYear() - birth.getFullYear();
  const beforeBirthday = application.getMonth() < birth.getMonth()
    || (
      application.getMonth() === birth.getMonth()
      && application.getDate() < birth.getDate()
    );
  if (beforeBirthday) years -= 1;
  return years;
}

export function normDetails(rawValue, mean, standardDeviation) {
  if (!Number.isFinite(mean) || !Number.isFinite(standardDeviation) || standardDeviation <= 0) {
    return [];
  }
  const zScore = round((rawValue - mean) / standardDeviation, 3);
  return [
    { label: 'Média normativa', value: mean },
    { label: 'Desvio-padrão', value: standardDeviation },
    { label: 'Z-score', value: zScore },
    { label: 'Ponto ponderado', value: round((zScore * 3) + 10, 2) },
    { label: 'Percentil', value: normalPercentile(zScore) },
    { label: 'Classificação normativa', value: zClassification(zScore) },
  ];
}
