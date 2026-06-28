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
  
  if (error || !data) return null;
  
  const tables = data
    .filter(d => d.meta?.type === 'subtest_lookup')
    .map(d => ({
      min_days: d.meta.min_days,
      max_days: d.meta.max_days,
      subtests: d.data,
    }))
    .sort((a, b) => a.min_days - b.min_days);
  
  normCache[cacheKey] = tables;
  return tables;
}

export async function getWiscIndexTables() {
  const cacheKey = 'WISC_IV_INDEX_ALL';
  if (normCache[cacheKey]) return normCache[cacheKey];
  
  const { data, error } = await supabase
    .from('normative_data')
    .select('table_name, data')
    .eq('test_code', 'WISC_IV')
    .like('table_name', 'WISC_IV_INDEX_%');
  
  if (error || !data) return null;
  
  const tables = {};
  for (const row of data) {
    const indexCode = row.table_name.replace('WISC_IV_INDEX_', '');
    tables[indexCode] = row.data.rows;
  }
  
  normCache[cacheKey] = tables;
  return tables;
}
