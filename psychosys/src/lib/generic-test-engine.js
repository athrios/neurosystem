const OPERATIONS = new Set([
  'sum',
  'average',
  'minimum',
  'maximum',
  'count_answered',
  'count_true',
  'difference',
  'ratio',
  'weighted_sum',
]);

export class TestScoringError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TestScoringError';
  }
}

function numericValues(fieldIds, responses, outputId) {
  return fieldIds.map(fieldId => {
    if (
      responses[fieldId] === ''
      || responses[fieldId] === null
      || responses[fieldId] === undefined
    ) {
      throw new TestScoringError(
        `O resultado "${outputId}" depende do campo numérico "${fieldId}".`
      );
    }
    const value = Number(responses[fieldId]);
    if (!Number.isFinite(value)) {
      throw new TestScoringError(
        `O resultado "${outputId}" depende do campo numérico "${fieldId}".`
      );
    }
    return value;
  });
}

function round(value, decimals) {
  const precision = Number.isInteger(decimals) && decimals >= 0 ? decimals : 2;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function calculateOperation(output, responses) {
  const fields = Array.isArray(output.fields) ? output.fields : [];
  if (!fields.length) {
    throw new TestScoringError(`O resultado "${output.id}" não possui campos de origem.`);
  }

  if (output.operation === 'count_answered') {
    return fields.filter(field => {
      const value = responses[field];
      return value !== '' && value !== null && value !== undefined;
    }).length;
  }
  if (output.operation === 'count_true') {
    return fields.filter(field => responses[field] === true).length;
  }

  const values = numericValues(fields, responses, output.id);
  switch (output.operation) {
    case 'sum':
      return values.reduce((total, value) => total + value, 0);
    case 'average':
      return values.reduce((total, value) => total + value, 0) / values.length;
    case 'minimum':
      return Math.min(...values);
    case 'maximum':
      return Math.max(...values);
    case 'difference':
      if (values.length !== 2) {
        throw new TestScoringError(`O resultado "${output.id}" exige exatamente dois campos.`);
      }
      return values[0] - values[1];
    case 'ratio':
      if (values.length !== 2) {
        throw new TestScoringError(`O resultado "${output.id}" exige exatamente dois campos.`);
      }
      if (values[1] === 0) {
        throw new TestScoringError(`O resultado "${output.id}" não permite divisor zero.`);
      }
      return values[0] / values[1];
    case 'weighted_sum': {
      if (!Array.isArray(output.weights) || output.weights.length !== values.length) {
        throw new TestScoringError(`O resultado "${output.id}" exige um peso para cada campo.`);
      }
      return values.reduce((total, value, index) => {
        const weight = Number(output.weights[index]);
        if (!Number.isFinite(weight)) {
          throw new TestScoringError(`O resultado "${output.id}" possui um peso inválido.`);
        }
        return total + (value * weight);
      }, 0);
    }
    default:
      throw new TestScoringError(`Operação não suportada: ${output.operation}.`);
  }
}

function classifyValue(value, ranges = []) {
  for (const range of ranges) {
    const minimumMatches = range.min == null || value >= Number(range.min);
    const maximumMatches = range.max == null || value <= Number(range.max);
    if (minimumMatches && maximumMatches && typeof range.label === 'string') {
      return range.label;
    }
  }
  return null;
}

export function calculateGenericTest(scoringSchema, responses) {
  if (!scoringSchema || typeof scoringSchema !== 'object' || Array.isArray(scoringSchema)) {
    throw new TestScoringError('scoring_schema deve ser um objeto.');
  }
  if (scoringSchema.version !== 1) {
    throw new TestScoringError(
      `Versão de correção não suportada: ${scoringSchema.version ?? 'ausente'}.`
    );
  }
  if (!Array.isArray(scoringSchema.outputs) || scoringSchema.outputs.length === 0) {
    throw new TestScoringError('A correção deve possuir ao menos um resultado.');
  }

  const outputIds = new Set();
  const outputs = {};

  for (const output of scoringSchema.outputs) {
    if (!output?.id || typeof output.id !== 'string') {
      throw new TestScoringError('Todo resultado deve possuir um identificador.');
    }
    if (outputIds.has(output.id)) {
      throw new TestScoringError(`O resultado "${output.id}" está duplicado.`);
    }
    if (!OPERATIONS.has(output.operation)) {
      throw new TestScoringError(`Operação não suportada: ${output.operation}.`);
    }
    outputIds.add(output.id);

    const value = round(calculateOperation(output, responses), output.decimals);
    outputs[output.id] = {
      label: output.label || output.id,
      value,
      unit: typeof output.unit === 'string' ? output.unit : '',
      classification: classifyValue(value, output.classificationRanges),
    };
  }

  return {
    engine: 'generic-v1',
    engineVersion: '1',
    outputs,
  };
}
