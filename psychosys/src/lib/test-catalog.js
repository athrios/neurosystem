import { supabase } from './supabase';

const RESULT_STATUSES = new Set(['draft', 'scored', 'reviewed', 'invalidated']);

function objectOrEmpty(value, fieldName) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} deve ser um objeto.`);
  }
  return value;
}

/**
 * Catálogo governado pelo banco. A interface não precisa conhecer códigos,
 * categorias ou disponibilidade de formulários em tempo de compilação.
 */
export function getTestCatalog({
  activeOnly = true,
  implementationStatuses = null,
} = {}) {
  let query = supabase
    .from('test_catalog_view')
    .select('*')
    .order('category_name')
    .order('sort_order');

  if (activeOnly) query = query.eq('active', true);
  if (implementationStatuses?.length) {
    query = query.in('implementation_status', implementationStatuses);
  }

  return query;
}

export function getTestForm(formCode) {
  return supabase
    .from('test_forms')
    .select(`
      *,
      test_instruments!inner(
        code,
        name,
        acronym,
        description,
        category_code,
        test_categories!inner(code, name)
      )
    `)
    .eq('code', formCode)
    .single();
}

export function getTestResponseLinks(evaluationId, formCode = null) {
  let query = supabase
    .from('test_response_links')
    .select(`
      id,
      evaluation_id,
      form_code,
      share_token,
      respondent_type,
      respondent_name,
      relationship,
      status,
      responses,
      current_step,
      shared_at,
      responded_at,
      reviewed_at,
      expires_at,
      created_at
    `)
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: false });

  if (formCode) query = query.eq('form_code', formCode);
  return query;
}

export function getTestResponseLink(id) {
  return supabase
    .from('test_response_links')
    .select('*')
    .eq('id', id)
    .single();
}

export function createTestResponseLink({
  evaluationId,
  formCode,
  respondentType,
  respondentName,
  relationship = '',
}) {
  return supabase
    .rpc('create_test_response_link', {
      p_evaluation_id: evaluationId,
      p_form_code: formCode,
      p_respondent_type: respondentType,
      p_respondent_name: respondentName,
      p_relationship: relationship || null,
    })
    .single();
}

export function updateTestResponseLink(id, updates) {
  return supabase
    .from('test_response_links')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
}

export function deleteAppliedTest(evaluationId, formCode) {
  return supabase.rpc('delete_applied_test', {
    p_evaluation_id: evaluationId,
    p_form_code: formCode,
  });
}

export function getSharedTestResponse(token) {
  return supabase.rpc('get_shared_test_response', { p_token: token });
}

export function saveSharedTestResponseDraft(token, responses, currentStep) {
  return supabase.rpc('save_shared_test_response_draft', {
    p_token: token,
    p_responses: responses,
    p_current_step: currentStep,
  });
}

export function submitSharedTestResponse(token, responses) {
  return supabase.rpc('submit_shared_test_response', {
    p_token: token,
    p_responses: responses,
  });
}

export function getNormativeSets(formCode, {
  statuses = ['published', 'validated', 'imported'],
} = {}) {
  let query = supabase
    .from('test_normative_sets')
    .select('id, form_code, code, version, title, source_reference, population, selection_rules, status, checksum, valid_from, valid_until, metadata')
    .eq('form_code', formCode)
    .order('version', { ascending: false });

  if (statuses?.length) query = query.in('status', statuses);
  return query;
}

export function getNormativeTables(normativeSetId) {
  return supabase
    .from('test_normative_tables')
    .select('id, normative_set_id, code, dimensions, data, metadata')
    .eq('normative_set_id', normativeSetId)
    .order('code');
}

/**
 * Persiste qualquer formulário catalogado no contrato comum de resultados.
 * Motores específicos transformam rawScores em computedScores antes da gravação.
 */
export function saveStructuredTestResult({
  evaluationId,
  formCode,
  rawScores = {},
  computedScores = {},
  meta = {},
  resultStatus = 'draft',
  resultVersion = 1,
  scoringEngineVersion = null,
  normativeSetId = null,
  completedAt = null,
}) {
  if (!evaluationId) throw new TypeError('evaluationId é obrigatório.');
  if (!formCode) throw new TypeError('formCode é obrigatório.');
  if (!RESULT_STATUSES.has(resultStatus)) {
    throw new TypeError(`Status de resultado inválido: ${resultStatus}.`);
  }
  if (!Number.isInteger(resultVersion) || resultVersion < 1) {
    throw new TypeError('resultVersion deve ser um inteiro positivo.');
  }

  const completionTimestamp = completedAt
    || (['scored', 'reviewed'].includes(resultStatus) ? new Date().toISOString() : null);

  return supabase
    .from('test_results')
    .upsert({
      evaluation_id: evaluationId,
      test_code: formCode,
      test_form_code: formCode,
      raw_scores: objectOrEmpty(rawScores, 'rawScores'),
      computed_scores: objectOrEmpty(computedScores, 'computedScores'),
      meta: objectOrEmpty(meta, 'meta'),
      result_status: resultStatus,
      result_version: resultVersion,
      scoring_engine_version: scoringEngineVersion,
      normative_set_id: normativeSetId,
      completed_at: completionTimestamp,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'evaluation_id,test_code' })
    .select()
    .single();
}
