--
-- Histórico imutável de cálculos por origem de resposta.
--
-- Observação de arquitetura:
-- test_response_links já representa o respondente externo de uma avaliação
-- (token, tipo, nome, respostas e status). Por isso, calculation_runs usa
-- respondent_id como referência a test_response_links.id, evitando duplicar
-- uma tabela paralela de respondentes neste momento.

CREATE TABLE IF NOT EXISTS public.calculation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES public.test_response_links(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL,
  instrument_version INTEGER NOT NULL DEFAULT 1,
  calculation_status TEXT NOT NULL DEFAULT 'calculated'
    CHECK (calculation_status IN ('calculated', 'failed', 'invalidated')),
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  normative_set_id UUID REFERENCES public.test_normative_sets(id) ON DELETE SET NULL,
  scoring_engine_version TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.calculation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calculation_runs_select" ON public.calculation_runs;
CREATE POLICY "calculation_runs_select"
  ON public.calculation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluations evaluation
      WHERE evaluation.id = calculation_runs.evaluation_id
        AND (evaluation.psicologo_id = auth.uid() OR public.is_master())
    )
  );

DROP POLICY IF EXISTS "calculation_runs_insert" ON public.calculation_runs;
CREATE POLICY "calculation_runs_insert"
  ON public.calculation_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.evaluations evaluation
      WHERE evaluation.id = calculation_runs.evaluation_id
        AND (evaluation.psicologo_id = auth.uid() OR public.is_master())
    )
  );

DROP POLICY IF EXISTS "calculation_runs_no_update" ON public.calculation_runs;
CREATE POLICY "calculation_runs_no_update"
  ON public.calculation_runs FOR UPDATE
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "calculation_runs_no_delete" ON public.calculation_runs;
CREATE POLICY "calculation_runs_no_delete"
  ON public.calculation_runs FOR DELETE
  USING (FALSE);

CREATE INDEX IF NOT EXISTS idx_calculation_runs_evaluation
  ON public.calculation_runs(evaluation_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculation_runs_respondent
  ON public.calculation_runs(respondent_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculation_runs_instrument
  ON public.calculation_runs(instrument_id, calculated_at DESC);

CREATE OR REPLACE FUNCTION public.save_shared_test_response_result(
  p_response_link_id UUID,
  p_computed_scores JSONB,
  p_meta JSONB DEFAULT '{}'::jsonb,
  p_result_version INTEGER DEFAULT 1,
  p_scoring_engine_version TEXT DEFAULT NULL,
  p_normative_set_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.test_response_links%ROWTYPE;
  v_form public.test_forms%ROWTYPE;
  v_evaluation public.evaluations%ROWTYPE;
  v_result public.test_results%ROWTYPE;
  v_run public.calculation_runs%ROWTYPE;
  v_meta JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF jsonb_typeof(COALESCE(p_computed_scores, '{}'::jsonb)) <> 'object'
    OR pg_column_size(COALESCE(p_computed_scores, '{}'::jsonb)) > 1048576
  THEN
    RETURN jsonb_build_object(
      'saved', FALSE,
      'code', 'invalid_computed_scores',
      'message', 'O resultado calculado é inválido.'
    );
  END IF;

  IF jsonb_typeof(COALESCE(p_meta, '{}'::jsonb)) <> 'object'
    OR pg_column_size(COALESCE(p_meta, '{}'::jsonb)) > 1048576
  THEN
    RETURN jsonb_build_object(
      'saved', FALSE,
      'code', 'invalid_meta',
      'message', 'Os metadados do cálculo são inválidos.'
    );
  END IF;

  SELECT * INTO v_link
  FROM public.test_response_links
  WHERE id = p_response_link_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resposta compartilhada não encontrada.';
  END IF;

  IF v_link.psicologo_id <> auth.uid() AND NOT public.is_master() THEN
    RAISE EXCEPTION 'Sem permissão para calcular esta resposta.';
  END IF;

  IF v_link.status NOT IN ('submitted', 'reviewed') THEN
    RETURN jsonb_build_object(
      'saved', FALSE,
      'code', 'response_not_submitted',
      'message', 'A resposta ainda não foi enviada pelo terceiro.'
    );
  END IF;

  IF COALESCE(v_link.calculation_count, 0) >= 3 THEN
    RETURN jsonb_build_object(
      'saved', FALSE,
      'code', 'calculation_limit',
      'message', 'Limite de 3 cálculos atingido para esta resposta.'
    );
  END IF;

  SELECT * INTO v_evaluation
  FROM public.evaluations
  WHERE id = v_link.evaluation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  SELECT * INTO v_form
  FROM public.test_forms
  WHERE code = v_link.form_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulário não encontrado.';
  END IF;

  v_meta := COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
    'response_link_id', v_link.id,
    'respondent_id', v_link.id,
    'respondent_type', v_link.respondent_type,
    'respondent_name', v_link.respondent_name,
    'relationship', COALESCE(v_link.relationship, ''),
    'responded_at', v_link.responded_at,
    'form_name', v_form.name,
    'data_aplicacao', v_evaluation.data_aplicacao
  );

  INSERT INTO public.calculation_runs (
    evaluation_id,
    patient_id,
    respondent_id,
    instrument_id,
    instrument_version,
    calculation_status,
    result_summary,
    result_payload,
    raw_scores,
    meta,
    normative_set_id,
    scoring_engine_version,
    calculated_at,
    created_by
  ) VALUES (
    v_link.evaluation_id,
    v_link.patient_id,
    v_link.id,
    v_link.form_code,
    GREATEST(COALESCE(p_result_version, 1), 1),
    'calculated',
    jsonb_build_object(
      'outputs', COALESCE(p_computed_scores, '{}'::jsonb)->'outputs'
    ),
    COALESCE(p_computed_scores, '{}'::jsonb),
    v_link.responses,
    v_meta,
    p_normative_set_id,
    p_scoring_engine_version,
    NOW(),
    auth.uid()
  )
  RETURNING * INTO v_run;

  PERFORM set_config('app.shared_response_calculation_authorized', 'on', TRUE);

  INSERT INTO public.test_results (
    evaluation_id,
    test_code,
    test_form_code,
    raw_scores,
    computed_scores,
    meta,
    result_status,
    result_version,
    scoring_engine_version,
    normative_set_id,
    completed_at,
    updated_at
  ) VALUES (
    v_link.evaluation_id,
    v_link.form_code,
    v_link.form_code,
    v_link.responses,
    COALESCE(p_computed_scores, '{}'::jsonb),
    v_meta || jsonb_build_object('calculation_run_id', v_run.id),
    'scored',
    GREATEST(COALESCE(p_result_version, 1), 1),
    p_scoring_engine_version,
    p_normative_set_id,
    v_run.calculated_at,
    NOW()
  )
  ON CONFLICT (evaluation_id, test_code) DO UPDATE
  SET
    test_form_code = EXCLUDED.test_form_code,
    raw_scores = v_link.responses,
    computed_scores = EXCLUDED.computed_scores,
    meta = EXCLUDED.meta,
    result_status = 'scored',
    result_version = EXCLUDED.result_version,
    scoring_engine_version = EXCLUDED.scoring_engine_version,
    normative_set_id = EXCLUDED.normative_set_id,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW()
  RETURNING * INTO v_result;

  UPDATE public.test_response_links
  SET
    status = 'reviewed',
    reviewed_at = NOW(),
    calculation_count = COALESCE(calculation_count, 0) + 1
  WHERE id = v_link.id
  RETURNING * INTO v_link;

  RETURN jsonb_build_object(
    'saved', TRUE,
    'test_result_id', v_result.id,
    'response_link_id', v_link.id,
    'calculation_run_id', v_run.id,
    'calculation_count', v_link.calculation_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_shared_test_response_result(
  UUID, JSONB, JSONB, INTEGER, TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_test_response_result(
  UUID, JSONB, JSONB, INTEGER, TEXT, UUID
) TO authenticated;
