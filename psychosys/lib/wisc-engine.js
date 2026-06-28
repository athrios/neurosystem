// lib/wisc-engine.js
// Motor de cálculo do WISC-IV
// Todos os cálculos são realizados no cliente com os dados normativos em cache

// ============================================================
// CONSTANTES
// ============================================================

export const SUBTESTS = [
  { code: 'CB',  nome: 'Cubos',                        abrev: 'CB',  indice: 'IOP', core: true  },
  { code: 'SM',  nome: 'Semelhanças',                   abrev: 'SM',  indice: 'ICV', core: true  },
  { code: 'DG',  nome: 'Dígitos',                       abrev: 'DG',  indice: 'IMO', core: true  },
  { code: 'CN',  nome: 'Conceitos Figurativos',         abrev: 'CN',  indice: 'IOP', core: true  },
  { code: 'CD',  nome: 'Código',                        abrev: 'CD',  indice: 'IVP', core: true  },
  { code: 'VC',  nome: 'Vocabulário',                   abrev: 'VC',  indice: 'ICV', core: true  },
  { code: 'SNL', nome: 'Seq. de Números e Letras',      abrev: 'SNL', indice: 'IMO', core: true  },
  { code: 'RM',  nome: 'Raciocínio Matricial',          abrev: 'RM',  indice: 'IOP', core: true  },
  { code: 'CO',  nome: 'Compreensão',                   abrev: 'CO',  indice: 'ICV', core: true  },
  { code: 'PS',  nome: 'Procurar Símbolos',             abrev: 'PS',  indice: 'IVP', core: true  },
  { code: 'CF',  nome: 'Completar Figuras',             abrev: 'CF',  indice: 'IOP', core: false },
  { code: 'CA',  nome: 'Cancelamento',                  abrev: 'CA',  indice: 'IVP', core: false },
  { code: 'IN',  nome: 'Informação',                    abrev: 'IN',  indice: 'ICV', core: false },
  { code: 'AR',  nome: 'Aritmética',                    abrev: 'AR',  indice: 'IMO', core: false },
  { code: 'RP',  nome: 'Raciocínio com Palavras',       abrev: 'RP',  indice: 'ICV', core: false },
];

export const INDICES = [
  {
    code: 'ICV',
    nome: 'Índice de Compreensão Verbal',
    abrev: 'ICV',
    core_subtests: ['SM', 'VC', 'CO'],
    suplementar: ['IN', 'RP'],
  },
  {
    code: 'IOP',
    nome: 'Índice de Organização Perceptual',
    abrev: 'IOP',
    core_subtests: ['CB', 'CN', 'RM'],
    suplementar: ['CF'],
  },
  {
    code: 'IMO',
    nome: 'Índice de Memória Operacional',
    abrev: 'IMO',
    core_subtests: ['DG', 'SNL'],
    suplementar: ['AR'],
  },
  {
    code: 'IVP',
    nome: 'Índice de Velocidade de Processamento',
    abrev: 'IVP',
    core_subtests: ['CD', 'PS'],
    suplementar: ['CA'],
  },
];

// Classificações por pontos ponderados (subtestes)
const CLASSIF_PP = [
  { min: 16, max: 19, label: 'Muito Superior' },
  { min: 14, max: 15, label: 'Superior' },
  { min: 12, max: 13, label: 'Média Superior' },
  { min:  8, max: 11, label: 'Média' },
  { min:  6, max:  7, label: 'Média Inferior' },
  { min:  4, max:  5, label: 'Limítrofe' },
  { min:  1, max:  3, label: 'Deficitário' },
];

// Classificações por QI/Índice composto
const CLASSIF_QI = [
  { min: 130, max: 999, label: 'Muito Superior',  color: '#1D9E75' },
  { min: 120, max: 129, label: 'Superior',         color: '#5DCAA5' },
  { min: 110, max: 119, label: 'Média Superior',   color: '#9FE1CB' },
  { min:  90, max: 109, label: 'Média',             color: '#378ADD' },
  { min:  80, max:  89, label: 'Média Inferior',   color: '#FAC775' },
  { min:  70, max:  79, label: 'Limítrofe',         color: '#D85A30' },
  { min:   0, max:  69, label: 'Deficitário',       color: '#E24B4A' },
];

// ============================================================
// FUNÇÕES DE CÁLCULO
// ============================================================

/**
 * Calcula a idade em dias entre duas datas
 */
export function calcIdadeDias(dataNasc, dataAplicacao) {
  const nasc = new Date(dataNasc);
  const aplic = new Date(dataAplicacao);
  return Math.floor((aplic - nasc) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula a idade formatada (Xa, Ym, Zd)
 */
export function calcIdadeFormatada(dataNasc, dataAplicacao) {
  const nasc = new Date(dataNasc);
  const aplic = new Date(dataAplicacao);
  
  let anos = aplic.getFullYear() - nasc.getFullYear();
  let meses = aplic.getMonth() - nasc.getMonth();
  let dias = aplic.getDate() - nasc.getDate();
  
  if (dias < 0) {
    meses--;
    dias += new Date(aplic.getFullYear(), aplic.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  
  return { anos, meses, dias, texto: `${anos}a, ${meses}m, ${dias}d` };
}

/**
 * Bisect: encontra o pontos ponderados dado o score bruto
 * lookup: array de [raw_score, pp] sorted by raw_score
 */
export function bisectLookup(lookup, rawScore) {
  if (!lookup || lookup.length === 0) return null;
  
  let lo = 0, hi = lookup.length - 1, result = null;
  
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (lookup[mid][0] <= rawScore) {
      result = lookup[mid][1];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  
  return result;
}

/**
 * Encontra o grupo normativo para um dado número de dias
 */
export function findAgeGroup(normTables, idadeDias) {
  if (!normTables) return null;
  return normTables.find(g => idadeDias >= g.min_days && idadeDias <= g.max_days) || null;
}

/**
 * Converte pontos ponderados para Z-score
 */
export function ppToZScore(pp) {
  return (pp - 10) / 3;
}

/**
 * Converte Z-score para percentil
 */
export function zScoreToPercentil(z) {
  // Aproximação da função normal cumulativa
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return ((1.0 + sign * y) / 2.0) * 100;
}

/**
 * Classifica por pontos ponderados
 */
export function classifyPP(pp) {
  if (!pp && pp !== 0) return null;
  return CLASSIF_PP.find(c => pp >= c.min && pp <= c.max)?.label || null;
}

/**
 * Classifica por QI/Índice
 */
export function classifyQI(qi) {
  if (!qi && qi !== 0) return null;
  const c = CLASSIF_QI.find(c => qi >= c.min && qi <= c.max);
  return c ? { label: c.label, color: c.color } : null;
}

/**
 * Busca o QI composto para uma soma de pontos ponderados
 */
export function lookupIndexScore(indexTable, soma) {
  if (!indexTable || soma === null || soma === undefined) return null;
  const row = indexTable.find(r => r.soma === soma);
  return row || null;
}

/**
 * Verifica se um índice é interpretável
 * Critério: diferença entre maior e menor subtest < 5 pontos
 */
export function isInterpretavel(scores, subtestCodes) {
  const vals = subtestCodes
    .map(c => scores[c]?.pp)
    .filter(v => v !== null && v !== undefined);
  
  if (vals.length < subtestCodes.length) return null; // dados incompletos
  
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  return (max - min) < 5;
}

/**
 * Calculo completo do WISC-IV
 * @param {object} rawScores - { CB: 15, SM: 12, DG: 8, ... }
 * @param {string} dataNasc - 'YYYY-MM-DD'
 * @param {string} dataAplic - 'YYYY-MM-DD'
 * @param {array} normTables - dados normativos dos subtestes
 * @param {object} indexTables - { ICV: [...], IOP: [...], IMO: [...], IVP: [...], QI: [...] }
 */
export function calcWiscIV(rawScores, dataNasc, dataAplic, normTables, indexTables) {
  const idadeDias = calcIdadeDias(dataNasc, dataAplic);
  const idadeFormatada = calcIdadeFormatada(dataNasc, dataAplic);
  
  if (idadeDias < 2190 || idadeDias > 6999) {
    return { erro: 'Idade fora do range do WISC-IV (6 a 16 anos)' };
  }
  
  const ageGroup = findAgeGroup(normTables, idadeDias);
  if (!ageGroup) {
    return { erro: 'Grupo normativo não encontrado para esta idade' };
  }
  
  // 1. Calcular pontos ponderados de cada subteste
  const subtestScores = {};
  for (const st of SUBTESTS) {
    const raw = rawScores[st.code];
    if (raw === undefined || raw === null || raw === '') {
      subtestScores[st.code] = { raw: null, pp: null, z: null, percentil: null, classif: null };
      continue;
    }
    
    const lookup = ageGroup.subtests[st.code];
    const pp = lookup ? bisectLookup(lookup, Number(raw)) : null;
    const z = pp !== null ? ppToZScore(pp) : null;
    const percentil = z !== null ? zScoreToPercentil(z) : null;
    const classif = pp !== null ? classifyPP(pp) : null;
    
    subtestScores[st.code] = {
      raw: Number(raw),
      pp,
      z: z !== null ? Number(z.toFixed(3)) : null,
      percentil: percentil !== null ? Number(percentil.toFixed(1)) : null,
      classif,
    };
  }
  
  // 2. Calcular índices
  const indexScores = {};
  for (const idx of INDICES) {
    const core = idx.core_subtests;
    const soma = core.reduce((acc, c) => {
      const pp = subtestScores[c]?.pp;
      return pp !== null && pp !== undefined ? acc + pp : null;
    }, 0);
    
    if (soma === null) {
      indexScores[idx.code] = { soma: null, qi: null, percentil: null, classif: null, interpretavel: null };
      continue;
    }
    
    const lookup = lookupIndexScore(indexTables[idx.code], soma);
    const qi = lookup ? (typeof lookup.qi === 'number' ? lookup.qi : null) : null;
    const perc = lookup?.percentil ?? null;
    const classif = qi !== null ? classifyQI(qi) : null;
    const interpretavel = isInterpretavel(subtestScores, core);
    
    indexScores[idx.code] = {
      soma,
      qi,
      percentil: perc,
      ic90: lookup?.ic90 ?? null,
      ic95: lookup?.ic95 ?? null,
      classif,
      interpretavel,
    };
  }
  
  // 3. QI Total
  const somaTotal = INDICES.reduce((acc, idx) => {
    const s = indexScores[idx.code]?.soma;
    return s !== null ? acc + (indexScores[idx.code]?.qi ?? 0) : null;
  }, 0);
  
  const somaQITotal = indexScores.ICV?.soma !== null && indexScores.IOP?.soma !== null &&
                      indexScores.IMO?.soma !== null && indexScores.IVP?.soma !== null
    ? (indexScores.ICV.soma + indexScores.IOP.soma + indexScores.IMO.soma + indexScores.IVP.soma)
    : null;
  
  const qiLookup = somaQITotal !== null ? lookupIndexScore(indexTables.QI, somaQITotal) : null;
  const qiTotal = {
    soma: somaQITotal,
    qi: qiLookup?.qi ?? null,
    percentil: qiLookup?.percentil ?? null,
    ic90: qiLookup?.ic90 ?? null,
    ic95: qiLookup?.ic95 ?? null,
    classif: qiLookup?.qi !== null ? classifyQI(qiLookup?.qi) : null,
    interpretavel: (() => {
      const qs = INDICES.map(i => indexScores[i.code]?.qi).filter(v => v !== null);
      if (qs.length < 4) return null;
      return (Math.max(...qs) - Math.min(...qs)) < 23;
    })(),
  };
  
  // 4. GAI (ICV + IOP)
  const somaGAI = (indexScores.ICV?.soma ?? null) !== null && (indexScores.IOP?.soma ?? null) !== null
    ? indexScores.ICV.soma + indexScores.IOP.soma : null;
  
  // 5. CPI (IMO + IVP)
  const somaCPI = (indexScores.IMO?.soma ?? null) !== null && (indexScores.IVP?.soma ?? null) !== null
    ? indexScores.IMO.soma + indexScores.IVP.soma : null;
  
  return {
    idadeDias,
    idadeFormatada,
    subtestScores,
    indexScores,
    qiTotal,
    somaGAI,
    somaCPI,
    ageGroupLabel: `${idadeFormatada.anos}a ${idadeFormatada.meses}m`,
  };
}

// ============================================================
// DADOS PARA O PROTOCOLO GERAL
// ============================================================

export function getProtocolData(computed) {
  if (!computed) return [];
  
  const rows = [];
  
  // QI Total
  if (computed.qiTotal?.qi !== null) {
    rows.push({
      categoria: 'Eficiência Intelectual',
      instrumento: 'WISC-IV - Q.I. Total',
      pontoBruto: null,
      pontoPonderado: computed.qiTotal.soma,
      qiIndice: computed.qiTotal.qi,
      percentil: computed.qiTotal.percentil,
      classificacao: computed.qiTotal.classif?.label,
      cor: computed.qiTotal.classif?.color,
    });
  }
  
  // Índices
  const indexNomes = {
    ICV: 'Índice de Compreensão Verbal',
    IOP: 'Índice de Organização Perceptual',
    IMO: 'Índice de Memória Operacional',
    IVP: 'Índice de Velocidade de Processamento',
  };
  
  for (const [code, nome] of Object.entries(indexNomes)) {
    const idx = computed.indexScores[code];
    if (idx?.qi !== null) {
      rows.push({
        categoria: 'Eficiência Intelectual',
        instrumento: `WISC-IV - ${nome}`,
        pontoBruto: null,
        pontoPonderado: idx.soma,
        qiIndice: idx.qi,
        percentil: idx.percentil,
        classificacao: idx.classif?.label,
        cor: idx.classif?.color,
      });
    }
  }
  
  return rows;
}

export { CLASSIF_QI, CLASSIF_PP };
