import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Variáveis de ambiente do Supabase não configuradas');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTH HELPERS
// ============================================================

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

// ============================================================
// PATIENTS
// ============================================================

export async function getPatients(search = '') {
  let query = supabase
    .from('patients')
    .select('*, profiles!patients_psicologo_id_fkey(nome, crp)')
    .order('nome');
  
  if (search) {
    query = query.ilike('nome', `%${search}%`);
  }
  
  return query;
}

export async function getPatient(id) {
  return supabase
    .from('patients')
    .select('*, profiles!patients_psicologo_id_fkey(nome, crp)')
    .eq('id', id)
    .single();
}

export async function createPatient(data) {
  return supabase.from('patients').insert(data).select().single();
}

export async function updatePatient(id, data) {
  return supabase.from('patients').update(data).eq('id', id).select().single();
}

export async function deletePatient(id) {
  return supabase.from('patients').delete().eq('id', id);
}

// ============================================================
// EVALUATIONS
// ============================================================

export async function getEvaluations(patientId) {
  return supabase
    .from('evaluations')
    .select('*, test_results(test_code, computed_scores)')
    .eq('patient_id', patientId)
    .order('data_aplicacao', { ascending: false });
}

export async function getEvaluation(id) {
  return supabase
    .from('evaluations')
    .select('*, patients(*), profiles!evaluations_psicologo_id_fkey(*)')
    .eq('id', id)
    .single();
}

export async function createEvaluation(data) {
  return supabase.from('evaluations').insert(data).select().single();
}

export async function updateEvaluation(id, data) {
  return supabase.from('evaluations').update(data).eq('id', id).select().single();
}

export async function deleteEvaluation(id) {
  return supabase
    .from('evaluations')
    .delete()
    .eq('id', id)
    .eq('status', 'em_andamento')
    .select('id')
    .maybeSingle();
}

// ============================================================
// ANAMNESES
// ============================================================

export async function getAnamneses(patientId) {
  return supabase
    .from('anamneses')
    .select('id, nome, template_key, status, share_token, created_at, responded_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
}

export async function getAnamnesesForReport(patientId) {
  return supabase
    .from('anamneses')
    .select('id, nome, template_key, status, questions, responses, result_text, responded_at')
    .eq('patient_id', patientId)
    .in('status', ['respondida', 'revisada'])
    .order('responded_at', { ascending: true });
}

export async function getAnamnesis(id) {
  return supabase
    .from('anamneses')
    .select('*, patients(nome)')
    .eq('id', id)
    .single();
}

export async function createAnamnesis(data) {
  return supabase.from('anamneses').insert(data).select().single();
}

export async function updateAnamnesis(id, data) {
  return supabase.from('anamneses').update(data).eq('id', id).select().single();
}

export async function deleteAnamnesis(id) {
  return supabase
    .from('anamneses')
    .delete()
    .eq('id', id)
    .in('status', ['rascunho', 'compartilhada'])
    .select('id')
    .maybeSingle();
}

export async function getSharedAnamnesis(token) {
  return supabase.rpc('get_shared_anamnesis', { p_token: token }).maybeSingle();
}

export async function saveSharedAnamnesisDraft(token, responses, currentStep) {
  return supabase.rpc('save_shared_anamnesis_draft', {
    p_token: token,
    p_responses: responses,
    p_current_step: currentStep,
  });
}

export async function submitSharedAnamnesis(token, responses) {
  return supabase.rpc('submit_shared_anamnesis', {
    p_token: token,
    p_responses: responses,
  });
}

// ============================================================
// PRÉ-LAUDOS
// ============================================================

export async function getPreReport(patientId) {
  return supabase
    .from('pre_reports')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();
}

export async function savePreReport(patientId, psicologoId, fields) {
  return supabase
    .from('pre_reports')
    .upsert({
      patient_id: patientId,
      psicologo_id: psicologoId,
      ...fields,
    }, { onConflict: 'patient_id' })
    .select()
    .single();
}

// ============================================================
// TEST RESULTS
// ============================================================

export async function getTestResult(evaluationId, testCode) {
  return supabase
    .from('test_results')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .eq('test_code', testCode)
    .maybeSingle();
}

export async function saveTestResult(evaluationId, testCode, rawScores, computedScores, meta = {}) {
  return supabase
    .from('test_results')
    .upsert({
      evaluation_id: evaluationId,
      test_code: testCode,
      raw_scores: rawScores,
      computed_scores: computedScores,
      meta,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'evaluation_id,test_code' })
    .select()
    .single();
}

// ============================================================
// NORMATIVE DATA
// ============================================================

const normCache = {};
let localWiscDataPromise;

async function getLocalWiscData() {
  if (!localWiscDataPromise) {
    localWiscDataPromise = import('../../wisc_iv_normas.json')
      .then(module => module.default);
  }
  return localWiscDataPromise;
}

export async function getNormativeData(testCode, tableName) {
  const key = `${testCode}_${tableName}`;
  if (normCache[key]) return normCache[key];
  
  const { data, error } = await supabase
    .from('normative_data')
    .select('data, meta')
    .eq('test_code', testCode)
    .eq('table_name', tableName)
    .single();
  
  if (!error && data) {
    normCache[key] = data;
  }
  
  return error ? null : data;
}

export async function getWiscNormTables() {
  const cacheKey = 'WISC_IV_ALL';
  if (normCache[cacheKey]) return normCache[cacheKey];
  
  const { data, error } = await supabase
    .from('normative_data')
    .select('table_name, meta, data')
    .eq('test_code', 'WISC_IV')
    .like('table_name', 'WISC_IV_SUBTESTE_%');
  
  const tables = (data || [])
    .filter(d =>
      Number.isFinite(Number(d.meta?.min_days)) &&
      Number.isFinite(Number(d.meta?.max_days)) &&
      d.data
    )
    .map(d => ({
      min_days: Number(d.meta.min_days),
      max_days: Number(d.meta.max_days),
      subtests: d.data,
    }))
    .sort((a, b) => a.min_days - b.min_days);

  const localData = await getLocalWiscData();
  const localTables = localData.subtest_tables || [];
  const hasCompleteCoverage =
    !error &&
    tables.length >= localTables.length &&
    tables[0]?.min_days <= localTables[0]?.min_days &&
    tables[tables.length - 1]?.max_days >= localTables[localTables.length - 1]?.max_days;
  
  normCache[cacheKey] = hasCompleteCoverage ? tables : localTables;
  return normCache[cacheKey];
}

export async function getWiscIndexTables() {
  const cacheKey = 'WISC_IV_INDEX_ALL';
  if (normCache[cacheKey]) return normCache[cacheKey];
  
  const { data, error } = await supabase
    .from('normative_data')
    .select('table_name, data')
    .eq('test_code', 'WISC_IV')
    .like('table_name', 'WISC_IV_INDEX_%');
  
  const tables = {};
  for (const row of data || []) {
    const indexCode = row.table_name.replace('WISC_IV_INDEX_', '');
    if (Array.isArray(row.data?.rows)) {
      tables[indexCode] = row.data.rows;
    }
  }

  const requiredTables = ['ICV', 'IOP', 'IMO', 'IVP', 'QI'];
  const hasAllTables = !error && requiredTables.every(code => tables[code]?.length > 0);
  const localData = hasAllTables ? null : await getLocalWiscData();
  
  normCache[cacheKey] = hasAllTables ? tables : localData.index_tables;
  return normCache[cacheKey];
}
