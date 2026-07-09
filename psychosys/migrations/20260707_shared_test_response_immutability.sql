--
-- Respostas enviadas por terceiros viram fonte primária imutável.
-- O profissional pode calcular até 3 vezes o resultado derivado, sempre usando
-- exatamente as respostas originais registradas em test_response_links.

ALTER TABLE public.test_response_links
  ADD COLUMN IF NOT EXISTS calculation_count INTEGER NOT NULL DEFAULT 0
    CHECK (calculation_count BETWEEN 0 AND 3);

ALTER TABLE public.test_deletion_audit
  ADD COLUMN IF NOT EXISTS response_link_id UUID,
  ADD COLUMN IF NOT EXISTS response_link_snapshot JSONB;

CREATE OR REPLACE FUNCTION public.is_test_response_deletion_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.test_response_deletion_authorized', TRUE),
    ''
  ) = 'on';
$$;

CREATE OR REPLACE FUNCTION public.is_shared_response_calculation_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.shared_response_calculation_authorized', TRUE),
    ''
  ) = 'on';
$$;

CREATE OR REPLACE FUNCTION public.prevent_submitted_test_response_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('submitted', 'reviewed')
      AND NOT public.is_test_response_deletion_authorized()
    THEN
      RAISE EXCEPTION 'Respostas recebidas de terceiros não podem ser excluídas diretamente.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('submitted', 'reviewed') THEN
    IF NEW.responses IS DISTINCT FROM OLD.responses
      OR NEW.respondent_type IS DISTINCT FROM OLD.respondent_type
      OR NEW.respondent_name IS DISTINCT FROM OLD.respondent_name
      OR NEW.relationship IS DISTINCT FROM OLD.relationship
      OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
      OR NEW.current_step IS DISTINCT FROM OLD.current_step
    THEN
      RAISE EXCEPTION 'Respostas recebidas de terceiros não podem ser alteradas.';
    END IF;

    IF NEW.status NOT IN ('submitted', 'reviewed') THEN
      RAISE EXCEPTION 'Respostas recebidas de terceiros não podem retornar para edição.';
    END IF;

    IF (
      NEW.calculation_count IS DISTINCT FROM OLD.calculation_count
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.status IS DISTINCT FROM OLD.status
    )
      AND NOT public.is_shared_response_calculation_authorized()
    THEN
      RAISE EXCEPTION 'A revisão da resposta recebida deve ocorrer pelo fluxo de cálculo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_response_links_prevent_submitted_mutation
  ON public.test_response_links;
CREATE TRIGGER trg_test_response_links_prevent_submitted_mutation
  BEFORE UPDATE OR DELETE ON public.test_response_links
  FOR EACH ROW EXECUTE FUNCTION public.prevent_submitted_test_response_mutation();

CREATE OR REPLACE FUNCTION public.prevent_third_party_result_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_code TEXT;
  v_third_party_result BOOLEAN := FALSE;
  v_authorized BOOLEAN := FALSE;
BEGIN
  v_form_code := CASE
    WHEN TG_OP = 'DELETE' THEN COALESCE(OLD.test_form_code, OLD.test_code)
    ELSE COALESCE(NEW.test_form_code, NEW.test_code)
  END;

  SELECT EXISTS (
    SELECT 1
    FROM public.test_forms form
    WHERE form.code = v_form_code
      AND form.respondent_type NOT IN ('professional', 'interview')
  )
  INTO v_third_party_result;

  IF NOT v_third_party_result THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_authorized :=
    COALESCE(current_setting('app.shared_response_calculation_authorized', TRUE), '') = 'on'
    OR COALESCE(current_setting('app.test_response_deletion_authorized', TRUE), '') = 'on'
    OR COALESCE(current_setting('app.test_result_recovery_authorized', TRUE), '') = 'on';

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Resultados de testes respondidos por terceiros devem ser gerados pelo fluxo de cálculo da resposta recebida.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_results_prevent_third_party_mutation
  ON public.test_results;
CREATE TRIGGER trg_test_results_prevent_third_party_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.test_results
  FOR EACH ROW EXECUTE FUNCTION public.prevent_third_party_result_mutation();

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
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
      'response_link_id', v_link.id,
      'respondent_type', v_link.respondent_type,
      'respondent_name', v_link.respondent_name,
      'relationship', COALESCE(v_link.relationship, ''),
      'responded_at', v_link.responded_at,
      'form_name', v_form.name,
      'data_aplicacao', v_evaluation.data_aplicacao
    ),
    'scored',
    GREATEST(COALESCE(p_result_version, 1), 1),
    p_scoring_engine_version,
    p_normative_set_id,
    NOW(),
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
